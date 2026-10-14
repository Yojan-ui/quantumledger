/**
 * Which limits apply to which API route (the shared middleware applies them). Every public route
 * gets a per-client budget; routes that burn CPU, and routes that change state for every visitor,
 * get tighter ones. The scanner adds its own (10 a minute, 100 a day) in its route.
 */
import type { Limit } from "./limits";

// Per client (the demo session, else the IP). Reads are generous: every page polls a few of them
// by itself (metrics, ledger, live state), and a fast visitor clicking around must never see a 429.
const READ: Limit = { name: "api-read", limit: 600, windowMs: 60_000 };
const WRITE: Limit = { name: "api-write", limit: 30, windowMs: 60_000 };
const HEAVY: Limit = { name: "api-heavy", limit: 10, windowMs: 60_000 };
const GLOBAL: Limit = { name: "api-global", limit: 3, windowMs: 60_000 };
const STREAM: Limit = { name: "api-stream", limit: 20, windowMs: 60_000 };
// Per IP, whatever the session: room for many real visitors behind one carrier-grade NAT address,
// while a script that mints fresh sessions still hits a wall.
const READ_IP: Limit = { name: "api-read-ip", limit: 6000, windowMs: 60_000, per: "ip" };
const WRITE_IP: Limit = { name: "api-write-ip", limit: 300, windowMs: 60_000, per: "ip" };
const HEAVY_IP: Limit = { name: "api-heavy-ip", limit: 60, windowMs: 60_000, per: "ip" };
const STREAM_IP: Limit = { name: "api-stream-ip", limit: 200, windowMs: 60_000, per: "ip" };

/** Real crypto or big inputs on every call. */
const HEAVY_ROUTES = [
  /^\/api\/bench$/,
  /^\/api\/ledger\/verify$/,
  /^\/api\/qday$/,
  /^\/api\/scan$/,
  /^\/api\/certs\/issue$/,
  /^\/api\/traffic$/,
  /^\/api\/plan$/,
  /^\/api\/simulate$/,
  /^\/api\/proof\/[^/]+\/verify$/,
  /^\/api\/shield\/run$/,
  /^\/api\/sdk\/[^/]+$/,
  /^\/api\/web-shield\/submit$/,
];
/** Change the demo for everyone at once. */
const GLOBAL_ROUTES = [
  /^\/api\/reset-all$/,
  /^\/api\/reset$/,
  /^\/api\/keys\/rotate$/,
  /^\/api\/policy$/,
];
const STREAM_ROUTES = [/^\/api\/stream$/, /^\/api\/room\/stream$/];

export function limitsFor(path: string, method: string): Limit[] {
  const write = method !== "GET" && method !== "HEAD";
  if (STREAM_ROUTES.some((r) => r.test(path))) return [STREAM, STREAM_IP];
  const out = write ? [WRITE, WRITE_IP] : [READ, READ_IP];
  if (HEAVY_ROUTES.some((r) => r.test(path))) out.push(HEAVY, HEAVY_IP);
  if (write && GLOBAL_ROUTES.some((r) => r.test(path))) out.push(GLOBAL);
  return out;
}

/** Writes that don't need the demo session: the admin login form (it has its own limit). */
export const SESSION_EXEMPT = [/^\/api\/admin\/login$/];
