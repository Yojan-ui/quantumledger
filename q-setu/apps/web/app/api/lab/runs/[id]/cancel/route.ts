import { labFail, noStore } from "@/lib/lab/http";
import { cancelRun, isTerminal } from "@/lib/lab/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/lab/runs/{id}/cancel: stops the run at the next unit boundary. 409 if it already finished. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = cancelRun((await ctx.params).id);
  if (!r) return labFail("not_found", "No such run", 404);
  if (isTerminal(r.status))
    return labFail("conflict", `The run already finished (${r.status})`, 409, { status: r.status });
  return Response.json({ runId: r.runId, status: "cancelling" }, { status: 202, headers: noStore });
}
