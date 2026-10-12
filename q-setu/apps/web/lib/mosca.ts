/**
 * Mosca's inequality: if X (years the data must stay secret) + Y (years to migrate) > Z (years until
 * a cryptographically relevant quantum computer), data recorded today is exposed. Z is an estimate
 * range from facts.ts (never typed in here); the check uses its low end, the cautious reading.
 */
import { fact, footnote } from "@/data/facts";

export const Z_FACT = "crqc-timeline";

export function zRange() {
  const f = fact(Z_FACT);
  if (!f?.range) return undefined;
  return { ...f.range, source: f.source, url: f.url, note: footnote(Z_FACT), asOf: f.asOf };
}

export function mosca(x: number, y: number) {
  const z = zRange();
  if (!z) return undefined;
  const sum = x + y;
  const verdict: "exposed" | "window" | "safe" =
    sum > z.high ? "exposed" : sum > z.low ? "window" : "safe";
  return { sum, z, verdict, exposed: sum > z.low };
}

/** The date the data must stay secret until: today + X. */
export const trustUntil = (x: number, now = new Date()) => {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() + x);
  return d.toISOString().slice(0, 10);
};
