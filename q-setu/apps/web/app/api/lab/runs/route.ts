import { clientKey } from "@/lib/live/rate-limit";
import { realDeps } from "@/lib/lab/deps";
import { labBody, labFail, noStore } from "@/lib/lab/http";
import { RunBody } from "@/lib/lab/inputs";
import { activeRunFor, startRun } from "@/lib/lab/runs";
import { readWorkspace, resolveInputs } from "@/lib/lab/workspace";
import { live } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/lab/runs: validate, then start a run → 202 {runId}. 409 while the workspace has an active run. */
export async function POST(req: Request) {
  const b = await labBody(req, RunBody);
  if (!b.ok) return b.res;
  if (!readWorkspace(b.data.workspace))
    return labFail("not_found", "No such workspace", 404, { workspace: "Unknown workspace" });
  const busy = activeRunFor(b.data.workspace);
  if (busy)
    return labFail("conflict", `A run is already in progress in this workspace (${busy})`, 409, {
      workspace: busy,
    });
  const r = resolveInputs(b.data.workspace, b.data.inputs);
  if (!r.ok)
    return labFail("invalid_input", Object.values(r.fields)[0] ?? "Invalid input", 400, r.fields);
  if (r.inputs.some((i) => i.source === "url" && i.probeLive)) {
    const wait = (await live()).scanLimiter.take(clientKey(req));
    if (wait) return labFail("rate_limited", `Too many live probes. Try again in ${wait} s.`, 429);
  }
  const rec = startRun(b.data.workspace, b.data, r.inputs, await realDeps());
  if (!rec) return labFail("conflict", "A run is already in progress in this workspace", 409);
  return Response.json(
    { runId: rec.runId, status: rec.status, workspace: rec.workspace },
    { status: 202, headers: noStore },
  );
}
