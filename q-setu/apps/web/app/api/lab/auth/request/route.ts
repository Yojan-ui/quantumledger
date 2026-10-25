import { fail, readText } from "@/lib/server/api";
import { siteUrl } from "@/lib/server/env";
import { labEnabled, linkToken, normaliseEmail, teamEmails } from "@/lib/lab/auth";
import { customersFromEngine } from "@/lib/lab/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lab/auth/request { email }: emails a one-time sign-in link to a team or customer
 * address. The answer is the same whether or not the address is known, so it can't be used to
 * find out who has access. Email goes out through Resend when RESEND_API_KEY is set; without it
 * the link is written to the server log, and in development also returned, so it can be clicked.
 */
export async function POST(req: Request) {
  if (!labEnabled()) return fail("forbidden", "The Lab is switched off on this server.", 403);
  let email: string | undefined;
  try {
    email = normaliseEmail(
      (JSON.parse((await readText(req, 2048)) ?? "{}") as { email?: unknown }).email,
    );
  } catch {
    email = undefined;
  }
  if (!email) return fail("invalid_input", "Enter a valid email address.", 400);

  let known = teamEmails().includes(email);
  if (!known) {
    try {
      known = (await customersFromEngine()).some((c) => c.emails.includes(email!));
    } catch {
      known = false;
    }
  }
  const sent = {
    sent: true,
    message: "If that address has Lab access, a sign-in link is on its way.",
  };
  if (!known) return Response.json(sent);

  // The link's host comes from configuration, never from the request: a Host header is the
  // sender's to choose, and a link pointing elsewhere would hand that host the sign-in token.
  // Without NEXT_PUBLIC_SITE_URL a production server sends no links at all.
  if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production") {
    console.error("[lab] sign-in links need NEXT_PUBLIC_SITE_URL; none sent");
    return Response.json(sent);
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL ? siteUrl() : new URL(req.url).origin;
  const link = `${origin}/api/lab/auth/verify?token=${encodeURIComponent(linkToken(email)!)}`;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "QuantumLedger <hello@quantumledger.example>",
        to: email,
        subject: "Your QuantumLedger Lab sign-in link",
        text: `Sign in to the QuantumLedger Lab (valid for 15 minutes, once):\n\n${link}\n\nIf you didn't ask for this, ignore this email.`,
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  } else {
    console.log(`[lab] sign-in link for ${email}: ${link}`);
  }
  return Response.json(process.env.NODE_ENV === "production" ? sent : { ...sent, devLink: link });
}
