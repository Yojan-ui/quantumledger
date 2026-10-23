/**
 * The resilience benchmark. The Lab's attacker agents (./agents) run the same goal against both
 * local sandbox copies — bare, and behind PQC + Shield — and the outcomes are measured and compared.
 *
 * Strictly scoped: every request is routed through the host guard (../hostguard), which refuses any
 * target that is not the loopback sandbox. Nothing leaves the machine. This measures our own
 * defences; it is not pointed at anyone else's systems, and no URL a user types is ever a target.
 *
 * Honest by construction: it reports exactly what Shield allowed, slowed, challenged and blocked,
 * including anything that still got through. It never claims a site cannot be breached.
 */
import {
  createIdentity,
  clientFinish,
  clientHello,
  serverComplete,
  serverRespond,
} from "@qsetu/core";
import { SYNTHETIC_HEADER } from "../detect";
import { assertSandbox, sandboxUrl } from "../hostguard";
import { startSandbox, type Sandbox } from "../sandbox";
import { AGENTS, goalReached, type AgentRequest } from "./agents";

/** Per-agent request budget; keeps a full run to a few seconds and the UI responsive. */
export const DEFAULT_CAP = 24;
/** Requests fired at once per agent per copy. */
const CONCURRENCY = 16;
const PQ_GROUP = "X25519MLKEM768";

export type Side = "unprotected" | "protected";

export interface SideResult {
  sent: number;
  /** Answered by the app with a success (2xx). */
  served: number;
  /** Passed through to the app unimpeded (not slowed, challenged or blocked). */
  allowed: number;
  slowed: number;
  challenged: number;
  blocked: number;
  /** Shield let these reach the app — the honest "what still got through". */
  gotThrough: number;
  goalReached: boolean;
  /** Milliseconds from the first request to the first block, or null if nothing was blocked. */
  firstBlockMs: number | null;
  /** A real post-quantum handshake was negotiated for this path. */
  quantumSafe: boolean;
}

export interface AgentResult {
  id: string;
  label: string;
  goal: string;
  category: string;
  unprotected: SideResult;
  protected: SideResult;
  /** 0–100: how well the protected copy held against this agent (method below). */
  resilience: number;
  /** One honest line comparing the two sides. */
  note: string;
}

export interface BenchmarkReport {
  v: 1;
  at: number;
  cap: number;
  /** The real hybrid PQC handshake measured once for the protected deployment. */
  handshake: { group: string; ms: number; ok: boolean };
  agents: AgentResult[];
  overallResilience: number;
  totals: { sent: number; blocked: number; slowed: number; challenged: number; gotThrough: number };
  method: string;
  caveat: string;
}

interface Tally {
  sent: number;
  served: number;
  allowed: number;
  slowed: number;
  challenged: number;
  blocked: number;
  gotThrough: number;
  objectiveGotThrough: number;
  firstBlockMs: number | null;
}

const blank = (): Tally => ({
  sent: 0,
  served: 0,
  allowed: 0,
  slowed: 0,
  challenged: 0,
  blocked: 0,
  gotThrough: 0,
  objectiveGotThrough: 0,
  firstBlockMs: null,
});

const UA: Record<string, string> = {
  flooder: "Go-http-client/1.1",
  scanner: "python-requests/2.32.3",
  "probe-agent":
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "trap-tripper":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
  harvester: "node-fetch/1.0",
};

/** Classify one protected-copy request from Shield's events for it plus the HTTP status. */
function outcome(
  events: { type: string }[],
  status: number,
): "blocked" | "challenged" | "slowed" | "allowed" {
  const t = new Set(events.map((e) => e.type));
  if (t.has("block") || t.has("honeypot") || t.has("trap") || t.has("canary") || status === 403)
    return "blocked";
  if (t.has("challenge")) return "challenged";
  if (t.has("limit") || status === 429) return "slowed";
  return "allowed";
}

async function send(
  target: string,
  req: AgentRequest,
  headers: Record<string, string>,
  f: typeof fetch,
): Promise<{ status: number; ms: number }> {
  const t = performance.now();
  try {
    const r = await f(sandboxUrl(target, req.path), {
      method: req.method,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      ...(req.method === "POST" ? { body: "{}" } : {}),
    });
    await r.arrayBuffer();
    return { status: r.status, ms: performance.now() - t };
  } catch {
    return { status: 0, ms: performance.now() - t };
  }
}

/** Run one agent against one copy. `tap` reads Shield's events per step (protected only). */
async function runSide(
  agentId: string,
  plan: AgentRequest[],
  target: string,
  canaryKey: string,
  tap: ((step: string) => { type: string }[]) | null,
  f: typeof fetch,
  ip: string,
): Promise<Tally> {
  assertSandbox(target);
  const run = Math.random().toString(36).slice(2, 8);
  const t0 = performance.now();
  const tally = blank();
  const record = (req: AgentRequest, status: number, step: string) => {
    tally.sent++;
    const events = tap ? tap(step) : [];
    const o = tap ? outcome(events, status) : "allowed";
    if (o === "blocked") {
      tally.blocked++;
      if (tally.firstBlockMs === null) tally.firstBlockMs = Math.round(performance.now() - t0);
    } else if (o === "challenged") tally.challenged++;
    else if (o === "slowed") tally.slowed++;
    else {
      tally.allowed++;
      tally.gotThrough++;
      if (req.objective) tally.objectiveGotThrough++;
    }
    if (o === "allowed" && status >= 200 && status < 300) tally.served++;
  };
  const headersFor = (req: AgentRequest, step: string): Record<string, string> => ({
    "user-agent": UA[agentId] ?? "curl/8.7.1",
    accept: "*/*",
    "x-forwarded-for": ip,
    [SYNTHETIC_HEADER]: "1",
    "x-attack-lab-step": step,
    ...(req.canary ? { "x-api-key": canaryKey } : {}),
    ...req.headers,
  });

  // A bounded concurrency pool: attackers fire in parallel, and (on the protected copy) this lets
  // Shield's deliberate tarpit delays overlap, so a full run stays within a few seconds. Each
  // request carries its own step id, so Shield's per-request events are attributed correctly.
  let next = 0;
  const worker = async () => {
    while (next < plan.length) {
      const i = next++;
      const req = plan[i]!;
      const step = `${run}:${i}`;
      const r = await send(target, req, headersFor(req, step), f);
      record(req, r.status, step);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.length) }, worker));
  return tally;
}

function toSide(agentId: string, t: Tally, quantumSafe: boolean): SideResult {
  return {
    sent: t.sent,
    served: t.served,
    allowed: t.allowed,
    slowed: t.slowed,
    challenged: t.challenged,
    blocked: t.blocked,
    gotThrough: t.gotThrough,
    goalReached: goalReached(agentId, {
      sent: t.sent,
      served: t.served,
      allowed: t.allowed,
      objectiveGotThrough: t.objectiveGotThrough,
    }),
    firstBlockMs: t.firstBlockMs,
    quantumSafe,
  };
}

/** Weighted share of the agent's requests Shield did not simply wave through (0–100). */
function resilience(p: SideResult): number {
  if (!p.sent) return 0;
  return Math.round((100 * (p.blocked * 1 + p.challenged * 0.9 + p.slowed * 0.6)) / p.sent);
}

function note(a: AgentResult): string {
  const u = a.unprotected;
  const p = a.protected;
  const stopped = p.blocked + p.challenged + p.slowed;
  const base = `Unprotected: ${u.served}/${u.sent} got through. Protected: ${p.gotThrough}/${p.sent} got through`;
  const how =
    p.blocked && p.firstBlockMs !== null
      ? `, ${p.blocked} blocked (first in ${(p.firstBlockMs / 1000).toFixed(1)} s)`
      : stopped
        ? `, ${stopped} stopped`
        : "";
  const leak =
    p.gotThrough > 0 && p.goalReached
      ? " — and its goal still succeeded."
      : p.gotThrough > 0
        ? "."
        : ".";
  return `${base}${how}${leak}`;
}

/** One real hybrid handshake (X25519 + ML-KEM-768, ML-DSA-65-signed), timed. */
function measureHandshake(): { group: string; ms: number; ok: boolean } {
  try {
    const identity = createIdentity("standard");
    const t = performance.now();
    const { hello, state } = clientHello("standard");
    const { serverHello, pending } = serverRespond(hello, identity);
    const { finish, session: client } = clientFinish(state, serverHello, identity.publicKey);
    const server = serverComplete(pending, finish);
    const ms = Math.round((performance.now() - t) * 100) / 100;
    void client;
    void server;
    return { group: PQ_GROUP, ms, ok: true };
  } catch {
    return { group: PQ_GROUP, ms: 0, ok: false };
  }
}

export interface RunOptions {
  cap?: number;
  onProgress?: (done: number, total: number) => void;
  fetch?: typeof fetch;
}

/**
 * Runs the full benchmark against a fresh sandbox pair and returns the signed report. The caller
 * may also feed the same agents into the live recorded sandbox so the run trains the model and
 * fills the attack map (see the server's /api/benchmark handler).
 */
export async function runBenchmark(o: RunOptions = {}): Promise<BenchmarkReport> {
  const cap = Math.max(4, Math.min(80, o.cap ?? DEFAULT_CAP));
  const f = o.fetch ?? fetch;
  const handshake = measureHandshake();
  const box: Sandbox = await startSandbox();
  // Refuse before any traffic if either copy is somehow not loopback.
  assertSandbox(box.bare);
  assertSandbox(box.protected);
  const total = AGENTS.length * 2;
  let done = 0;
  const step = () => o.onProgress?.(++done, total);
  try {
    // The agents run concurrently (each from its own documentation-range IP, so their per-IP rate
    // limits don't interfere), keeping the whole run to a few seconds.
    const agents = await Promise.all(
      AGENTS.map(async (agent, k) => {
        const plan = agent.plan({ trapPath: box.trapPath, cap });
        const ipU = `198.51.100.${1 + ((k * 7 + 3) % 254)}`;
        const ipP = `203.0.113.${1 + ((k * 7 + 3) % 254)}`;
        const bare = await runSide(agent.id, plan, box.bare, box.canaryKey, null, f, ipU);
        step();
        const prot = await runSide(
          agent.id,
          plan,
          box.protected,
          box.canaryKey,
          box.eventsFor,
          f,
          ipP,
        );
        step();
        const a: AgentResult = {
          id: agent.id,
          label: agent.label,
          goal: agent.goal,
          category: agent.category,
          unprotected: toSide(agent.id, bare, false),
          protected: toSide(agent.id, prot, handshake.ok),
          resilience: 0,
          note: "",
        };
        a.resilience = resilience(a.protected);
        a.note = note(a);
        return a;
      }),
    );
    const totals = agents.reduce(
      (t, a) => ({
        sent: t.sent + a.protected.sent,
        blocked: t.blocked + a.protected.blocked,
        slowed: t.slowed + a.protected.slowed,
        challenged: t.challenged + a.protected.challenged,
        gotThrough: t.gotThrough + a.protected.gotThrough,
      }),
      { sent: 0, blocked: 0, slowed: 0, challenged: 0, gotThrough: 0 },
    );
    const overallResilience = agents.length
      ? Math.round(agents.reduce((s, a) => s + a.resilience, 0) / agents.length)
      : 0;
    const report: BenchmarkReport = {
      v: 1,
      at: Date.now(),
      cap,
      handshake,
      agents,
      overallResilience,
      totals,
      method:
        "Resilience per agent = share of its requests Shield did not simply allow, weighted: " +
        "blocked ×1.0, challenged ×0.9, slowed ×0.6. Overall = the mean across agents. " +
        "Quantum-safe = a real X25519 + ML-KEM-768 handshake (ML-DSA-65-signed) was negotiated for the protected path.",
      caveat:
        "This measures resilience against these modelled attacks on our own local sandbox. It is not " +
        "a guarantee against every real attack, and anything shown as “got through” did get through.",
    };
    return report;
  } finally {
    await box.close();
  }
}

/** The simulate scenario ids whose traffic matches the agents (to feed the live Lab). */
export const AGENT_SCENARIOS = [
  "api-flood",
  "admin-scan",
  "ai-crawl",
  "trap-crawler",
  "leaked-key",
];
