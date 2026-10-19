/**
 * Shared rate limiting for the API. Each route names its limits (e.g. scans: 10 a minute and 100 a
 * day per client); `take()` records one hit against all of them and reports the first one exceeded.
 * With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, counts live in Upstash Redis
 * (shared across instances, fixed windows). Otherwise, or if Upstash is unreachable, they live in
 * this process (sliding windows): fine for one node, and never fail-open.
 */
import { clientIp, RateLimiter } from "@/lib/live/rate-limit";

export interface Limit {
  /** A stable name; also the counter's key prefix. */
  name: string;
  limit: number;
  windowMs: number;
  /** Whose budget: the client (its demo session if it has one, else its IP; the default), or
   * always the IP (a ceiling that new sessions can't reset). */
  per?: "client" | "ip";
}

export type Verdict = { ok: true } | { ok: false; retryAfter: number; limit: Limit };

const g = globalThis as unknown as { __qlLimiters?: Map<string, RateLimiter> };
const memory = (g.__qlLimiters ??= new Map());

function memoryTake(key: string, l: Limit): number {
  let rl = memory.get(l.name);
  if (!rl) memory.set(l.name, (rl = new RateLimiter(l.limit, l.windowMs)));
  return rl.take(key);
}

async function upstashTake(key: string, l: Limit): Promise<number | undefined> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  const window = Math.floor(Date.now() / l.windowMs);
  const k = `rl:${l.name}:${key}:${window}`;
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", k],
        ["PEXPIRE", k, String(l.windowMs)],
      ]),
      signal: AbortSignal.timeout(800),
    });
    if (!r.ok) return undefined;
    const [{ result: n }] = (await r.json()) as [{ result: number }];
    if (n <= l.limit) return 0;
    return Math.ceil(((window + 1) * l.windowMs - Date.now()) / 1000);
  } catch {
    return undefined; // fall back to the in-process count
  }
}

/**
 * Records one hit for this client against every limit; the first one exceeded wins. `client` is a
 * verified demo-session id where there is one, so visitors who share an IP (a carrier-grade NAT,
 * an office) get a budget each; limits marked `per: "ip"` still count the whole IP.
 */
export async function take(req: Request, limits: Limit[], client?: string): Promise<Verdict> {
  const ip = clientIp(req);
  for (const l of limits) {
    const key = l.per === "ip" || !client ? ip : `s:${client}`;
    const wait = (await upstashTake(key, l)) ?? memoryTake(key, l);
    if (wait > 0) {
      onLimited(key, l);
      return { ok: false, retryAfter: wait, limit: l };
    }
  }
  return { ok: true };
}

/** A friendly 429 with Retry-After. */
export function tooMany(v: Extract<Verdict, { ok: false }>, what = "requests"): Response {
  const when =
    v.retryAfter > 3600
      ? "tomorrow"
      : v.retryAfter > 90
        ? `in ${Math.ceil(v.retryAfter / 60)} minutes`
        : `in ${v.retryAfter} s`;
  return Response.json(
    {
      error: {
        code: "rate_limited",
        message: `That's a lot of ${what} from your network. Please try again ${when}.`,
        retryAfter: v.retryAfter,
      },
    },
    { status: 429, headers: { "retry-after": String(v.retryAfter) } },
  );
}

/** Repeated limit hits are reported by the abuse monitor (lib/server/monitor). */
let onLimited: (key: string, l: Limit) => void = () => {};
export function setLimitedHook(fn: (key: string, l: Limit) => void) {
  onLimited = fn;
}

/** The scanner's limits (phase 1): 10 a minute and 100 a day per client. */
export const SCAN_LIMITS: Limit[] = [
  { name: "scan-min", limit: 10, windowMs: 60_000 },
  { name: "scan-day", limit: 100, windowMs: 86_400_000 },
];

/** At most this many open event streams per client (each holds a socket and a subscription). */
export const MAX_STREAMS_PER_CLIENT = 6;
const gs = globalThis as unknown as { __qlStreams?: Map<string, number> };
const streams = (gs.__qlStreams ??= new Map());

/**
 * Reserves a stream slot for this client. Returns a release function, or undefined if the client
 * already has MAX_STREAMS_PER_CLIENT open (the route answers 429).
 */
export function openStreamSlot(req: Request): (() => void) | undefined {
  const key = clientIp(req);
  const n = streams.get(key) ?? 0;
  if (n >= MAX_STREAMS_PER_CLIENT) return undefined;
  streams.set(key, n + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const m = (streams.get(key) ?? 1) - 1;
    if (m <= 0) streams.delete(key);
    else streams.set(key, m);
  };
}
