import { fail, readText } from "@/lib/server/api";
import { engine } from "@/lib/lab/engine";
import { withLab } from "@/lib/lab/route";
import type { Customer } from "@/lib/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/lab/customers/{id} { note?, readiness?, shieldSiteId? } (team only): the customer panel. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withLab(req, { team: true }, async ({ user, customers }) => {
    if (!customers.some((c) => c.id === id)) return fail("not_found", "No such customer.", 404);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse((await readText(req, 8192)) ?? "{}") as Record<string, unknown>;
    } catch {
      return fail("invalid_input", "That isn't valid JSON.", 400);
    }
    const patch: Record<string, unknown> = {};
    if ("note" in body) patch.note = body.note;
    if ("readiness" in body) patch.readiness = body.readiness;
    if ("shieldSiteId" in body) patch.shieldSiteId = body.shieldSiteId;
    try {
      return Response.json(
        await engine<Customer>(`/api/customers/${id}`, {
          method: "PUT",
          body: JSON.stringify({ ...patch, by: user.email }),
        }),
      );
    } catch (e) {
      return fail("invalid_input", e instanceof Error ? e.message : "Couldn't save.", 400);
    }
  });
}
