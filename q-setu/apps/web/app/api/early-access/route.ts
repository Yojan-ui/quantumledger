import { fail, parseBody } from "@/lib/server/api";
import { clientKey, RateLimiter } from "@/lib/live/rate-limit";
import { sendConfirmation } from "@/lib/server/email";
import { EarlyAccessBody } from "@/lib/server/schemas";
import { saveSignup } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __qsetuSignupLimit?: RateLimiter };
const limiter = (g.__qsetuSignupLimit ??= new RateLimiter(5, 10 * 60_000));

/**
 * POST /api/early-access { kind, name, email, organisation, sector, useCase }: stores an early-access
 * request or contact message. zod-validated, honeypot-protected, 5 per 10 minutes per client. Sends a
 * confirmation email only if RESEND_API_KEY is set.
 */
export async function POST(req: Request) {
  const wait = limiter.take(clientKey(req));
  if (wait) return fail("rate_limited", `Too many requests. Try again in ${wait} s.`, 429);
  const b = await parseBody(req, EarlyAccessBody);
  if (!b.ok) return b.res;
  const { website, ...data } = b.data;
  // A bot filled the hidden field: pretend it worked, store nothing.
  if (website) return Response.json({ ok: true });
  await saveSignup({ ...data, createdAt: new Date().toISOString() });
  await sendConfirmation(data.email, data.name, data.kind).catch(() => {});
  return Response.json({ ok: true });
}
