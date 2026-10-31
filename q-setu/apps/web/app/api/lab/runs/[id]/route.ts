import { labFail, noStore } from "@/lib/lab/http";
import { findRun } from "@/lib/lab/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/runs/{id}: status, stages, progress and log (no findings; see /result). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = findRun((await ctx.params).id);
  if (!r) return labFail("not_found", "No such run", 404);
  const { files, url, plan, events: _e, ...state } = r;
  return Response.json(
    {
      ...state,
      files: files.map((f) => ({
        name: f.name,
        score: f.score,
        grade: f.grade,
        findings: f.findings.length,
      })),
      hasUrl: !!url,
      planSteps: plan?.steps.length ?? null,
    },
    { headers: noStore },
  );
}
