import { fail } from "@/lib/server/api";
import {
  demoAccounts,
  normaliseEmail,
  sessionCookie,
  sessionToken,
  teamEmails,
  type LabUser,
} from "@/lib/lab/auth";
import { engine } from "@/lib/lab/engine";
import type { Customer } from "@/lib/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lab/auth/demo (form or JSON { email }): demo mode only. Any valid email address signs
 * in at once, with no email sent, and lands on /lab:
 *  - the demo accounts keep their roles (the team admin sees everyone; the demo customers their own);
 *  - an address that is already a member of a customer signs in as that customer;
 *  - any other address gets the workspace for its email domain (created empty on first use), and
 *    is a customer of that workspace only.
 * It works as a plain HTML form, so it doesn't wait for the page's JavaScript. The session is the
 * same signed cookie a magic link gives, so every server-side role and customer check applies
 * unchanged. Only a malformed address is refused.
 */
export async function POST(req: Request) {
  const accounts = demoAccounts();
  if (!accounts.length) return fail("not_found", "Demo sign-in is off on this server.", 404);
  const form = (req.headers.get("content-type") ?? "").includes("application/json")
    ? ((await req.json().catch(() => ({}))) as { email?: unknown })
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  const email = normaliseEmail(form.email);
  const origin = new URL(req.url).origin;
  const back = (error: string) =>
    new Response(null, {
      status: 303,
      headers: { location: new URL(`/lab/sign-in?error=${error}`, origin).href },
    });
  if (!email) return back("email");

  let user: LabUser | undefined;
  const account = accounts.find((a) => a.email === email);
  if (account)
    user = {
      email: account.email,
      role: account.role,
      ...(account.customerId ? { customerId: account.customerId } : {}),
    };
  else if (teamEmails().includes(email)) user = { email, role: "team" };
  else {
    try {
      const c = await engine<Customer>("/api/customers/ensure", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      user = { email, role: "customer", customerId: c.id };
    } catch {
      return back("engine");
    }
  }
  const token = sessionToken(user);
  if (!token) return back("engine");
  const secure = origin.startsWith("https:") || req.headers.get("x-forwarded-proto") === "https";
  return new Response(null, {
    status: 303,
    headers: { location: new URL("/lab", origin).href, "set-cookie": sessionCookie(token, secure) },
  });
}
