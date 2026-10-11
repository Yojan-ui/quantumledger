export const ms = (v: number | undefined) =>
  v === undefined
    ? "–"
    : v < 1
      ? `${(v * 1000).toFixed(0)} µs`
      : v < 10
        ? `${v.toFixed(2)} ms`
        : `${v.toFixed(1)} ms`;

export const us = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} ms` : `${v.toFixed(1)} µs`);

export const bytes = (n: number) =>
  n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${Math.round(n)} B`;

export const hexPreview = (b: Uint8Array, n = 24) => {
  let s = "";
  for (let i = 0; i < Math.min(b.length, n); i++) s += b[i]!.toString(16).padStart(2, "0");
  return b.length > n ? `${s}…` : s;
};
