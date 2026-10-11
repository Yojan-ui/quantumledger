import { SECTORS } from "@qsetu/sim";
import { parseBody, SectorBody } from "@/lib/server/api";
import { live } from "@/lib/server/runtime";
import { getVault } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/vault { sector }: store one record; returns exactly what the database now holds. */
export async function POST(req: Request) {
  const b = await parseBody(req, SectorBody);
  if (!b.ok) return b.res;
  const sector = b.data.sector;
  const { vault, store } = getVault();
  const record = SECTORS[sector].generate();
  const t = performance.now();
  const put = await vault.put(record, {
    id: record.recordId,
    meta: { sector, type: SECTORS[sector].noun },
  });
  const stored = store.raw.get(put.id);
  live().bus.publish({
    op: "SEAL",
    source: "vault",
    alg: "ml-kem-768 · ml-dsa-65",
    ms: performance.now() - t,
    ok: true,
    sector,
    bytes: stored ? Buffer.from(stored.ct, "base64").length : undefined,
    detail: `record ${put.id} at rest`,
  });
  return Response.json({ record, put, stored });
}
