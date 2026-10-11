import type { SectorId } from "@qsetu/sim";
import { fail, parseBody } from "@/lib/server/api";
import { live } from "@/lib/server/runtime";
import { TrafficBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/traffic { site }: a deployed Demo 2 node does one unit of real work (sign, seal, open, verify). */
export async function POST(req: Request) {
  const b = await parseBody(req, TrafficBody);
  if (!b.ok) return b.res;
  const [sector, adapter] = b.data.site.split("-") as [SectorId, string];
  try {
    live().mesh.exercise(b.data.site, sector, adapter);
  } catch (e) {
    return fail("internal", (e as Error).message, 500);
  }
  return Response.json({ site: b.data.site, ops: live().bus.siteCount(b.data.site) });
}
