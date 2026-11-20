import { fail } from "@/lib/server/api";
import { engine, EngineMissing } from "@/lib/lab/engine";
import { withLab } from "@/lib/lab/route";
import type { ReplayJob } from "@/lib/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/replay/{id} (team only): a replay's progress and its bare-vs-protected results. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withLab(req, { team: true }, async () => {
    if (!/^rp_[a-z0-9]{1,24}$/.test(id)) return fail("not_found", "No such replay.", 404);
    try {
      return Response.json(await engine<ReplayJob>(`/api/replays/${id}`));
    } catch (e) {
      if (e instanceof EngineMissing) return fail("not_found", "No such replay.", 404);
      throw e;
    }
  });
}
