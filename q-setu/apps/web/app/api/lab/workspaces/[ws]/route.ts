import { labFail, noStore } from "@/lib/lab/http";
import { activeRunFor, summarize, type RunRecord } from "@/lib/lab/runs";
import { listRuns, readWorkspace } from "@/lib/lab/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/workspaces/{ws}: the workspace, its active run (if any) and finished runs, newest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ ws: string }> }) {
  const { ws } = await ctx.params;
  const meta = readWorkspace(ws);
  if (!meta) return labFail("not_found", "No such workspace", 404, { ws: "Unknown workspace" });
  return Response.json(
    { ...meta, activeRun: activeRunFor(ws) ?? null, runs: listRuns<RunRecord>(ws).map(summarize) },
    { headers: noStore },
  );
}
