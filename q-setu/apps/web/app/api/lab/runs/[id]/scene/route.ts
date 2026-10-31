import { labFail } from "@/lib/lab/http";
import { findRun, isTerminal } from "@/lib/lab/runs";
import { buildScene, sceneEtag } from "@/lib/lab/scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/lab/runs/{id}/scene: data for the 3D layer of a finished run. A finished run never changes, so
 * the ETag is its result SHA-256; If-None-Match answers 304.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = findRun((await ctx.params).id);
  if (!r) return labFail("not_found", "No such run", 404);
  if (!isTerminal(r.status) || !r.resultSha256)
    return labFail("conflict", "The run has not finished yet", 409, { status: r.status });
  const etag = sceneEtag(r);
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return Response.json(buildScene(r), { headers });
}
