import { consumeLink, sessionCookie, sessionToken, teamEmails, type LabUser } from "@/lib/lab/auth";
import { customersFromEngine } from "@/lib/lab/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lab/auth/verify?token=…: the magic link. Signs in once, then sends the user to /lab. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (path: string) => Response.redirect(new URL(path, url.origin), 303);
  const email = consumeLink(url.searchParams.get("token") ?? undefined);
  if (!email) return back("/lab/sign-in?error=link");

  let user: LabUser | undefined;
  if (teamEmails().includes(email)) user = { email, role: "team" };
  else {
    const c = (await customersFromEngine().catch(() => [])).find((x) => x.emails.includes(email));
    if (c) user = { email, role: "customer", customerId: c.id };
  }
  const token = user && sessionToken(user);
  if (!token) return back("/lab/sign-in?error=access");
  const secure = url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/lab", url.origin).href,
      "set-cookie": sessionCookie(token, secure),
    },
  });
}
