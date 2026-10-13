/**
 * Which limits apply to which API route (the shared middleware applies them). Every public route
 * gets a per-client budget; routes that burn CPU, and routes that change state for every visitor,
 * get tighter ones. The scanner adds its own (10 a minute, 100 a day) in its route.
 */
import type { Limit } from "./limits";

const READ: Limit = { name: "api-read", limit: 120, windowMs: 60_000 };
const WRITE: Limit = { name: "api-write", limit: 30, windowMs: 60_000 };
const HEAVY: Limit = { name: "api-heavy", limit: 10, windowMs: 60_000 };
const GLOBAL: Limit = { name: "api-global", limit: 3, windowMs: 60_000 };
const STREAM: Limit = { name: "api-stream", limit: 20, windowMs: 60_000 };

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
  if (STREAM_ROUTES.some((r) => r.test(path))) return [STREAM];
  const out = [write ? WRITE : READ];
  if (HEAVY_ROUTES.some((r) => r.test(path))) out.push(HEAVY);
  if (write && GLOBAL_ROUTES.some((r) => r.test(path))) out.push(GLOBAL);
  return out;
}

/** Writes that don't need the demo session: the admin login form (it has its own limit). */
export const SESSION_EXEMPT = [/^\/api\/admin\/login$/];
