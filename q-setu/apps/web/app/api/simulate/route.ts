import { parseBody } from "@/lib/server/api";
import { SimulateBody } from "@/lib/server/schemas";
import { getNetwork } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/simulate { sector, count?: 1–20, paceMs?: 0–3000, wait?: boolean } */
export async function POST(req: Request) {
  const b = await parseBody(req, SimulateBody);
  if (!b.ok) return b.res;
  const { records, done } = getNetwork(b.data.sector).simulate(b.data.count, b.data.paceMs);
  if (b.data.wait) await done;
  return Response.json({ records: records.map((r) => r.recordId) });
}
