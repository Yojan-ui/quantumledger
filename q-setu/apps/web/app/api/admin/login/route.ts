import { RateLimiter, clientKey } from "@/lib/live/rate-limit";
import { ADMIN_COOKIE, checkPassword } from "@/lib/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __qsetuAdminLimit?: RateLimiter };
const limiter = (g.__qsetuAdminLimit ??= new RateLimiter(5, 15 * 60_000));

/** POST /api/admin/login (form): sets the admin cookie if ADMIN_PASSWORD matches. 5 tries / 15 min. */
export async function POST(req: Request) {
  const back = (q: string, cookie?: string) =>
    new Response(null, {
      status: 303,
      headers: { location: `/admin${q}`, ...(cookie ? { "set-cookie": cookie } : {}) },
    });
  if (limiter.take(clientKey(req))) return back("?error=rate");
  const pw = String((await req.formData()).get("password") ?? "");
  const t = checkPassword(pw);
  if (!t) return back("?error=1");
  return back(
    "",
    `${ADMIN_COOKIE}=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
