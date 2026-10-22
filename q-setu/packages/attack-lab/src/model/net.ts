/**
 * The threat model: a small neural network in plain TypeScript. 13 inputs (./features), one hidden
 * layer of 8 tanh units, one sigmoid output: the risk that a request is part of an attack. Trained
 * with full-batch gradient descent on standardised features, class-balanced, with L2 weight decay.
 * Tiny on purpose: training on the Lab's data takes milliseconds and scoring is a few hundred
 * multiplications.
 *
 * What it is and isn't: it learns from what Shield already labelled, so it generalises Shield's
 * judgement to requests that look alike; it can be wrong, and it never replaces the rule engine.
 */
import {
  FEATURE_DOCS,
  FEATURES,
  toVector,
  type Facts,
  type FeatureName,
  type Features,
} from "./features";

export const HIDDEN = 8;

export interface Weights {
  v: 1;
  version: string;
  trainedAt: number;
  features: readonly string[];
  mean: number[];
  std: number[];
  w1: number[][];
  b1: number[];
  w2: number[];
  b2: number;
  metrics: Metrics;
}

export interface Metrics {
  /** Share of held-back requests labelled correctly (safe vs attack). */
  accuracy: number;
  heldOut: number;
  samples: number;
  /** Incidents (attacks) the training data came from. */
  attacks: number;
  /** True when the data was trimmed to the most recent MAX_SAMPLES. */
  capped: boolean;
  ms: number;
}

export type Label = "safe" | "suspicious" | "attack";
export type Response = "allow" | "slow" | "challenge" | "block";

export interface Verdict {
  score: number;
  label: Label;
  confidence: number;
  /** What the verdict maps to in Shield's response ladder. */
  response: Response;
  reasons: { feature: FeatureName; text: string }[];
  version: string;
}

export interface Sample {
  x: number[];
  y: 0 | 1;
  /** Which incident it came from (for the hold-out split); "" for normal traffic. */
  group: string;
}

/** A deterministic generator, so the same data always trains the same model. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/** The network's output before the final sigmoid (log-odds of an attack). */
export function logit(w: Weights, raw: number[]): number {
  const x = raw.map((v, i) => (v - w.mean[i]!) / w.std[i]!);
  let z = w.b2;
  for (let h = 0; h < w.w1.length; h++) {
    let a = w.b1[h]!;
    const row = w.w1[h]!;
    for (let i = 0; i < x.length; i++) a += row[i]! * x[i]!;
    z += w.w2[h]! * Math.tanh(a);
  }
  return z;
}

export const forward = (w: Weights, raw: number[]) => sigmoid(logit(w, raw));

/** Trains on `train`; returns weights (metrics filled by the caller). */
export function fit(
  train: Sample[],
  opts: { epochs?: number; lr?: number; l2?: number; seed?: number } = {},
) {
  const D = FEATURES.length;
  const n = train.length;
  const mean = new Array(D).fill(0);
  const std = new Array(D).fill(0);
  for (const s of train) s.x.forEach((v, i) => (mean[i] += v / n));
  for (const s of train) s.x.forEach((v, i) => (std[i] += (v - mean[i]) ** 2 / n));
  for (let i = 0; i < D; i++) std[i] = Math.sqrt(std[i]) || 1;
  const X = train.map((s) => s.x.map((v, i) => (v - mean[i]) / std[i]));
  const Y = train.map((s) => s.y);
  // Balance the classes: each side counts as much as the other, however many samples it has.
  const pos = Y.filter((y) => y === 1).length || 1;
  const neg = n - pos || 1;
  const cw = Y.map((y) => (y === 1 ? n / (2 * pos) : n / (2 * neg)));

  const r = rng(opts.seed ?? 7);
  const w1 = Array.from({ length: HIDDEN }, () =>
    Array.from({ length: D }, () => (r() - 0.5) * 0.6),
  );
  const b1 = new Array(HIDDEN).fill(0);
  const w2 = Array.from({ length: HIDDEN }, () => (r() - 0.5) * 0.6);
  let b2 = 0;
  const lr = opts.lr ?? 0.3;
  const l2 = opts.l2 ?? 1e-3;
  const a = new Array(HIDDEN).fill(0);
  for (let ep = 0; ep < (opts.epochs ?? 300); ep++) {
    const g1 = w1.map((row) => row.map(() => 0));
    const gb1 = new Array(HIDDEN).fill(0);
    const g2 = new Array(HIDDEN).fill(0);
    let gb2 = 0;
    for (let k = 0; k < n; k++) {
      const x = X[k]!;
      let z = b2;
      for (let h = 0; h < HIDDEN; h++) {
        let s = b1[h];
        for (let i = 0; i < D; i++) s += w1[h]![i]! * x[i]!;
        a[h] = Math.tanh(s);
        z += w2[h]! * a[h];
      }
      const d = (sigmoid(z) - Y[k]!) * cw[k]!;
      gb2 += d;
      for (let h = 0; h < HIDDEN; h++) {
        g2[h] += d * a[h];
        const dh = d * w2[h]! * (1 - a[h] * a[h]);
        gb1[h] += dh;
        for (let i = 0; i < D; i++) g1[h]![i]! += dh * x[i]!;
      }
    }
    for (let h = 0; h < HIDDEN; h++) {
      w2[h] = w2[h]! - lr * (g2[h] / n + l2 * w2[h]!);
      b1[h] -= (lr * gb1[h]) / n;
      for (let i = 0; i < D; i++) w1[h]![i]! -= lr * (g1[h]![i]! / n + l2 * w1[h]![i]!);
    }
    b2 -= (lr * gb2) / n;
  }
  return { mean, std, w1, b1, w2, b2 };
}

export function label(score: number): Label {
  return score >= 0.7 ? "attack" : score >= 0.4 ? "suspicious" : "safe";
}

/** The verdict mapped onto Shield's response ladder. */
export function response(score: number): Response {
  return score >= 0.9 ? "block" : score >= 0.7 ? "challenge" : score >= 0.4 ? "slow" : "allow";
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** One reason, in words, using the real numbers behind the feature (`up`: above the average request). */
export function reasonText(f: FeatureName, x: Features, facts: Facts, up: boolean): string {
  switch (f) {
    case "requestRate":
      return up
        ? `sent ${facts.requests10s} requests in 10 seconds`
        : `only ${facts.requests10s} request${facts.requests10s === 1 ? "" : "s"} in 10 seconds`;
    case "distinctRoutes":
      return up
        ? `hit ${facts.routes60s} different pages in a minute`
        : `stayed on ${facts.routes60s} page${facts.routes60s === 1 ? "" : "s"}`;
    case "errorRatio":
      return up
        ? `${pct(x.errorRatio)} of its requests hit pages that don't exist`
        : "its requests found real pages";
    case "timingEvenness":
      return up
        ? "waited between requests with machine-even timing"
        : "paused unevenly, like a person";
    case "fastBurst":
      return up
        ? `requests ${Math.max(1, Math.round(facts.minGapMs))} ms apart, faster than anyone clicks`
        : "never faster than a person clicks";
    case "headerMismatch":
      return up ? "browser details that contradict each other" : "consistent browser details";
    case "automationClient":
      return up
        ? `identified itself as ${facts.client === "ai-agent" ? "an AI bot" : facts.client === "none" ? "nothing at all" : `a ${facts.client}`}`
        : "a normal web browser";
    case "browserCheck":
      return up ? "passed the browser check" : "no browser check";
    case "tlsFingerprintAge":
      return up ? "a connection fingerprint seen before" : "no connection fingerprint seen";
    case "honeypotTouched":
      return up ? "touched a trap only bots find" : "avoided the traps";
    case "sensitiveRoutes":
      return up ? `went for ${facts.route}, a secret or admin path` : "stayed on public pages";
    case "canaryTouched":
      return up ? "used a bait API key we planted" : "no bait key used";
    case "apiWrites":
      return up ? "sent data to the API" : "only read pages";
  }
}

/** Score one request and explain it: the 3 features that moved the score most, in words. */
export function verdict(w: Weights, x: Features, facts: Facts): Verdict {
  const raw = toVector(x);
  const score = forward(w, raw);
  const l = label(score);
  // Occlusion: how much the log-odds change when each feature is set to the average request
  // (in log-odds, not probability, so a confident score still shows what drove it).
  const z = logit(w, raw);
  const effects = FEATURES.map((f, i) => {
    const alt = raw.slice();
    alt[i] = w.mean[i]!;
    return { f, i, d: z - logit(w, alt) };
  });
  const towards = l === "safe" ? -1 : 1;
  // A reason must point the same way as the verdict: risky facts for an attack, reassuring ones
  // for a safe request (a high value is risky for every feature except the two below).
  const risky = (i: number) =>
    raw[i]! > w.mean[i]! !==
    (FEATURES[i] === "browserCheck" || FEATURES[i] === "tlsFingerprintAge");
  const agree = effects
    .filter((e) => risky(e.i) === towards > 0)
    .sort((a, b) => b.d * towards - a.d * towards);
  const strong = agree.filter((e) => e.d * towards > 0.05);
  // Nothing clears the bar (a borderline score): still name its strongest factors.
  const top = (strong.length ? strong : agree.filter((e) => e.d * towards > 0)).slice(0, 3);
  return {
    score: Math.round(score * 1000) / 1000,
    label: l,
    confidence:
      Math.round(
        (l === "suspicious"
          ? 1 - Math.abs(score - 0.55) / 0.15 / 2
          : l === "attack"
            ? score
            : 1 - score) * 100,
      ) / 100,
    response: response(score),
    reasons: top.map((e) => ({
      feature: e.f,
      text: reasonText(e.f, x, facts, raw[e.i]! > w.mean[e.i]!),
    })),
    version: w.version,
  };
}

export { FEATURE_DOCS };
