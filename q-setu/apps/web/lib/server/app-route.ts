import "server-only";
/** Shared pieces of the dashboard's API routes. */
import { fail } from "./api";
import { currentSession, fullAccount } from "./dashboard";
import { take, tooMany } from "./limits";

/** Sign-up, sign-in and code checks: 10 per 15 minutes per client, on top of the API limits. */
const AUTH = { name: "app-auth", limit: 10, windowMs: 15 * 60_000 };

export async function authLimited(req: Request): Promise<Response | undefined> {
  const v = await take(req, [AUTH]);
  return v.ok ? undefined : tooMany(v, "sign-in attempts");
}

export async function requireFull() {
  const a = await fullAccount();
  return a
    ? { ok: true as const, account: a }
    : { ok: false as const, res: fail("forbidden", "Sign in first.", 401) };
}

export async function requireStage(...stages: ("enroll" | "otp")[]) {
  const s = await currentSession();
  return s && (stages as string[]).includes(s.stage)
    ? { ok: true as const, session: s }
    : { ok: false as const, res: fail("forbidden", "Sign in first.", 401) };
}
