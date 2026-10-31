/**
 * Printable run report: one self-contained HTML page built only from the finished run record (no scripts, no
 * network, system fonts, black and white). Every value is HTML-escaped; the route also sends a CSP that
 * forbids scripts, so scanned text can never execute. Colours are CSS keywords (the design lint bans hex).
 */
import type { RunRecord } from "./runs";

const esc = (v: unknown) =>
  String(v ?? "–").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const SEV = ["critical", "high", "medium", "low", "info"] as const;

function table(head: string[], rows: unknown[][], cls = "") {
  return `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}
const kv = (rows: [string, unknown][]) =>
  `<table class="kv"><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>`;

export function renderReport(r: RunRecord, generatedAt = new Date()): string {
  const total = r.files.reduce((s, f) => s + f.findings.length, 0);
  const files = r.files
    .map(
      (f) => `<section class="file">
<h3>${esc(f.name)} <span class="grade">${esc(f.score)} / 100 · ${esc(f.grade)}</span></h3>
<p class="mono">${esc(f.source)}${f.sampleLabel ? " · Sample data" : ""} · ${esc(f.bytes)} B · ${esc(f.lines)} lines · sha256 ${esc(f.sha256)}</p>
<p class="mono">${SEV.map((s) => `${s} ${f.summary[s] ?? 0}`).join(" · ")}</p>
${
  f.findings.length
    ? table(
        ["Line", "Severity", "Algorithm", "Rule", "Match", "Replace with"],
        f.findings.map((x) => [
          `${x.line}:${x.column}`,
          x.severity,
          x.algorithm,
          x.ruleId,
          x.match,
          x.replacement,
        ]),
        "findings",
      )
    : "<p>No quantum-vulnerable or broken cryptography found in this input.</p>"
}
</section>`,
    )
    .join("\n");
  const u = r.url as (Record<string, unknown> & { probe?: Record<string, unknown> }) | null;
  const host = u
    ? `<section><h2>Host</h2>${kv([
        ["Host", u.probe?.host],
        ["Source", u.mode === "live" ? "live TLS probe" : "cached real scan"],
        ["Scanned", u.scannedAt],
        ["Score", `${u.score} / 100 · ${u.grade}`],
        ["Protocol", u.probe?.protocol],
        ["Key exchange group", u.probe?.group],
        ["Cipher", u.probe?.cipher],
        ["Certificate key", u.probe?.certKey],
        ["Certificate signature", u.probe?.certSigAlg],
        ["Hybrid post-quantum", u.probe?.hybridPq ? "yes" : "no"],
      ])}</section>`
    : "";
  const p = r.plan;
  const plan = p
    ? `<section><h2>Migration plan</h2>
<p class="mono">${p.steps.length} step(s) · horizon ${esc(p.assumptions.horizonYear)} · ${esc(p.assumptions.yearsLeft)} years left · data lifetime ${esc(p.assumptions.dataLifetimeYears)} years</p>
<ol class="steps">${p.steps
        .map(
          (s) =>
            `<li><b>${esc(s.priority)} · ${esc(s.title)}</b><br>${esc(s.action)}<br><span class="muted">${esc(s.why)}</span><br><span class="mono">effort ${esc(s.effort)} · ${esc(s.fixer)} · resolves ${esc(Array.isArray(s.resolves) ? s.resolves.join(", ") : s.resolves)}</span></li>`,
        )
        .join("")}</ol></section>`
    : "";
  const lg = r.ledger;
  const v = lg?.verify as
    { ok?: boolean; checked?: number; broken?: { id?: number } } | null | undefined;
  const ledger = lg
    ? `<section><h2>Proof Chain record</h2>${kv([
        ["Entry", `#${lg.entryId} · ${lg.kind}`],
        ["Hash", lg.hash],
        [
          "Verify at run time",
          v ? (v.ok ? `verified, ${v.checked} entries` : `broken at #${v.broken?.id}`) : "not run",
        ],
      ])}<p class="note">${esc(lg.note)}</p></section>`
    : `<section><h2>Proof Chain record</h2><p>This run was not signed (status ${esc(r.status)}).</p></section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QuantumLedger Lab report · run ${esc(r.runId)}</title>
<style>
:root{color-scheme:light}
body{margin:0;background:white;color:black;font:14px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
main{max-width:960px;margin:0 auto;padding:40px 32px}
h1{font-size:32px;line-height:1.1;margin:0 0 8px;letter-spacing:-0.02em}
h2{font-size:18px;margin:32px 0 8px;padding-top:12px;border-top:2px solid black}
h3{font-size:15px;margin:20px 0 4px}
.grade{font-weight:600;border:1px solid black;padding:1px 6px;margin-left:6px;font-size:12px}
.mono,td,.kv th{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
.muted{color:dimgray}
.note{border:1px solid black;padding:8px 12px}
table{width:100%;border-collapse:collapse;margin:8px 0}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid black;padding:4px 8px 4px 0}
td{border-bottom:1px solid silver;padding:4px 8px 4px 0;vertical-align:top;overflow-wrap:anywhere}
.kv th{width:30%;text-transform:none;letter-spacing:0;font-size:12px;border-bottom:1px solid silver}
ol.steps li{margin:0 0 10px}
.file{break-inside:avoid-page}
.findings td:first-child,.log td:first-child{white-space:nowrap}
footer{margin-top:40px;font-size:12px;color:dimgray}
@media print{main{padding:0}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body><main>
<p class="mono">QuantumLedger Lab · run report</p>
<h1>${r.files.length ? `${total} finding(s) across ${r.files.length} input(s)` : "Host scan"} · ${esc(r.status)}</h1>
${kv([
  ["Run", r.runId],
  ["Started", r.startedAt],
  ["Finished", r.finishedAt],
  ["Duration", r.durationMs === null ? null : `${r.durationMs.toFixed(1)} ms`],
  ["Input SHA-256", r.inputSha256],
  ["Result SHA-256", r.resultSha256],
  ["Data lifetime", `${r.params.dataLifetimeYears} years`],
  [
    "Hybrid PQ deployed",
    r.params.hybridPq === null ? "not stated" : r.params.hybridPq ? "yes" : "no",
  ],
  ["Version", `${r.version.app} · ${r.version.core} · commit ${r.version.commit ?? "unknown"}`],
])}
<h2>Inputs</h2>
${table(
  ["Name", "Source", "Bytes", "Lines", "SHA-256"],
  r.inputs.map((i) => [
    i.name,
    `${i.source}${i.sampleLabel ? " · Sample data" : ""}`,
    i.bytes,
    i.lines,
    i.sha256,
  ]),
)}
${r.files.length ? `<h2>Findings</h2>${files}` : ""}
${host}
${plan}
${ledger}
<h2>Run log</h2>
${table(
  ["Time", "Stage", "Message"],
  r.log.map((l) => [l.t, l.stage, l.message]),
  "log",
)}
<footer>Every figure on this page comes from the record of run ${esc(r.runId)} (result SHA-256 ${esc(r.resultSha256)}). Report generated ${esc(generatedAt.toISOString())}. A lab-run Proof Chain entry is a code-scan record with no TLS transcript, never handshake evidence.</footer>
</main></body></html>`;
}
