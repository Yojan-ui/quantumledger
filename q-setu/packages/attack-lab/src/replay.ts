/**
 * Replay: sends an incident's recorded steps, in order and with its timing (gaps capped), to a bare
 * and a Shield-protected copy of the sandbox side by side, and reports what each did with every step.
 *
 * What a replay can and can't reproduce: the method, route, order and pacing, and the client family
 * (as a representative user agent). Not the original bodies (never recorded; writes send `{}`), not
 * the original IP (each replay uses one documentation-range address), and not the TLS fingerprint
 * (the sandbox is plain HTTP on loopback). Every request passes the host guard first.
 */
import { sandboxUrl, assertSandbox } from "./hostguard";
import { SYNTHETIC_HEADER } from "./detect";
import type { Timeline } from "./timeline";
import type { ClientFamily, Phase } from "./types";

export interface ReplayStep {
  i: number;
  method: string;
  route: string;
  client: ClientFamily;
  offsetMs: number;
  phase: Phase;
  /** The original request used the canary key: the replay presents the sandbox's own canary. */
  canary: boolean;
}

export type BareOutcome = "served" | "not found" | "error";
export type ProtectedOutcome = "passed" | "blocked" | "challenged" | "limited" | "error";

export interface ReplayStepResult extends ReplayStep {
  bare: { status: number; ms: number; outcome: BareOutcome };
  protected: { status: number; ms: number; outcome: ProtectedOutcome; signals: string[] };
}

export interface ReplayReport {
  steps: ReplayStepResult[];
  summary: {
    bare: Record<BareOutcome, number>;
    protected: Record<ProtectedOutcome, number>;
    /** Index of the first step the protected copy refused. */
    firstStop?: number;
  };
  notes: string[];
}

const UA: Record<ClientFamily, string | undefined> = {
  browser:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  headless:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
  script: "python-requests/2.32.3",
  "ai-agent":
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "search-bot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  other: "Java/17.0.2",
  none: undefined,
};

export const MAX_REPLAY_STEPS = 200;

export function stepsFromTimeline(t: Timeline): ReplayStep[] {
  return t.steps.slice(0, MAX_REPLAY_STEPS).map((s) => ({
    i: s.i,
    method: s.method,
    route: s.route,
    client: s.client,
    offsetMs: s.offsetMs,
    phase: s.phase,
    canary: s.types.includes("canary") || s.route.includes("[canary]"),
  }));
}

export interface ReplayTargets {
  bare: string;
  protected: string;
  /** The sandbox's canary key, presented where the original used one. */
  canaryKey?: string;
  /** Shield's events for a step, when the sandbox can tap them. */
  eventsFor?: (step: string) => { type: string; reasons: string[] }[];
}

export interface ReplayOptions {
  /** One address from a documentation range, sent as X-Forwarded-For. */
  ip?: string;
  /** Gaps longer than this are shortened (default 400 ms), so a replay takes seconds, not hours. */
  maxGapMs?: number;
  onStep?: (r: ReplayStepResult) => void;
  fetch?: typeof fetch;
}

function headersFor(s: ReplayStep, ip: string, canaryKey: string | undefined, run: string) {
  const h: Record<string, string> = {
    "x-forwarded-for": ip,
    [SYNTHETIC_HEADER]: "1",
    "x-attack-lab-step": `${run}:${s.i}`,
  };
  const ua = UA[s.client];
  if (ua) h["user-agent"] = ua;
  if (s.client === "browser") {
    h.accept = "text/html,application/xhtml+xml";
    h["accept-language"] = "en-GB,en;q=0.9";
    h["sec-fetch-mode"] = "navigate";
  } else h.accept = "*/*";
  if (s.canary && canaryKey) h["x-api-key"] = canaryKey;
  if (s.method !== "GET" && s.method !== "HEAD") h["content-type"] = "application/json";
  return h;
}

async function send(
  f: typeof fetch,
  url: string,
  s: ReplayStep,
  headers: Record<string, string>,
): Promise<{ status: number; ms: number; html: boolean }> {
  const t = performance.now();
  try {
    const r = await f(url, {
      method: s.method,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      ...(s.method !== "GET" && s.method !== "HEAD" ? { body: "{}" } : {}),
    });
    await r.arrayBuffer();
    return {
      status: r.status,
      ms: Math.round(performance.now() - t),
      html: (r.headers.get("content-type") ?? "").includes("text/html"),
    };
  } catch {
    return { status: 0, ms: Math.round(performance.now() - t), html: false };
  }
}

const bareOutcome = (status: number): BareOutcome =>
  status === 0 ? "error" : status === 404 ? "not found" : status < 400 ? "served" : "error";

function protectedOutcome(status: number, html: boolean, types: string[]): ProtectedOutcome {
  if (status === 0) return "error";
  if (types.some((t) => t === "block" || t === "honeypot" || t === "trap" || t === "canary"))
    return "blocked";
  if (status === 429) return "limited";
  if (status === 403 && html && types.includes("challenge")) return "challenged";
  if (status === 403) return "blocked";
  return "passed";
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function replay(
  steps: ReplayStep[],
  targets: ReplayTargets,
  o: ReplayOptions = {},
): Promise<ReplayReport> {
  // Refuse before anything is sent.
  assertSandbox(targets.bare);
  assertSandbox(targets.protected);
  const f = o.fetch ?? fetch;
  const ip = o.ip ?? `198.51.100.${1 + Math.floor(Math.random() * 254)}`;
  const run = Math.random().toString(36).slice(2, 8);
  const maxGap = o.maxGapMs ?? 400;
  const out: ReplayStepResult[] = [];
  let last = steps[0]?.offsetMs ?? 0;
  for (const s of steps.slice(0, MAX_REPLAY_STEPS)) {
    const gap = Math.min(maxGap, Math.max(0, s.offsetMs - last));
    last = s.offsetMs;
    if (gap) await wait(gap);
    const route = s.route.split("[canary]").join(targets.canaryKey ?? "canary");
    const headers = headersFor(s, ip, targets.canaryKey, run);
    const [b, p] = await Promise.all([
      send(f, sandboxUrl(targets.bare, route), s, headers),
      send(f, sandboxUrl(targets.protected, route), s, headers),
    ]);
    const events = targets.eventsFor?.(`${run}:${s.i}`) ?? [];
    const types = events.map((e) => e.type);
    const r: ReplayStepResult = {
      ...s,
      bare: { status: b.status, ms: b.ms, outcome: bareOutcome(b.status) },
      protected: {
        status: p.status,
        ms: p.ms,
        outcome: protectedOutcome(p.status, p.html, types),
        signals: [...new Set(events.flatMap((e) => e.reasons))],
      },
    };
    out.push(r);
    o.onStep?.(r);
  }
  const count = <K extends string>(keys: K[], pick: (r: ReplayStepResult) => K) =>
    Object.fromEntries(keys.map((k) => [k, out.filter((r) => pick(r) === k).length])) as Record<
      K,
      number
    >;
  const stop = out.findIndex(
    (r) => r.protected.outcome !== "passed" && r.protected.outcome !== "error",
  );
  return {
    steps: out,
    summary: {
      bare: count(["served", "not found", "error"], (r) => r.bare.outcome),
      protected: count(
        ["passed", "blocked", "challenged", "limited", "error"],
        (r) => r.protected.outcome,
      ),
      ...(stop >= 0 ? { firstStop: stop } : {}),
    },
    notes: [
      "Bodies were never recorded: write requests replay with an empty JSON body.",
      `All steps came from one documentation-range address (${ip}), sent as X-Forwarded-For.`,
      "TLS fingerprints aren't replayed: the sandbox is plain HTTP on loopback.",
      `Gaps between steps longer than ${maxGap} ms were shortened.`,
    ],
  };
}
