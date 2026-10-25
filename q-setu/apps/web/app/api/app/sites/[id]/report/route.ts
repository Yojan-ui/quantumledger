import { fail, parseParams, parseQuery } from "@/lib/server/api";
import { requireFull } from "@/lib/server/app-route";
import { textPdf } from "@/lib/server/pdf";
import { live } from "@/lib/server/runtime";
import { IdParams, ReportQuery } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (n: number | null) =>
  n === null ? "n/a (no Shield Edge data)" : `${(n * 100).toFixed(1)}%`;

/** GET /api/app/sites/{id}/report?month=YYYY-MM: the month's Shield report as a PDF. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireFull();
  if (!a.ok) return a.res;
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const q = parseQuery(req, ReportQuery);
  if (!q.ok) return q.res;
  const { repos } = await live();
  const site = await repos.sites.owned(a.account.id, p.data.id);
  if (!site) return fail("not_found", "No such site.", 404);
  const [y, m] = q.data.month.split("-").map(Number) as [number, number];
  const from = `${q.data.month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const days = await repos.shieldStats.range(site.id, from, to);
  const sum = (k: "pq" | "classical" | "requests" | "challenged" | "blocked") =>
    days.reduce((n, d) => n + Number(d[k]), 0);
  const tls = sum("pq") + sum("classical");
  const events = (await repos.shieldEvents.since(site.id, Date.UTC(y, m - 1, 1))).filter(
    (e) => e.at < Date.UTC(y, m, 1),
  );
  const byType = new Map<string, number>();
  for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  const reasons = new Map<string, number>();
  for (const e of events)
    for (const r of (JSON.parse(e.detail) as { reasons?: string[] }).reasons ?? [])
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
  const lines = [
    `QUANTUMLEDGER SHIELD - MONTHLY REPORT - ${site.domain}`,
    `Month ${q.data.month} · generated ${new Date().toISOString()}`,
    `Mode now: ${site.mode} · domain ${site.verifiedAt ? `verified ${site.verifiedAt.slice(0, 10)}` : "NOT verified"}`,
    "",
    "TRAFFIC",
    `  Requests seen                 ${sum("requests")}`,
    `  TLS connections (Shield Edge) ${tls}`,
    `  Quantum-safe (X25519MLKEM768) ${pct(tls ? sum("pq") / tls : null)}`,
    `  Challenged                    ${sum("challenged")}`,
    `  Blocked (incl. honeypots)     ${sum("blocked")}`,
    "",
    "EVENTS BY TYPE",
    ...[...byType].sort((a, b) => b[1] - a[1]).map(([t, n]) => `  ${t.padEnd(30)}${n}`),
    ...(byType.size ? [] : ["  none"]),
    "",
    "TOP REASONS",
    ...[...reasons]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([r, n]) => `  ${r.slice(0, 60).padEnd(62)}${n}`),
    ...(reasons.size ? [] : ["  none"]),
    "",
    "DAY BY DAY (requests / pq / classical / challenged / blocked)",
    ...days.map(
      (d) =>
        `  ${d.day}  ${d.requests} / ${d.pq} / ${d.classical} / ${d.challenged} / ${d.blocked}`,
    ),
    "",
    "NOTES",
    "  Counts are what Shield reported to the dashboard. IPs are stored only as keyed hashes.",
    "  Quantum-safe share needs Shield Edge in front; the middleware alone cannot see TLS.",
  ];
  return new Response(new Uint8Array(textPdf(lines)), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="shield-${site.domain}-${q.data.month}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
