import { fail, parseParams } from "@/lib/server/api";
import { IdParams } from "@/lib/server/schemas";
import { getVault } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/vault/:id/tamper: simulates an insider editing the stored ciphertext directly in the DB. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const r = getVault().store.raw.get(p.data.id);
  if (!r) return fail("not_found", "Not found", 404);
  const b = Buffer.from(r.ct, "base64");
  b[Math.floor(b.length / 2)]! ^= 0x01;
  r.ct = b.toString("base64");
  return Response.json({ ok: true, flipped: "one bit of the record ciphertext" });
}
