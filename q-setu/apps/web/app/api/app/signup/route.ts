import { fail, parseBody } from "@/lib/server/api";
import { authLimited } from "@/lib/server/app-route";
import { isSecure, sessionCookie, sessionValue, signup } from "@/lib/server/dashboard";
import { AppSignupBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/app/signup { email, password }: creates an account; 2FA enrolment comes next. */
export async function POST(req: Request) {
  const limited = await authLimited(req);
  if (limited) return limited;
  const b = await parseBody(req, AppSignupBody);
  if (!b.ok) return b.res;
  const id = await signup(b.data.email, b.data.password);
  // This does reveal that an account exists; the auth rate limit keeps that from being a fast oracle.
  if (!id) return fail("conflict", "That email already has an account. Sign in instead.", 409);
  return Response.json(
    { stage: "enroll" },
    { headers: { "set-cookie": sessionCookie(sessionValue(id, "enroll"), isSecure(req)) } },
  );
}
