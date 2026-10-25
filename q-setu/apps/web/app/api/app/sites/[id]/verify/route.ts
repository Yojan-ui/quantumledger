import { verifyOwnership, verifyRouting } from "@qsetu/shield-edge/onboard";
import { fail, parseParams } from "@/lib/server/api";
import { requireFull } from "@/lib/server/app-route";
import { live } from "@/lib/server/runtime";
import { IdParams } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/sites/{id}/verify: checks the TXT ownership record (and reports whether the CNAME is in
 * place yet). A domain can be verified by one account only.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireFull();
  if (!a.ok) return a.res;
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const { repos } = await live();
  const site = await repos.sites.owned(a.account.id, p.data.id);
  if (!site) return fail("not_found", "No such site.", 404);
  const owner = await repos.sites.verifiedFor(site.domain);
  if (owner && owner.id !== site.id)
    return fail("conflict", "Another account has already verified this domain.", 409);
  const own = await verifyOwnership(site.domain, site.verifyToken);
  if (own.ok && !site.verifiedAt)
    await repos.sites.update(a.account.id, site.id, { verifiedAt: new Date().toISOString() });
  const routing = await verifyRouting(site.domain);
  return Response.json({ ownership: own, routing, verified: own.ok || !!site.verifiedAt });
}
