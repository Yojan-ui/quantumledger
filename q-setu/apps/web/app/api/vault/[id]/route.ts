import { fail, parseParams } from "@/lib/server/api";
import { getBus } from "@/lib/server/runtime";
import { IdParams } from "@/lib/server/schemas";
import { getVault } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/vault/:id: verify the ML-DSA signature, unwrap the ML-KEM-wrapped key, decrypt. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = parseParams(await ctx.params, IdParams);
  if (!p.ok) return p.res;
  const t = performance.now();
  try {
    const r = await getVault().vault.get(p.data.id);
    getBus().publish({
      op: "OPEN",
      source: "vault",
      alg: "ml-kem-768 · ml-dsa-65",
      ms: performance.now() - t,
      ok: true,
      detail: `record ${p.data.id} verified`,
    });
    return Response.json(r);
  } catch (e) {
    const reason = (e as { reason?: string }).reason;
    getBus().publish({
      op: "REJECT",
      source: "vault",
      alg: "ml-dsa-65",
      ms: performance.now() - t,
      ok: false,
      detail: `record ${p.data.id}: ${reason ?? "rejected"}`,
    });
    return fail("conflict", (e as Error).message, 409, { reason });
  }
}
