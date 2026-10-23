import { fail, parseBody } from "@/lib/server/api";
import { authLimited } from "@/lib/server/app-route";
import { isSecure, login, sessionCookie, sessionValue } from "@/lib/server/dashboard";
import { AppLoginBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/app/login { email, password }: the first factor. The answer says which step is next. */
export async function POST(req: Request) {
  const limited = await authLimited(req);
  if (limited) return limited;
  const b = await parseBody(req, AppLoginBody);
  if (!b.ok) return b.res;
  const r = await login(b.data.email, b.data.password);
  if (!r) return fail("forbidden", "That email or password didn't work.", 401);
  return Response.json(
    { stage: r.stage },
    { headers: { "set-cookie": sessionCookie(sessionValue(r.accountId, r.stage), isSecure(req)) } },
  );
}
