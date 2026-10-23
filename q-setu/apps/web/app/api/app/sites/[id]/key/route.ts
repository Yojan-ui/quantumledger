import { fail, parseParams } from "@/lib/server/api";
import { requireFull } from "@/lib/server/app-route";
import { rotateSiteKey } from "@/lib/server/dashboard";
import { IdParams } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/app/sites/{id}/key: a new site key (shown once); the old one stops working at once. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireFull();
  if (!a.ok) return a.res;
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const key = await rotateSiteKey(a.account.id, p.data.id);
  if (!key) return fail("not_found", "No such site.", 404);
  return Response.json({ key }, { headers: { "cache-control": "no-store" } });
}
