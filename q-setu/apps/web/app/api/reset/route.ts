import { parseBody, SectorBody } from "@/lib/server/api";
import { getNetwork } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/reset { sector }: clears what the eavesdropper has recorded for one sector. */
export async function POST(req: Request) {
  const b = await parseBody(req, SectorBody);
  if (!b.ok) return b.res;
  getNetwork(b.data.sector).reset();
  return Response.json({ ok: true });
}
