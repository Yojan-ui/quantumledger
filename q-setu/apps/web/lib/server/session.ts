/**
 * The anonymous demo session. Every visitor gets one, silently, on their first page load: a random
 * id signed with HMAC-SHA256 under SESSION_SECRET, in an HttpOnly, SameSite=Strict cookie. Routes
 * that change shared demo state require it (with a same-origin check), so a script or another
 * site can't drive the demos without first loading the site like a browser does. Not an identity:
 * it carries no personal data.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ql_s";
export const SESSION_MAX_AGE = 86_400;

const g = globalThis as unknown as { __qlSessionKey?: string };
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  // No secret configured: a random one per process (sessions reset on restart). Fine for a demo
  // and for development; production should set SESSION_SECRET so instances agree.
  return (g.__qlSessionKey ??= randomBytes(32).toString("base64url"));
}

const sign = (id: string) =>
  createHmac("sha256", secret()).update(`ql-session-v1.${id}`).digest("base64url");

export function newSession(): string {
  const id = randomBytes(16).toString("base64url");
  return `${id}.${sign(id)}`;
}

export function validSession(value: string | undefined): boolean {
  if (!value || value.length > 128) return false;
  const [id, mac] = value.split(".");
  if (!id || !mac) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie(value: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}${secure ? "; Secure" : ""}`;
}

/** Scripted clients (CI, the audit scripts) can use `Authorization: Bearer $API_TOKEN` instead. */
export function validApiToken(header: string | null): boolean {
  const t = process.env.API_TOKEN;
  if (!t || t.length < 24 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}
