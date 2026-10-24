/**
 * Structured request logs, one JSON line per event on stdout:
 *   { t, route, status, ms, ip, ...extra }
 * `ip` is a salted SHA-256 prefix of the client IP (LOG_SALT; rotate it to unlink old logs), never
 * the address itself. Extra fields are short scalars: strings are cut to 120 characters, so a full
 * user input (a pasted file, a long URL) is never written, and nothing named like a secret is kept.
 */
import { createHash } from "node:crypto";
import { clientIp } from "@/lib/live/rate-limit";

const SALT = process.env.LOG_SALT ?? "quantumledger-log-v1";
const SECRET_KEY = /pass|secret|token|key|auth|cookie|sig/i;

export function ipHash(req: Request): string {
  return createHash("sha256").update(SALT).update(clientIp(req)).digest("hex").slice(0, 16);
}

type Extra = Record<string, string | number | boolean | undefined>;

export function log(req: Request, route: string, status: number, ms: number, extra: Extra = {}) {
  const safe: Extra = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || SECRET_KEY.test(k)) continue;
    safe[k] = typeof v === "string" ? v.slice(0, 120) : v;
  }
  const line = {
    t: new Date().toISOString(),
    route,
    status,
    ms: Math.round(ms),
    ip: ipHash(req),
    ...safe,
  };
  console.log(JSON.stringify(line));
  onLogged?.(line);
}

/** The abuse monitor (lib/server/monitor) watches the stream for error spikes. */
let onLogged: ((l: { route: string; status: number; ip: string }) => void) | undefined;
export function setLogHook(fn: typeof onLogged) {
  onLogged = fn;
}
