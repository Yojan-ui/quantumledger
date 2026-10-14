import { fail, parseBody, parseParams } from "@/lib/server/api";
import { requireFull } from "@/lib/server/app-route";
import { settingsOf } from "@/lib/server/dashboard";
import { live } from "@/lib/server/runtime";
import { IdParams, SiteSettingsBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/app/sites/{id}/settings { mode?, alertEmail?, alertWebhook? } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireFull();
  if (!a.ok) return a.res;
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const b = await parseBody(req, SiteSettingsBody);
  if (!b.ok) return b.res;
  const { repos } = await live();
  const site = await repos.sites.owned(a.account.id, p.data.id);
  if (!site) return fail("not_found", "No such site.", 404);
  const s = settingsOf(site);
  if (b.data.alertEmail !== undefined) s.alertEmail = b.data.alertEmail || undefined;
  if (b.data.alertWebhook !== undefined) s.alertWebhook = b.data.alertWebhook || undefined;
  await repos.sites.update(a.account.id, site.id, {
    settings: JSON.stringify(s),
    ...(b.data.mode ? { mode: b.data.mode } : {}),
  });
  return Response.json({ ok: true, mode: b.data.mode ?? site.mode, settings: s });
}
