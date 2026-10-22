/**
 * The lab's local API, for the dashboard (apps/attack-lab-ui). Read-only over the evidence: there is
 * no route that changes or deletes a record. Listens on 127.0.0.1 only.
 *
 *   GET  /api/overview          incidents (newest first) with pattern and step counts, totals, key
 *   GET  /api/incidents/:id     one incident: timeline, events, seal, signature check
 *   GET  /api/patterns          patterns with counts and last-seen
 *   GET  /api/verify            the whole chain: every hash, signature and link
 *   GET  /api/records/:seq      one signed record, as stored
 *   POST /api/replay            { incidentId } → { id }: replays in a fresh sandbox pair
 *   GET  /api/replays[/:id]     replay jobs and their results so far
 *   POST /api/simulate          sends labelled test traffic to the live protected sandbox
 *   GET  /api/customers         customers (site, members, the team's note and readiness)
 *   PUT  /api/customers/:id     { note?, readiness?, shieldSiteId?, by }: the team's edit
 *   GET  /api/model             the threat model: accuracy, what it learned from, signed updates
 *
 * `?site=` on overview and patterns limits them to one customer's site. This API has no users:
 * whoever calls it (the dashboard, the website's /lab) decides who may see what, and must pass
 * only the site the signed-in user is allowed. With ATTACK_LAB_TOKEN set, every call needs
 * `Authorization: Bearer <token>`.
 */
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { CustomerPatch, CustomerRegistry } from "./customers";
import { FEATURE_DOCS, FEATURES } from "./model/features";
import type { LiveModel } from "./model/learn";
import type { Verdict } from "./model/net";
import { threatForPattern, THREATS } from "./threats";
import { classify, groupPatterns } from "./patterns";
import { replay, stepsFromTimeline, type ReplayReport, type ReplayStepResult } from "./replay";
import { startSandbox, type Sandbox } from "./sandbox";
import { SCENARIOS, simulate } from "./simulate";
import type { EvidenceStore } from "./store";
import { buildTimeline } from "./timeline";

interface ReplayJob {
  id: string;
  incidentId: string;
  site: string;
  pattern: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "done" | "failed";
  total: number;
  steps: ReplayStepResult[];
  report?: ReplayReport;
  error?: string;
}

export interface LabServerOptions {
  store: EvidenceStore;
  /** The live sandbox the recorder watches. */
  sandbox: Sandbox;
  port: number;
  customers?: CustomerRegistry;
  model?: LiveModel;
  /** Require this bearer token on every call. */
  token?: string;
}

const MAX_JOBS = 20;

export function startLabServer(o: LabServerOptions) {
  const { store, sandbox } = o;
  const jobs = new Map<string, ReplayJob>();
  let simulating = false;

  const timelineOf = (id: string) =>
    buildTimeline(id, store.eventsOf(id), { trapPath: sandbox.trapPath });

  const threatOf = (pattern: string) => {
    const t = threatForPattern(pattern);
    return t && { id: t.id, title: t.title, date: t.date };
  };

  /** The model's verdict on an incident: its riskiest request (signed if recorded with one). */
  function incidentVerdict(id: string) {
    let best: { verdict: Verdict; signed: boolean; eventId: string } | undefined;
    for (const r of store.eventsOf(id)) {
      const v = r.body.model ?? o.model?.scoreEvent(r.body.id);
      if (v && (!best || v.score > best.verdict.score))
        best = { verdict: v, signed: !!r.body.model, eventId: r.body.id };
    }
    return best;
  }

  function modelSummary() {
    const records = store.modelRecords();
    const last = records.at(-1);
    return {
      version: o.model?.weights?.version,
      metrics: o.model?.weights?.metrics,
      trainedAt: o.model?.weights?.trainedAt,
      lastSigned: last && { seq: last.seq, hash: last.hash, at: last.body.trainedAt },
      updates: records.length,
    };
  }

  function overview(site?: string) {
    const incidents = store.listIncidents(site).map((inc) => {
      const t = timelineOf(inc.id);
      const rule = classify(inc, store.eventsOf(inc.id));
      return {
        ...inc,
        eventHashes: undefined,
        pattern: { id: rule.id, name: rule.name },
        steps: t.steps.length,
        durationMs: t.durationMs,
        actions: t.actions,
        sealed: !!store.seal(inc.id),
        threat: threatOf(rule.id),
      };
    });
    const events = incidents.reduce((n, i) => n + i.steps, 0);
    return {
      incidents,
      totals: {
        incidents: incidents.length,
        events,
        flagged: incidents.reduce((n, i) => n + i.flagged, 0),
        records: store.size,
        patterns: new Set(incidents.map((i) => i.pattern.id)).size,
      },
      key: { alg: "ML-DSA-65", keyId: store.signer.keyId, publicKey: store.publicKey },
      model: modelSummary(),
      sandbox: { bare: sandbox.bare, protected: sandbox.protected },
      simulating,
      scenarios: SCENARIOS.map((s) => ({ id: s.id, label: s.label })),
    };
  }

  function incident(id: string) {
    const inc = store.incident(id);
    if (!inc) return undefined;
    const events = store.eventsOf(id);
    const seal = store.seal(id);
    const rule = classify(inc, events);
    return {
      incident: inc,
      pattern: { id: rule.id, name: rule.name, description: rule.description },
      timeline: timelineOf(id),
      events: events.map((r) => ({ seq: r.seq, hash: r.hash, sig: r.sig.slice(0, 24), ...r.body })),
      seal: seal && { seq: seal.seq, hash: seal.hash, covers: seal.body.eventHashes.length },
      check: store.verifyIncident(id),
      key: { alg: "ML-DSA-65", keyId: store.signer.keyId },
      verdict: incidentVerdict(id),
      threat: threatOf(rule.id),
    };
  }

  async function runReplay(job: ReplayJob) {
    const box = await startSandbox();
    try {
      job.report = await replay(
        stepsFromTimeline(timelineOf(job.incidentId)),
        {
          bare: box.bare,
          protected: box.protected,
          canaryKey: box.canaryKey,
          eventsFor: box.eventsFor,
        },
        { onStep: (r) => job.steps.push(r) },
      );
      job.status = "done";
    } catch (e) {
      job.status = "failed";
      job.error = e instanceof Error ? e.message : String(e);
    } finally {
      job.finishedAt = Date.now();
      await box.close();
    }
  }

  function startReplay(incidentId: string): ReplayJob | undefined {
    const inc = store.incident(incidentId);
    if (!inc) return undefined;
    const t = timelineOf(incidentId);
    const job: ReplayJob = {
      id: `rp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      incidentId,
      site: inc.site,
      pattern: classify(inc, store.eventsOf(incidentId)).name,
      startedAt: Date.now(),
      status: "running",
      total: Math.min(t.steps.length, 200),
      steps: [],
    };
    jobs.set(job.id, job);
    while (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value!);
    void runReplay(job);
    return job;
  }

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };

  const readJson = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let s = "";
      req.on("data", (c: Buffer) => {
        s += c;
        if (s.length > 4096) req.destroy();
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(s || "{}"));
        } catch {
          resolve({});
        }
      });
    });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://lab");
    const p = url.pathname;
    const site = url.searchParams.get("site") ?? undefined;
    if (o.token) {
      const got = Buffer.from(String(req.headers.authorization ?? ""));
      const want = Buffer.from(`Bearer ${o.token}`);
      if (got.length !== want.length || !timingSafeEqual(got, want))
        return send(res, 401, { error: "Unauthorised" });
    }
    try {
      if (req.method === "GET" && p === "/api/overview") return send(res, 200, overview(site));
      if (req.method === "GET" && p === "/api/patterns")
        return send(res, 200, {
          patterns: groupPatterns(store.listIncidents(site), (id) => store.eventsOf(id)),
        });
      if (req.method === "GET" && p === "/api/model/profiles")
        return send(res, 200, { profiles: o.model?.scoreProfiles() ?? [], threats: THREATS });
      if (req.method === "GET" && p === "/api/model")
        return send(res, 200, {
          ...modelSummary(),
          features: FEATURES.map((f) => ({ id: f, ...FEATURE_DOCS[f] })),
          history: store
            .modelRecords()
            .slice(-20)
            .reverse()
            .map((r) => ({ seq: r.seq, hash: r.hash, ...r.body })),
          threats: THREATS,
        });
      if (req.method === "GET" && p === "/api/customers")
        return send(res, 200, { customers: o.customers?.list() ?? [] });
      const c = p.match(/^\/api\/customers\/([a-z0-9-]{1,40})$/);
      if (req.method === "PUT" && c && o.customers) {
        const { by, ...patch } = await readJson(req);
        const r = o.customers.update(c[1]!, patch as CustomerPatch, String(by ?? "unknown"));
        return typeof r === "string" ? send(res, 400, { error: r }) : send(res, 200, r);
      }
      if (req.method === "GET" && p === "/api/verify") return send(res, 200, store.verify());
      let m = p.match(/^\/api\/incidents\/(inc_\d+)$/);
      if (req.method === "GET" && m) {
        const r = incident(m[1]!);
        return r ? send(res, 200, r) : send(res, 404, { error: "No such incident" });
      }
      m = p.match(/^\/api\/records\/(\d+)$/);
      if (req.method === "GET" && m) {
        const r = store.record(Number(m[1]));
        return r ? send(res, 200, r) : send(res, 404, { error: "No such record" });
      }
      if (req.method === "POST" && p === "/api/replay") {
        const { incidentId } = await readJson(req);
        const job = typeof incidentId === "string" ? startReplay(incidentId) : undefined;
        return job ? send(res, 202, { id: job.id }) : send(res, 404, { error: "No such incident" });
      }
      if (req.method === "GET" && p === "/api/replays")
        return send(res, 200, {
          replays: [...jobs.values()].reverse().map(({ steps, report, ...j }) => ({
            ...j,
            done: steps.length,
            summary: report?.summary,
          })),
        });
      m = p.match(/^\/api\/replays\/(rp_[a-z0-9]+)$/);
      if (req.method === "GET" && m) {
        const j = jobs.get(m[1]!);
        return j ? send(res, 200, j) : send(res, 404, { error: "No such replay" });
      }
      if (req.method === "POST" && p === "/api/simulate") {
        if (simulating) return send(res, 409, { error: "Test traffic is already running" });
        const { scenarios, site: one } = await readJson(req);
        const sites = o.customers?.sites() ?? [];
        simulating = true;
        void simulate(
          sandbox.protected,
          sandbox,
          Array.isArray(scenarios) ? scenarios.map(String) : undefined,
          typeof one === "string" && sites.includes(one) ? [one] : sites,
        ).finally(() => {
          simulating = false;
          store.sealDirty();
        });
        return send(res, 202, { started: true });
      }
      return send(res, 404, { error: "Not found" });
    } catch (e) {
      return send(res, 500, { error: e instanceof Error ? e.message : "error" });
    }
  });

  return new Promise<{ url: string; close(): Promise<void> }>((resolve, reject) => {
    server.on("error", reject);
    server.listen(o.port, "127.0.0.1", () => {
      const a = server.address();
      resolve({
        url: `http://127.0.0.1:${typeof a === "object" && a ? a.port : o.port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
