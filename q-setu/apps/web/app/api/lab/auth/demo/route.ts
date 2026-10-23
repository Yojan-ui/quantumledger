import { fail } from "@/lib/server/api";
import { demoAccounts, normaliseEmail, sessionCookie, sessionToken } from "@/lib/lab/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lab/auth/demo (form or JSON { email }): demo mode only. A demo address signs in at once,
 * with no email, and lands on /lab. It works as a plain HTML form, so it doesn't wait for the page's
 * JavaScript. The session is the same signed cookie a magic link gives, so every role check
 * applies unchanged: a demo customer still sees only their own data.
 */
export async function POST(req: Request) {
  const accounts = demoAccounts();
  if (!accounts.length) return fail("not_found", "Demo sign-in is off on this server.", 404);
  const form = (req.headers.get("content-type") ?? "").includes("application/json")
    ? ((await req.json().catch(() => ({}))) as { email?: unknown })
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  const email = normaliseEmail(form.email);
  const origin = new URL(req.url).origin;
  const account = accounts.find((a) => a.email === email);
  const token =
    account &&
    sessionToken({
      email: account.email,
      role: account.role,
      ...(account.customerId ? { customerId: account.customerId } : {}),
    });
  if (!token)
    return new Response(null, {
      status: 303,
      headers: { location: new URL("/lab/sign-in?error=demo", origin).href },
    });
  const secure = origin.startsWith("https:") || req.headers.get("x-forwarded-proto") === "https";
  return new Response(null, {
    status: 303,
    headers: { location: new URL("/lab", origin).href, "set-cookie": sessionCookie(token, secure) },
  });
}
