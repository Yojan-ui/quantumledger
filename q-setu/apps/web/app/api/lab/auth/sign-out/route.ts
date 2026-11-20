import { clearCookie } from "@/lib/lab/auth";

export const runtime = "nodejs";

/** POST /api/lab/auth/sign-out: ends the Lab session. */
export async function POST() {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearCookie() } });
}
