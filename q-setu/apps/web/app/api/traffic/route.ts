import type { SectorId } from "@qsetu/sim";
import { fail, parseBody, safeMessage } from "@/lib/server/api";
import { getBus, live } from "@/lib/server/runtime";
import { TrafficBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/traffic { site }: a deployed Demo 2 node does one unit of real work (sign, seal, open, verify). */
export async function POST(req: Request) {
  const b = await parseBody(req, TrafficBody);
  if (!b.ok) return b.res;
  const [sector, adapter] = b.data.site.split("-") as [SectorId, string];
  try {
    (await live()).mesh.exercise(b.data.site, sector, adapter);
  } catch (e) {
    return fail("internal", safeMessage(e), 500);
  }
  return Response.json({ site: b.data.site, ops: getBus().siteCount(b.data.site) });
}
