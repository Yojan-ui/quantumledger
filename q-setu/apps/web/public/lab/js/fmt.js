// Formatting only: every value shown comes from a backend response; nothing here computes results.
export const SEVERITIES = ["critical", "high", "medium", "low", "info"];
export const sevRank = (s) => SEVERITIES.indexOf(s);
export const gradeClass = (g) =>
  `grade grade-${String(g)
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")}`;
export const bytes = (n) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(2)} MB`;
export const ms = (v) =>
  v === null || v === undefined
    ? "–"
    : v < 10
      ? `${v.toFixed(2)} ms`
      : v < 1000
        ? `${v.toFixed(0)} ms`
        : `${(v / 1000).toFixed(2)} s`;
export const short = (hash, n = 12) => (hash ? `${hash.slice(0, n)}…` : "–");
export function when(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d+Z$/, " UTC");
}
/** Findings across files, most severe first (then file order, then line). Ordering only, no scoring. */
export function orderedFindings(result) {
  const out = [];
  (result.files || []).forEach((f, fi) =>
    f.findings.forEach((x, n) => out.push({ fi, n, file: f, f: x })),
  );
  return out.sort(
    (a, b) =>
      sevRank(a.f.severity) - sevRank(b.f.severity) ||
      a.fi - b.fi ||
      a.f.line - b.f.line ||
      a.n - b.n,
  );
}
