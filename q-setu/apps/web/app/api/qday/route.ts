import { parseBody, SectorBody } from "@/lib/server/api";
import { getNetwork } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/qday { sector }: the Q-Setu half of Q-Day. It runs on the server because it needs the
 * simulated Shor oracle. The classical half (Pollard's rho) runs live in the browser.
 */
export async function POST(req: Request) {
  const b = await parseBody(req, SectorBody);
  if (!b.ok) return b.res;
  return Response.json({ qsetu: getNetwork(b.data.sector).qDayQsetu() });
}
