import { fail } from "@/lib/server/api";
import { isAdmin } from "@/lib/server/admin";
import { listSignups } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Quote every cell and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** GET /api/admin/signups.csv: every early-access and contact submission (admin only). */
export async function GET() {
  if (!(await isAdmin())) return fail("not_found", "Not found", 404);
  const rows = await listSignups();
  const head = ["id", "created_at", "kind", "name", "email", "organisation", "sector", "use_case"];
  const csv = [
    head.join(","),
    ...rows.map((r) =>
      [r.id, r.createdAt, r.kind, r.name, r.email, r.organisation, r.sector, r.useCase]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
  return new Response(csv + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="quantumledger-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
