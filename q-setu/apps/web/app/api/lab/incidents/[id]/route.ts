import { isDenied } from "@/lib/lab/access";
import { incidentFor } from "@/lib/lab/data";
import { denied, withLab } from "@/lib/lab/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/incidents/{id}: one incident's timeline and signature check, if it is in scope. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withLab(req, {}, async ({ scope }) => {
    const d = await incidentFor(scope, id);
    return isDenied(d) ? denied(d) : Response.json(d);
  });
}
