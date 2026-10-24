/**
 * Typical traffic for each threat in the reference library (../threats), as the model's features.
 * Used to answer "how would the model score an attack like this on your site?" for a scanned site.
 * These are descriptions of behaviour, not traffic: nothing is sent anywhere.
 */
import { THREATS } from "../threats";
import { requestShape, type Facts, type Features } from "./features";

const rate = (n: number) => Math.log1p(n) / Math.log(151);
const routes = (n: number) => Math.log1p(n) / Math.log(121);
function shape(route: string) {
  const s = requestShape(route);
  return {
    pathEntropy: Math.min(1, s.entropy / 6),
    payloadLength: Math.log1p(s.length) / Math.log(2001),
    injectionChars: Math.min(1, s.odd),
  };
}

interface Profile {
  x: Features;
  facts: Facts;
}

function profile(
  route: string,
  p: Omit<Features, "pathEntropy" | "payloadLength" | "injectionChars">,
  f: { requests10s: number; routes60s: number; minGapMs: number; client: Facts["client"] },
): Profile {
  return {
    x: { ...p, ...shape(route) },
    facts: {
      ...f,
      errors60s: 0,
      seen60s: f.requests10s,
      evenness: p.timingEvenness,
      route,
      length: route.length,
    },
  };
}

export const PROFILES: Record<string, Profile> = {
  "agent-swarm-100-breaches": profile(
    "/.env",
    {
      requestRate: rate(40),
      distinctRoutes: routes(35),
      errorRatio: 0.7,
      timingEvenness: 0.9,
      fastBurst: 0.6,
      headerMismatch: 0,
      automationClient: 1,
      browserCheck: 0,
      tlsFingerprintAge: 0,
      honeypotTouched: 1,
      sensitiveRoutes: 1,
      canaryTouched: 0,
      apiWrites: 0,
    },
    { requests10s: 40, routes60s: 35, minGapMs: 60, client: "script" },
  ),
  "hugging-face-agent-attack": profile(
    "/statements/2041",
    {
      requestRate: rate(120),
      distinctRoutes: routes(60),
      errorRatio: 0.3,
      timingEvenness: 0.95,
      fastBurst: 0.9,
      headerMismatch: 0,
      automationClient: 1,
      browserCheck: 0,
      tlsFingerprintAge: 0,
      honeypotTouched: 0,
      sensitiveRoutes: 0,
      canaryTouched: 0,
      apiWrites: 0,
    },
    { requests10s: 120, routes60s: 60, minGapMs: 10, client: "ai-agent" },
  ),
  "opencode-48h": profile(
    "/api/transfer",
    {
      requestRate: rate(90),
      distinctRoutes: routes(2),
      errorRatio: 0.1,
      timingEvenness: 0.9,
      fastBurst: 0.95,
      headerMismatch: 0,
      automationClient: 1,
      browserCheck: 0,
      tlsFingerprintAge: 0,
      honeypotTouched: 0,
      sensitiveRoutes: 0,
      canaryTouched: 1,
      apiWrites: 1,
    },
    { requests10s: 90, routes60s: 2, minGapMs: 5, client: "script" },
  ),
  "ai-orchestrated-espionage": profile(
    "/wp-login.php",
    {
      requestRate: rate(8),
      distinctRoutes: routes(12),
      errorRatio: 0.5,
      timingEvenness: 0.7,
      fastBurst: 0.3,
      headerMismatch: 1,
      automationClient: 0.5,
      browserCheck: 0,
      tlsFingerprintAge: 0,
      honeypotTouched: 0,
      sensitiveRoutes: 1,
      canaryTouched: 0,
      apiWrites: 0,
    },
    { requests10s: 8, routes60s: 12, minGapMs: 250, client: "search-bot" },
  ),
};

/** Every threat with a profile (the library and the profiles stay in step). */
export const PROFILE_THREATS = THREATS.filter((t) => PROFILES[t.id]);
