import { fail, parseBody } from "@/lib/server/api";
import { authLimited, requireStage } from "@/lib/server/app-route";
import { confirmTotp, isSecure, sessionCookie, sessionValue } from "@/lib/server/dashboard";
import { AppCodeBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/app/totp/verify { code }: finishes enrolment, or the second step of signing in. */
export async function POST(req: Request) {
  const limited = await authLimited(req);
  if (limited) return limited;
  const s = await requireStage("enroll", "otp");
  if (!s.ok) return s.res;
  const b = await parseBody(req, AppCodeBody);
  if (!b.ok) return b.res;
  const ok = await confirmTotp(s.session.accountId, b.data.code, s.session.stage === "enroll");
  if (!ok)
    return fail(
      "forbidden",
      "That code didn't work. Check your device's clock and try the next one.",
      401,
    );
  return Response.json(
    { stage: "full" },
    {
      headers: {
        "set-cookie": sessionCookie(sessionValue(s.session.accountId, "full"), isSecure(req)),
      },
    },
  );
}
