import { fail, parseParams } from "@/lib/server/api";
import { sweep } from "@/lib/live/proof";
import { live } from "@/lib/server/runtime";
import { AnchorParams } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/proof/{id}/verify: the verification sweep for one anchor. A fresh ML-DSA check of its
 * signed checkpoint, a walk of every entry after the checkpoint, and the Merkle root recomputed.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = parseParams(await ctx.params, AnchorParams);
  if (!p.ok) return p.res;
  const { ledger, bus } = await live();
  try {
    const r = await sweep(ledger, p.data.id);
    bus.publish({
      op: r.ok ? "VERIFY" : "REJECT",
      source: "ledger",
      alg: "sha3-256 · merkle · ml-dsa",
      ms: r.ms,
      ok: r.ok,
      detail: r.ok
        ? `anchor #${p.data.id}: checkpoint + ${r.segment.checked} entries + Merkle root verified`
        : `sweep stopped at #${r.broken?.id ?? p.data.id}: ${r.broken?.reason ?? "merkle root mismatch"}`,
    });
    return Response.json(r);
  } catch (e) {
    return fail("not_found", (e as Error).message, 404);
  }
}
