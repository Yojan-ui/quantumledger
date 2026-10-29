import { planToMarkdown } from "@/lib/live/plan";
import { labFail } from "@/lib/lab/http";
import { findRun, isTerminal } from "@/lib/lab/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS = ["json", "csv", "cbom", "plan"] as const;

/** Spreadsheet-safe CSV cell: quoted, and formula-leading characters neutralised (CSV injection). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** GET /api/lab/runs/{id}/export?format=json|csv|cbom|plan: downloads built only from the run record. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = findRun((await ctx.params).id);
  if (!r) return labFail("not_found", "No such run", 404);
  if (!isTerminal(r.status))
    return labFail("conflict", "The run has not finished yet", 409, { status: r.status });
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  if (!FORMATS.includes(format as (typeof FORMATS)[number]))
    return labFail("invalid_input", `format must be one of ${FORMATS.join(", ")}`, 400, {
      format: `One of ${FORMATS.join(", ")}`,
    });
  const base = `quantumledger-lab-${r.runId}`;
  const download = (body: string, type: string, ext: string) =>
    new Response(body, {
      headers: {
        "content-type": type,
        "content-disposition": `attachment; filename="${base}.${ext}"`,
        "cache-control": "no-store",
      },
    });
  if (format === "json") {
    const { events: _e, ...rest } = r;
    return download(JSON.stringify(rest, null, 2), "application/json", "json");
  }
  if (format === "csv") {
    const cols = [
      "file",
      "file_sha256",
      "line",
      "column",
      "severity",
      "algorithm",
      "primitive",
      "rule_id",
      "quantum_vulnerable",
      "quantum_safe",
      "match",
      "replacement",
    ];
    const rows = r.files.flatMap((f) =>
      f.findings.map((x) => [
        f.name,
        f.sha256,
        x.line,
        x.column,
        x.severity,
        x.algorithm,
        x.primitive,
        x.ruleId,
        x.quantumVulnerable,
        x.quantumSafe,
        x.match,
        x.replacement,
      ]),
    );
    return download(
      [cols.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n") + "\r\n",
      "text/csv; charset=utf-8",
      "csv",
    );
  }
  if (format === "cbom") {
    const boms = [
      ...r.files.map((f) => ({ source: f.name, cbom: f.cbom })),
      ...(r.url
        ? [{ source: String(r.inputs.find((i) => i.source === "url")?.name), cbom: r.url.cbom }]
        : []),
    ];
    const body =
      boms.length === 1
        ? boms[0]!.cbom
        : { runId: r.runId, note: "One CycloneDX 1.6 CBOM per scanned input", boms };
    return download(JSON.stringify(body, null, 2), "application/vnd.cyclonedx+json", "cbom.json");
  }
  if (!r.plan) return labFail("not_found", "This run has no migration plan", 404);
  return download(
    planToMarkdown(r.plan, `QuantumLedger migration plan · lab run ${r.runId}`),
    "text/markdown; charset=utf-8",
    "plan.md",
  );
}
