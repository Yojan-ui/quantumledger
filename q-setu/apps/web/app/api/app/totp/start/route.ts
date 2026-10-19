import { fail } from "@/lib/server/api";
import { requireStage } from "@/lib/server/app-route";
import { startEnrollment } from "@/lib/server/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/app/totp/start: a new authenticator secret for an account that has none yet. */
export async function POST() {
  const s = await requireStage("enroll");
  if (!s.ok) return s.res;
  const e = await startEnrollment(s.session.accountId);
  if (!e) return fail("conflict", "Two-factor is already set up.", 409);
  return Response.json(e, { headers: { "cache-control": "no-store" } });
}
