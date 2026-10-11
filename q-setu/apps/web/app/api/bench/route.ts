import { parseQuery } from "@/lib/server/api";
import { BenchQuery } from "@/lib/server/schemas";
import { getBench } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bench[?fresh=1]: measured on this server, never hard-coded. */
export async function GET(req: Request) {
  const q = parseQuery(req, BenchQuery);
  if (!q.ok) return q.res;
  return Response.json(await getBench(q.data.fresh === "1"));
}
