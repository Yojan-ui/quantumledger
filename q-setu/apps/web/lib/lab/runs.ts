/**
 * Lab runs: validate -> scan (one unit per input) -> plan -> sign -> verify, executed in-process with
 * real calls only (scan(), cachedScan()/scanHost(), buildPlan(), ledger.append(), ledger.verify()).
 * Every step emits events (stage, progress, log, file, url, result | error | cancelled) that the SSE
 * route replays and streams. Progress is a count of finished units, never a timer.
 * One active run per workspace (a second gets 409). Cancel takes effect between units; a live TLS probe
 * already in flight cannot be interrupted (scanHost takes no abort signal) and is logged as such.
 */
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { buildPlan, type Plan } from "@/lib/live/plan";
import { scan, SEVERITY_WEIGHT, type ScanResult } from "@qsetu/core";
import webPkg from "@/package.json";
import corePkg from "../../../../packages/core/package.json";
import { sha256, type ResolvedInput, type RunBody } from "./inputs";
import { isId, labRoot, newId, readRun, saveRun } from "./workspace";

export const LAB_RUN_NOTE =
  "Lab run record: SHA-256 of the scanned inputs and of the result. A code scan carries no TLS transcript; this entry is not handshake evidence.";
export const STAGES = ["validate", "scan", "plan", "sign", "verify"] as const;
type StageName = (typeof STAGES)[number];
export type RunStatus = "queued" | "running" | "done" | "failed" | "cancelled";
const TERMINAL: RunStatus[] = ["done", "failed", "cancelled"];

export interface LabEvent {
  seq: number;
  type: string;
  data: Record<string, unknown>;
}
export interface FileResult extends ScanResult {
  index: number;
  name: string;
  source: ResolvedInput["source"];
  sha256: string;
  bytes: number;
  lines: number;
  sampleLabel?: string;
}
export interface RunRecord {
  runId: string;
  workspace: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  version: { app: string; core: string; commit: string | null };
  params: { dataLifetimeYears: number; hybridPq: boolean | null };
  inputs: Omit<ResolvedInput, "text">[];
  inputSha256: string;
  stages: {
    name: StageName;
    status: "pending" | "running" | "done" | "failed" | "skipped";
    ms: number | null;
  }[];
  progress: { done: number; total: number };
  files: FileResult[];
  url: (Record<string, unknown> & { mode: "cached" | "live" }) | null;
  plan: Plan | null;
  ledger: {
    entryId: number;
    hash: string;
    kind: "lab-run";
    note: string;
    verify: Record<string, unknown> | null;
  } | null;
  resultSha256: string | null;
  log: { t: string; stage: string; message: string }[];
  error: { code: string; message: string } | null;
  events: LabEvent[];
}

let commit: string | null | undefined;
function gitCommit(): string | null {
  if (commit !== undefined) return commit;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    commit = null;
  }
  return commit;
}

/** Stable JSON (sorted keys) so the result hash does not depend on key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

interface Active {
  rec: RunRecord;
  emitter: EventEmitter;
  cancel: boolean;
  texts: Map<number, string>;
}
const g = globalThis as unknown as {
  __qsetuLabRuns?: Map<string, Active>;
  __qsetuLabActiveByWs?: Map<string, string>;
};
const active = (g.__qsetuLabRuns ??= new Map());
const activeByWs = (g.__qsetuLabActiveByWs ??= new Map());

export function activeRunFor(ws: string): string | undefined {
  return activeByWs.get(ws);
}

export function findRun(runId: string): RunRecord | undefined {
  if (!isId(runId)) return undefined;
  const a = active.get(runId);
  if (a) return a.rec;
  const root = labRoot();
  if (!existsSync(root)) return undefined;
  for (const ws of readdirSync(root)) {
    if (!isId(ws)) continue;
    const r = readRun<RunRecord>(ws, runId);
    if (r) return r;
  }
  return undefined;
}

export function subscribe(runId: string, fn: (e: LabEvent) => void): () => void {
  const a = active.get(runId);
  if (!a) return () => {};
  a.emitter.on("event", fn);
  return () => a.emitter.off("event", fn);
}

export function cancelRun(runId: string): RunRecord | undefined {
  const a = active.get(runId);
  if (a) a.cancel = true;
  return a?.rec ?? findRun(runId);
}

export interface RunDeps {
  ledger: {
    append(
      kind: string,
      subject: string,
      payload: Record<string, unknown>,
    ): Promise<{ id: number; hash: string }>;
    verify(): Promise<unknown>;
  };
  urlScan: (input: ResolvedInput) => Promise<Record<string, unknown>>;
}

/** Starts a run; returns undefined when the workspace already has an active run (caller answers 409). */
export function startRun(
  ws: string,
  body: RunBody,
  inputs: ResolvedInput[],
  deps: RunDeps,
): RunRecord | undefined {
  if (activeByWs.has(ws)) return undefined;
  const runId = newId();
  const rec: RunRecord = {
    runId,
    workspace: ws,
    status: "queued",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    version: {
      app: `@qsetu/web ${webPkg.version}`,
      core: `@qsetu/core ${corePkg.version}`,
      commit: gitCommit(),
    },
    params: { dataLifetimeYears: body.dataLifetimeYears, hybridPq: body.hybridPq ?? null },
    inputs: inputs.map(({ text: _t, ...rest }) => rest),
    inputSha256: sha256(
      inputs
        .map((i) => i.sha256)
        .sort()
        .join("\n"),
    ),
    stages: STAGES.map((name) => ({ name, status: "pending" as const, ms: null })),
    progress: { done: 0, total: inputs.length + 4 },
    files: [],
    url: null,
    plan: null,
    ledger: null,
    resultSha256: null,
    log: [],
    error: null,
    events: [],
  };
  const a: Active = {
    rec,
    emitter: new EventEmitter(),
    cancel: false,
    texts: new Map(inputs.map((i) => [i.index, i.text ?? ""])),
  };
  a.emitter.setMaxListeners(50);
  active.set(runId, a);
  activeByWs.set(ws, runId);
  setImmediate(() => void execute(a, inputs, deps));
  return rec;
}

function emit(a: Active, type: string, data: Record<string, unknown>) {
  const e = { seq: a.rec.events.length + 1, type, data };
  a.rec.events.push(e);
  a.emitter.emit("event", e);
}
function log(a: Active, stage: string, message: string) {
  const entry = { t: new Date().toISOString(), stage, message };
  a.rec.log.push(entry);
  emit(a, "log", entry);
}
function tick(a: Active) {
  a.rec.progress.done++;
  emit(a, "progress", { ...a.rec.progress });
}
const yieldTurn = () => new Promise<void>((r) => setImmediate(r));

let warnedProdDelay = false;
/**
 * Test-only slow path: LAB_TEST_DELAY_MS (0-5000) waits that long before each scan unit and before the plan,
 * so browser tests can hit Cancel. Off by default; ignored (with one warning) in production builds.
 */
export function testDelayMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LAB_TEST_DELAY_MS;
  if (!raw) return 0;
  if (env.NODE_ENV === "production") {
    if (!warnedProdDelay) console.warn("LAB_TEST_DELAY_MS is ignored in production builds");
    warnedProdDelay = true;
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(5000, Math.round(n))) : 0;
}
const testDelay = () => {
  const ms = testDelayMs();
  return ms ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve();
};

async function stage<T>(a: Active, name: StageName, fn: () => Promise<T>): Promise<T> {
  const st = a.rec.stages.find((s) => s.name === name)!;
  st.status = "running";
  emit(a, "stage", { name, status: "running" });
  const t = performance.now();
  try {
    const out = await fn();
    st.status = "done";
    st.ms = performance.now() - t;
    emit(a, "stage", { name, status: "done", ms: st.ms });
    return out;
  } catch (e) {
    st.status = "failed";
    st.ms = performance.now() - t;
    emit(a, "stage", { name, status: "failed", ms: st.ms });
    throw e;
  }
}

class Cancelled extends Error {}
function checkCancel(a: Active) {
  if (a.cancel) throw new Cancelled();
}

async function execute(a: Active, inputs: ResolvedInput[], deps: RunDeps) {
  const t0 = performance.now();
  const r = a.rec;
  r.status = "running";
  emit(a, "status", { status: "running" });
  try {
    await stage(a, "validate", async () => {
      log(
        a,
        "validate",
        `${inputs.length} input(s), ${inputs.reduce((s, i) => s + i.bytes, 0)} bytes, input SHA-256 ${r.inputSha256}`,
      );
      tick(a);
    });
    await stage(a, "scan", async () => {
      for (const inp of inputs) {
        checkCancel(a);
        await yieldTurn();
        await testDelay();
        checkCancel(a);
        if (inp.source === "url") {
          if (inp.probeLive)
            log(
              a,
              "scan",
              `live TLS probe of ${inp.name} (contacts the host; cannot be cancelled once started)`,
            );
          const t = performance.now();
          const rec = await deps.urlScan(inp);
          r.url = { ...rec, mode: inp.probeLive ? "live" : "cached" } as RunRecord["url"];
          emit(a, "url", {
            index: inp.index,
            host: inp.name,
            mode: r.url!.mode,
            score: rec.score,
            grade: rec.grade,
            cached: rec.cached ?? false,
          });
          log(
            a,
            "scan",
            `${inp.name}: ${rec.grade} (score ${rec.score}) from a ${r.url!.mode === "live" ? "live probe" : "cached real scan"} in ${(performance.now() - t).toFixed(1)} ms`,
          );
        } else {
          const t = performance.now();
          const res = scan(a.texts.get(inp.index) ?? "", inp.name);
          const ms = performance.now() - t;
          const { text: _t, ...meta } = inp;
          const file: FileResult = { ...meta, ...res };
          r.files.push(file);
          emit(a, "file", {
            index: inp.index,
            name: inp.name,
            score: res.score,
            grade: res.grade,
            summary: res.summary,
            findings: res.findings.length,
            lines: inp.lines,
            // positions for the live 3D lattice: the same fields the scene endpoint serves later
            positions: res.findings.map((x, n) => ({
              n,
              line: x.line,
              severity: x.severity,
              weight: SEVERITY_WEIGHT[x.severity],
              quantumSafe: x.quantumSafe,
            })),
            ms,
          });
          log(
            a,
            "scan",
            `${inp.name}: ${res.grade} (score ${res.score}), ${res.findings.length} finding(s) in ${ms.toFixed(1)} ms`,
          );
        }
        tick(a);
      }
    });
    await testDelay();
    checkCancel(a);
    await stage(a, "plan", async () => {
      const urlFindings = (r.url?.findings as ScanResult["findings"] | undefined) ?? [];
      const all = [...r.files.flatMap((f) => f.findings), ...urlFindings];
      const capped = all.slice(0, 2000);
      if (all.length > capped.length)
        log(a, "plan", `plan built from the first 2000 of ${all.length} findings (plan limit)`);
      const source = r.files.length ? "code" : "url";
      const hybridPq =
        r.params.hybridPq ?? (r.url?.probe as { hybridPq?: boolean } | undefined)?.hybridPq;
      r.plan = buildPlan({
        findings: capped.map(
          ({ ruleId, line, algorithm, primitive, severity, quantumVulnerable, match }) => ({
            ruleId,
            line,
            algorithm,
            primitive,
            severity,
            quantumVulnerable,
            match,
          }),
        ),
        dataLifetimeYears: r.params.dataLifetimeYears,
        source,
        ...(hybridPq === undefined ? {} : { hybridPq }),
      });
      log(
        a,
        "plan",
        `${r.plan.steps.length} step(s); horizon ${r.plan.assumptions.horizonYear}, ${r.plan.assumptions.yearsLeft} years left`,
      );
      tick(a);
    });
    checkCancel(a);
    r.resultSha256 = sha256(canonical({ files: r.files, url: r.url, plan: r.plan }));
    await stage(a, "sign", async () => {
      const e = await deps.ledger.append(
        "lab-run",
        `lab run ${r.runId} · ${inputs.length} input(s) · code scan, no TLS transcript`,
        {
          runId: r.runId,
          workspace: r.workspace,
          inputSha256: r.inputSha256,
          resultSha256: r.resultSha256,
          files: r.files.map((f) => ({
            name: f.name,
            sha256: f.sha256,
            score: f.score,
            grade: f.grade,
            findings: f.findings.length,
          })),
          url: r.url
            ? {
                host: r.inputs.find((i) => i.source === "url")?.name,
                mode: r.url.mode,
                score: r.url.score,
                grade: r.url.grade,
              }
            : null,
          note: LAB_RUN_NOTE,
        },
      );
      r.ledger = { entryId: e.id, hash: e.hash, kind: "lab-run", note: LAB_RUN_NOTE, verify: null };
      emit(a, "ledger", { entryId: e.id, hash: e.hash, verify: null });
      log(a, "sign", `Proof Chain entry #${e.id} (lab-run, ML-DSA-65 signed) hash ${e.hash}`);
      tick(a);
    });
    await stage(a, "verify", async () => {
      const v = (await deps.ledger.verify()) as Record<string, unknown>;
      r.ledger!.verify = v;
      emit(a, "ledger", {
        entryId: r.ledger!.entryId,
        hash: r.ledger!.hash,
        verify: {
          ok: v.ok,
          checked: v.checked,
          brokenId: (v.broken as { id?: number } | undefined)?.id ?? null,
        },
      });
      log(
        a,
        "verify",
        v.ok
          ? `Proof Chain verified: ${v.checked} entries`
          : `Proof Chain verification FAILED at #${(v.broken as { id?: number } | undefined)?.id}`,
      );
      tick(a);
    });
    r.status = "done";
  } catch (e) {
    if (e instanceof Cancelled) {
      r.status = "cancelled";
      for (const s of r.stages)
        if (s.status === "pending" || s.status === "running") s.status = "skipped";
      log(a, "run", "cancelled by the user");
    } else {
      r.status = "failed";
      r.error = { code: "run_failed", message: (e as Error).message };
      for (const s of r.stages) if (s.status === "pending") s.status = "skipped";
      log(a, "run", `failed: ${(e as Error).message}`);
    }
  } finally {
    r.finishedAt = new Date().toISOString();
    r.durationMs = performance.now() - t0;
    emit(a, r.status === "done" ? "result" : r.status === "cancelled" ? "cancelled" : "error", {
      status: r.status,
      runId: r.runId,
      durationMs: r.durationMs,
      ...(r.error ? { error: r.error } : {}),
    });
    saveRun(r.workspace, r);
    active.delete(r.runId);
    activeByWs.delete(r.workspace);
    a.emitter.emit("end");
    a.emitter.removeAllListeners();
  }
}

export const isTerminal = (s: RunStatus) => TERMINAL.includes(s);

/** Summary for lists (no findings, events or log). */
export function summarize(r: RunRecord) {
  return {
    runId: r.runId,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    durationMs: r.durationMs,
    inputSha256: r.inputSha256,
    inputs: r.inputs.map((i) => ({ name: i.name, source: i.source, bytes: i.bytes })),
    files: r.files.map((f) => ({
      name: f.name,
      score: f.score,
      grade: f.grade,
      findings: f.findings.length,
      summary: f.summary,
    })),
    url: r.url ? { mode: r.url.mode, score: r.url.score, grade: r.url.grade } : null,
    planSteps: r.plan?.steps.length ?? null,
    ledgerEntry: r.ledger?.entryId ?? null,
    ledgerOk: (r.ledger?.verify as { ok?: boolean } | null)?.ok ?? null,
  };
}
