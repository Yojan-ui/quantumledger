import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "qsetu_admin";

/** Admin sessions last 8 hours (the cookie's Max-Age matches). */
export const ADMIN_SESSION_MS = 8 * 3600_000;

function password(): string | undefined {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length >= 12 ? pw : undefined;
}

/**
 * The admin session token: "<issued-at>.<HMAC-SHA256(password, label + issued-at)>". It expires
 * after ADMIN_SESSION_MS (checked from the signed timestamp, not just the cookie's Max-Age), and
 * changing the password logs everyone out.
 */
function mac(pw: string, iat: string): string {
  return createHmac("sha256", pw).update(`qsetu-admin-v2.${iat}`).digest("base64url");
}

export const adminEnabled = () => password() !== undefined;

export function checkPassword(given: string): string | undefined {
  const pw = password();
  if (!pw) return undefined;
  const a = Buffer.from(given);
  const b = Buffer.from(pw);
  if (!(a.length === b.length && timingSafeEqual(a, b))) return undefined;
  const iat = String(Date.now());
  return `${iat}.${mac(pw, iat)}`;
}

export async function isAdmin(): Promise<boolean> {
  const pw = password();
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!pw || !c || c.length > 128) return false;
  const [iat, sig] = c.split(".");
  if (!iat || !sig || !/^\d{13}$/.test(iat)) return false;
  const age = Date.now() - Number(iat);
  if (age < 0 || age > ADMIN_SESSION_MS) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(mac(pw, iat));
  return a.length === b.length && timingSafeEqual(a, b);
}
