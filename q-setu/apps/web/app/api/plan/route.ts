import { parseBody } from "@/lib/server/api";
import { buildPlan, planToMarkdown } from "@/lib/live/plan";
import { PlanBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/plan { findings, dataLifetimeYears, source, format? }: an ordered migration checklist. */
export async function POST(req: Request) {
  const b = await parseBody(req, PlanBody);
  if (!b.ok) return b.res;
  const { format, ...input } = b.data;
  const plan = buildPlan(input);
  if (format === "markdown")
    return new Response(planToMarkdown(plan), {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  return Response.json({ ...plan, markdown: planToMarkdown(plan) });
}
