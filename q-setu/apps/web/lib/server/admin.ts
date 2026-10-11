import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "qsetu_admin";

/** The admin session token: HMAC of a fixed label under ADMIN_PASSWORD. Changing the password logs everyone out. */
function token(): string | undefined {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < 12) return undefined;
  return createHmac("sha256", pw).update("qsetu-admin-v1").digest("base64url");
}

export const adminEnabled = () => token() !== undefined;

export function checkPassword(pw: string): string | undefined {
  const t = token();
  const pwEnv = process.env.ADMIN_PASSWORD ?? "";
  if (!t) return undefined;
  const a = Buffer.from(pw);
  const b = Buffer.from(pwEnv);
  return a.length === b.length && timingSafeEqual(a, b) ? t : undefined;
}

export async function isAdmin(): Promise<boolean> {
  const t = token();
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!t || !c) return false;
  const a = Buffer.from(c);
  const b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}
