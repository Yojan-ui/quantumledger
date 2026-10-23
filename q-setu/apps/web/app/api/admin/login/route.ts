import { RateLimiter, clientKey } from "@/lib/live/rate-limit";
import { ADMIN_COOKIE, checkLogin } from "@/lib/server/admin";
import { alert } from "@/lib/server/alert";
import { ipHash, log } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as {
  __qsetuAdminLimit?: RateLimiter;
  __qsetuAdminBurst?: Map<string, number>;
};
const limiter = (g.__qsetuAdminLimit ??= new RateLimiter(5, 15 * 60_000));
/** When each client last triggered a burst alert (one alert per client per window, not per try). */
const alerted = (g.__qsetuAdminBurst ??= new Map());

/**
 * POST /api/admin/login (form): password, plus a 6-digit TOTP code when ADMIN_TOTP_SECRET is set.
 * 5 tries per 15 minutes per client; every failure is logged, and running out of tries raises an
 * alert (ALERT_WEBHOOK_URL).
 */
export async function POST(req: Request) {
  const back = (q: string, cookie?: string) =>
    new Response(null, {
      status: 303,
      headers: { location: `/admin${q}`, ...(cookie ? { "set-cookie": cookie } : {}) },
    });
  const who = clientKey(req);
  if (limiter.take(who)) {
    const last = alerted.get(who) ?? 0;
    if (Date.now() - last > 15 * 60_000) {
      alerted.set(who, Date.now());
      if (alerted.size > 10_000) alerted.clear();
      void alert("admin_login_burst", {
        ip: ipHash(req),
        detail: "5 failed admin sign-ins in 15 minutes; further tries refused",
      });
    }
    return back("?error=rate");
  }
  const form = await req.formData();
  const pw = String(form.get("password") ?? "").slice(0, 256);
  const code = String(form.get("code") ?? "")
    .trim()
    .slice(0, 6);
  const t = checkLogin(pw, code);
  if (!t) {
    log(req, "admin-login", 303, 0, { result: "failed" });
    return back("?error=1");
  }
  log(req, "admin-login", 303, 0, { result: "ok" });
  const secure =
    new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return back(
    "",
    `${ADMIN_COOKIE}=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? "; Secure" : ""}`,
  );
}
