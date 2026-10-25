import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { validApiToken } from "./session";
import { verifyTotp } from "./totp";

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

const totpSecret = () => process.env.ADMIN_TOTP_SECRET || undefined;

/**
 * Admin needs a password (12+ characters) and, in production, a TOTP second factor too. Without
 * ADMIN_TOTP_SECRET a production server keeps admin switched off rather than run on a password alone.
 */
export function adminState(): "enabled" | "no_password" | "no_totp" {
  if (!password()) return "no_password";
  if (process.env.NODE_ENV === "production" && !totpSecret()) return "no_totp";
  return "enabled";
}
export const adminEnabled = () => adminState() === "enabled";
export const totpRequired = () => totpSecret() !== undefined;

/**
 * Checks the password in constant time whatever its length (both sides are HMAC'd to a fixed size
 * first, so a wrong length can't be told from a wrong character), then the TOTP code if configured.
 * Returns a session token, or undefined.
 */
export function checkLogin(given: string, code: string): string | undefined {
  const pw = password();
  if (!pw || !adminEnabled()) return undefined;
  const k = "qsetu-admin-compare";
  const a = createHmac("sha256", k).update(given).digest();
  const b = createHmac("sha256", k).update(pw).digest();
  const pwOk = timingSafeEqual(a, b);
  const secret = totpSecret();
  // The code is checked even when the password is wrong (same work either way), but a used code
  // is only consumed on a fully correct login.
  const codeOk = secret ? pwOk && verifyTotp(secret, code) : true;
  if (!pwOk || !codeOk) return undefined;
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

/**
 * Operator-only routes (reset everything, rotate the signing key): in production they need the admin
 * sign-in or the bearer API_TOKEN; a demo session isn't enough. Returns a 403 to send, or undefined.
 * Local development keeps them open so the presenter tools work without signing in.
 */
export async function requireOperator(req: Request): Promise<Response | undefined> {
  if (process.env.NODE_ENV !== "production") return undefined;
  if (validApiToken(req.headers.get("authorization"))) return undefined;
  if (await isAdmin()) return undefined;
  return Response.json(
    { error: { code: "forbidden", message: "This needs the admin sign-in." } },
    { status: 403 },
  );
}
