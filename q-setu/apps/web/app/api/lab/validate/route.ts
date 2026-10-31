import { labBody, labFail, noStore } from "@/lib/lab/http";
import { ValidateBody } from "@/lib/lab/inputs";
import { resolveInputs } from "@/lib/lab/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/lab/validate: the same checks as a run, without running. Returns a parse preview per input. */
export async function POST(req: Request) {
  const b = await labBody(req, ValidateBody);
  if (!b.ok) return b.res;
  const r = resolveInputs(b.data.workspace, b.data.inputs);
  if (!r.ok)
    return labFail("invalid_input", Object.values(r.fields)[0] ?? "Invalid input", 400, r.fields);
  return Response.json(
    {
      ok: true,
      dataLifetimeYears: b.data.dataLifetimeYears,
      preview: r.inputs.map(({ text, ...meta }) => ({
        ...meta,
        head: text ? text.split(/\r?\n/).slice(0, 6) : [],
      })),
    },
    { headers: noStore },
  );
}
