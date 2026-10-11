import { fail, parseParams } from "@/lib/server/api";
import { lookup } from "@/lib/server/certs";
import { IdParams } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/certs/:id: the public credential registry. Anyone can fetch it; only the signature makes it trustworthy. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const r = lookup(p.data.id);
  return r ? Response.json(r) : fail("not_found", "Not found", 404);
}
