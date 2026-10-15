/**
 * Which limits apply to which API route (the shared middleware applies them). Every public route
 * gets a per-client budget; routes that burn CPU, and routes that change state for every visitor,
 * get tighter ones. The scanner adds its own (10 a minute, 100 a day) in its route.
 */
import type { Limit } from "./limits";

// Per client (the demo session, else the IP). Reads are generous: every page polls a few of them
// by itself (metrics, ledger, live state), and a fast visitor clicking around must never see a 429.
const READ: Limit = { name: "api-read", limit: 600, windowMs: 60_000 };
// The home page alone makes ~8 writes in its first 20 s (scan, plan, simulations, proof anchor).
const WRITE: Limit = { name: "api-write", limit: 90, windowMs: 60_000 };
// Measured: one visitor going from the home page to Q-Day makes ~14 heavy calls in under a minute
// (scans, plans, simulations, proof checks), so the per-session budget has headroom above that.
const HEAVY: Limit = { name: "api-heavy", limit: 40, windowMs: 60_000 };
// The L1/L3/L5 switch and a sector reset: a visitor clicking through levels must not hit a wall.
const GLOBAL: Limit = { name: "api-global", limit: 12, windowMs: 60_000 };
const STREAM: Limit = { name: "api-stream", limit: 20, windowMs: 60_000 };
// Per IP, whatever the session: room for many real visitors behind one carrier-grade NAT address,
// while a script that mints fresh sessions still hits a wall.
const READ_IP: Limit = { name: "api-read-ip", limit: 6000, windowMs: 60_000, per: "ip" };
const WRITE_IP: Limit = { name: "api-write-ip", limit: 600, windowMs: 60_000, per: "ip" };
const HEAVY_IP: Limit = { name: "api-heavy-ip", limit: 240, windowMs: 60_000, per: "ip" };
const STREAM_IP: Limit = { name: "api-stream-ip", limit: 200, windowMs: 60_000, per: "ip" };

/** Real crypto or big inputs on every call. */
const HEAVY_ROUTES = [
  /^\/api\/bench$/,
  /^\/api\/ledger\/verify$/,
  /^\/api\/qday$/,
  /^\/api\/scan$/,
  /^\/api\/certs\/issue$/,
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
/**
 * Demo 2's deployed nodes doing real work in the background (one sign, seal, open and verify per
 * call). Its own budget, outside the shared write budget: the demo paces itself to 24 a minute.
 */
const TRAFFIC: Limit = { name: "api-traffic", limit: 30, windowMs: 60_000 };
const TRAFFIC_IP: Limit = { name: "api-traffic-ip", limit: 300, windowMs: 60_000, per: "ip" };
const TRAFFIC_ROUTES = [/^\/api\/traffic$/];
/** The live attack demo sends ~1,500 local requests per run: 2 runs per 10 minutes per client. */
const LIVE: Limit = { name: "api-shield-live", limit: 2, windowMs: 10 * 60_000 };
const LIVE_IP: Limit = { name: "api-shield-live-ip", limit: 6, windowMs: 10 * 60_000, per: "ip" };
const LIVE_ROUTES = [/^\/api\/shield\/live$/, /^\/api\/shield\/plugin\/attack$/];
/** "Shield plugs in": ~20 loopback requests and one signature per run. */
const PLUGIN: Limit = { name: "api-shield-plugin", limit: 6, windowMs: 10 * 60_000 };
const PLUGIN_IP: Limit = {
  name: "api-shield-plugin-ip",
  limit: 30,
  windowMs: 10 * 60_000,
  per: "ip",
};
const PLUGIN_ROUTES = [/^\/api\/shield\/plugin$/];

export function limitsFor(path: string, method: string): Limit[] {
  const write = method !== "GET" && method !== "HEAD";
  if (STREAM_ROUTES.some((r) => r.test(path))) return [STREAM, STREAM_IP];
  if (TRAFFIC_ROUTES.some((r) => r.test(path))) return [TRAFFIC, TRAFFIC_IP];
  if (LIVE_ROUTES.some((r) => r.test(path))) return [LIVE, LIVE_IP, WRITE_IP];
  if (PLUGIN_ROUTES.some((r) => r.test(path))) return [PLUGIN, PLUGIN_IP, WRITE_IP];
  const out = write ? [WRITE, WRITE_IP] : [READ, READ_IP];
  if (HEAVY_ROUTES.some((r) => r.test(path))) out.push(HEAVY, HEAVY_IP);
  if (write && GLOBAL_ROUTES.some((r) => r.test(path))) out.push(GLOBAL);
  return out;
}

/** Writes that don't need the demo session: the admin login form (it has its own limit). */
export const SESSION_EXEMPT = [/^\/api\/admin\/login$/];

/**
 * Server-to-server routes authenticated by a Shield site key (Bearer qsk_…) in the route itself:
 * no browser, so no same-origin check or demo session.
 */
export const SITE_KEY_ROUTES = [/^\/api\/shield\/events$/, /^\/api\/shield\/config$/];
