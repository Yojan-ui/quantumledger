/**
 * What the threat model looks at, per request: thirteen numbers computed only from what Shield
 * already records (route, method, status, timing, client family, the engine's own checks). No
 * bodies, no raw headers, no IPs: the per-source history is keyed by the same salted hash as the
 * evidence, kept in memory, and bounded.
 */
import { routeClass } from "../privacy";
import type { AttackEvent } from "../types";

export const FEATURES = [
  "requestRate",
  "distinctRoutes",
  "errorRatio",
  "timingEvenness",
  "fastBurst",
  "headerMismatch",
  "automationClient",
  "browserCheck",
  "tlsFingerprintAge",
  "honeypotTouched",
  "sensitiveRoutes",
  "canaryTouched",
  "apiWrites",
] as const;
export type FeatureName = (typeof FEATURES)[number];
export type Features = Record<FeatureName, number>;
/** The raw facts behind the numbers, for explanations in words. */
export interface Facts {
  requests10s: number;
  routes60s: number;
  errors60s: number;
  seen60s: number;
  minGapMs: number;
  evenness: number;
  client: AttackEvent["client"];
  route: string;
}

/** Plain and technical descriptions, for the Threat model page. */
export const FEATURE_DOCS: Record<FeatureName, { simple: string; technical: string }> = {
  requestRate: {
    simple: "How fast it sends requests",
    technical: "Requests from this source in the last 10 s (log-scaled)",
  },
  distinctRoutes: {
    simple: "How many different pages it tries",
    technical: "Distinct routes from this source in the last 60 s (log-scaled)",
  },
  errorRatio: {
    simple: "How often it asks for pages that aren't there",
    technical: "Share of this source's last-60 s responses that were 4xx/5xx",
  },
  timingEvenness: {
    simple: "Whether it waits like a machine (perfectly even) or a person (uneven)",
    technical: "1 − coefficient of variation of the last 10 inter-arrival gaps",
  },
  fastBurst: {
    simple: "Whether requests come faster than anyone can click",
    technical: "1 / (1 + min gap / 100 ms) over the last 10 requests",
  },
  headerMismatch: {
    simple: "Whether its browser details contradict each other",
    technical:
      "Shield's header-consistency checks fired (UA vs Accept-Language, fetch metadata, TLS)",
  },
  automationClient: {
    simple: "Whether it says it's a script or bot instead of a browser",
    technical: "Client family is script, headless, AI agent or unnamed (search bots 0.5)",
  },
  browserCheck: {
    simple: "Whether it passed Shield's quick browser check",
    technical: "Holds a valid Shield pass cookie (proof-of-work solved in JavaScript)",
  },
  tlsFingerprintAge: {
    simple: "Whether its connection fingerprint has been seen before",
    technical:
      "JA4 present and seen earlier (1), new (0.5) or absent (0; only Shield Edge sees TLS)",
  },
  honeypotTouched: {
    simple: "Whether it touched a trap only bots find",
    technical: "Honeypot or hidden trap link hit",
  },
  sensitiveRoutes: {
    simple: "Whether it went for secret files or admin pages",
    technical: "Route class is secrets or admin",
  },
  canaryTouched: {
    simple: "Whether it used a bait key we planted",
    technical: "Canary API key presented",
  },
  apiWrites: {
    simple: "Whether it's sending data to the API (like payments)",
    technical: "Non-GET request to /api/",
  },
};

const AUTOMATION = new Set(["script", "headless", "ai-agent", "none", "other"]);
const HEADERS = /accept-language|fetch metadata|no user agent|non-browser TLS|old TLS/;

interface Seen {
  at: number;
  route: string;
  status: number;
}

/** Per-source request history (bounded), turning each request into features. */
export class FeatureTracker {
  private readonly hist = new Map<string, Seen[]>();
  private readonly ja4 = new Map<string, number>();

  /** Features for `e` from what came before it; then remembers `e`. */
  observe(e: AttackEvent): { x: Features; facts: Facts } {
    const key = `${e.site}|${e.source.ipHash}`;
    const all = this.hist.get(key) ?? [];
    const h = all.filter((s) => e.at - s.at <= 60_000 && s.at <= e.at);
    const recent10 = h.filter((s) => e.at - s.at <= 10_000).length + 1;
    const routes = new Set([...h.map((s) => s.route), e.route]).size;
    const errors = h.filter((s) => s.status >= 400).length;
    const times = [...h.map((s) => s.at), e.at].slice(-11);
    const gaps = times.slice(1).map((t, i) => Math.max(1, t - times[i]!));
    let evenness = 0;
    let minGap = 60_000;
    if (gaps.length >= 1) minGap = Math.min(...gaps);
    if (gaps.length >= 3) {
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
      evenness = Math.max(0, Math.min(1, 1 - sd / mean));
    }
    const rc = routeClass(e.route);
    const ja4 = e.tls?.ja4;
    const ja4Seen = ja4 ? (this.ja4.get(ja4) ?? 0) : 0;
    const x: Features = {
      requestRate: Math.log1p(recent10) / Math.log(151),
      distinctRoutes: Math.log1p(routes) / Math.log(121),
      errorRatio: h.length ? errors / h.length : 0,
      timingEvenness: evenness,
      fastBurst: gaps.length ? 1 / (1 + minGap / 100) : 0,
      headerMismatch: e.signals.some((s) => HEADERS.test(s)) ? 1 : 0,
      automationClient: AUTOMATION.has(e.client) ? 1 : e.client === "search-bot" ? 0.5 : 0,
      browserCheck: e.source.sessionHash ? 1 : 0,
      tlsFingerprintAge: ja4 ? (ja4Seen > 0 ? 1 : 0.5) : 0,
      honeypotTouched:
        e.types.includes("honeypot") || e.types.includes("trap") || rc === "trap" ? 1 : 0,
      sensitiveRoutes: rc === "secrets" || rc === "admin" ? 1 : 0,
      canaryTouched: e.types.includes("canary") || e.route.includes("[canary]") ? 1 : 0,
      apiWrites: e.method !== "GET" && e.method !== "HEAD" && e.route.startsWith("/api/") ? 1 : 0,
    };
    all.push({ at: e.at, route: e.route, status: e.status });
    this.hist.set(key, all.slice(-60));
    if (ja4) this.ja4.set(ja4, ja4Seen + 1);
    // Bounded: drop the oldest sources first.
    if (this.hist.size > 20_000) this.hist.delete(this.hist.keys().next().value!);
    return {
      x,
      facts: {
        requests10s: recent10,
        routes60s: routes,
        errors60s: errors,
        seen60s: h.length,
        minGapMs: minGap,
        evenness,
        client: e.client,
        route: e.route,
      },
    };
  }
}

export const toVector = (x: Features) => FEATURES.map((f) => x[f]);
