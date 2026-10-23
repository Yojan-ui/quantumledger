import { fail } from "@/lib/server/api";
import { runPluginAttack } from "@/lib/server/shield-plugin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/shield/plugin/attack: a scripted agent's burst against Shield Edge in front of the demo bank. */
export async function POST() {
  const r = await runPluginAttack();
  if (r === "busy")
    return fail("conflict", "A run is already in progress. Try again in a minute.", 409);
  return Response.json({ results: r }, { headers: { "cache-control": "no-store" } });
}
