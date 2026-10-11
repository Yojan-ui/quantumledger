import { parseQuery } from "@/lib/server/api";
import { SectorQuery } from "@/lib/server/schemas";
import { getNetwork } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/harvest?sector=: everything the eavesdropper recorded. It's all public wire data. */
export function GET(req: Request) {
  const q = parseQuery(req, SectorQuery);
  if (!q.ok) return q.res;
  return Response.json({ records: getNetwork(q.data.sector).harvested() });
}
