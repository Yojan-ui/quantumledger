// Formatting helpers. Prices/quantities arrive as 64-bit fixed-point integers
// (scale 10,000) and are formatted with integer arithmetic only.

export const SCALE = 10_000;

export function px(v: number | null | undefined, dp = 2): string {
  if (v == null) return "—";
  const neg = v < 0;
  const a = Math.abs(v);
  const whole = Math.trunc(a / SCALE);
  const frac = String(a % SCALE).padStart(4, "0").slice(0, dp);
  return `${neg ? "-" : ""}${whole}${dp ? "." + frac : ""}`;
}

export function qty(v: number | null | undefined): string {
  if (v == null) return "—";
  const whole = Math.trunc(v / SCALE);
  return whole.toLocaleString("en-US");
}

export function int(v: number | null | undefined): string {
  return v == null ? "—" : Math.round(v).toLocaleString("en-US");
}

/** nanoseconds → adaptive µs/ms/ns string */
export function dur(ns: number | null | undefined): string {
  if (ns == null || !Number.isFinite(ns)) return "—";
  if (ns < 1_000) return `${Math.round(ns)} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(ns < 10_000 ? 2 : 1)} µs`;
  return `${(ns / 1_000_000).toFixed(2)} ms`;
}

export function us(ns: number | null | undefined, dp = 1): string {
  if (ns == null) return "—";
  return (ns / 1_000).toFixed(dp);
}

export function bytes(b: number | null | undefined): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10_240 ? 2 : 1)} KiB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MiB`;
  return `${(b / 1024 ** 3).toFixed(2)} GiB`;
}

export function utc(d = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`;
}

export function clockOf(tsNs: number): string {
  return utc(new Date(Math.floor(tsNs / 1e6)));
}
