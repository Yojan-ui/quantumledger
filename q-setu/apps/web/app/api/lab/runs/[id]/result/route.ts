import { labFail, noStore } from "@/lib/lab/http";
import { findRun, isTerminal } from "@/lib/lab/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/runs/{id}/result: the full run record once the run has finished (409 while running). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = findRun((await ctx.params).id);
  if (!r) return labFail("not_found", "No such run", 404);
  if (!isTerminal(r.status))
    return labFail("conflict", "The run has not finished yet", 409, { status: r.status });
  const { events: _e, ...rest } = r;
  return Response.json(rest, { headers: noStore });
}
