import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Sign-in for /lab only: an email magic link, then a signed session cookie. No passwords, no
 * third-party provider.
 *
 * Tokens are "<base64url JSON>.<HMAC-SHA256>" under LAB_AUTH_SECRET. A link is valid for 15 minutes
 * and once; a session for 8 hours (checked from the signed expiry, not only the cookie's Max-Age).
 * Without LAB_AUTH_SECRET a development server uses a random secret per process (everyone signs in
 * again after a restart) and a production server keeps the Lab switched off.
 */
export const LAB_COOKIE = "ql_lab";
const LINK_MS = 15 * 60_000;
export const LAB_SESSION_MS = 8 * 3600_000;

export type LabRole = "team" | "customer";
export interface LabUser {
  email: string;
  role: LabRole;
  /** For customers: the one customer whose data they may see. */
  customerId?: string;
}

// Process-wide, not per module: Next bundles each route separately, and a link minted by one route
// must open in another.
const g = globalThis as { __qlLab?: { devSecret: string; used: Map<string, number> } };
const shared = (g.__qlLab ??= { devSecret: randomBytes(32).toString("hex"), used: new Map() });
const devSecret = shared.devSecret;
function secret(): string | undefined {
  const s = process.env.LAB_AUTH_SECRET;
  if (s && s.length >= 32) return s;
  // Demo mode is an explicit opt-in, so it may run on a per-process secret even in production.
  return process.env.NODE_ENV === "production" && !demoMode() ? undefined : devSecret;
}
export const labEnabled = () => secret() !== undefined;

/**
 * Demo accounts: sign in by typing the address, no email sent. For demos run offline, where no mail
 * service is set up. From LAB_DEMO_ACCOUNTS, comma-separated `email=team` or `email=customer:<id>`:
 *
 *   LAB_DEMO_ACCOUNTS=team@quantumledger.dev=team,ciso@ledgerwood.example=customer:ledgerwood
 *
 * Unset in development: the three accounts below (the engine's demo customers). Set it empty to
 * switch demo mode off. Production has no default: demo mode there only when the variable is set.
 * A demo account gets exactly the role checks a magic-link session gets.
 */
const DEV_DEMO =
  "team@quantumledger.dev=team,ciso@ledgerwood.example=customer:ledgerwood,it@sahyadri.example=customer:sahyadri";

export type DemoAccount = { email: string; role: LabRole; customerId?: string };

export function demoAccounts(): DemoAccount[] {
  const raw =
    process.env.LAB_DEMO_ACCOUNTS ?? (process.env.NODE_ENV === "production" ? "" : DEV_DEMO);
  const out: DemoAccount[] = [];
  for (const item of raw.split(",")) {
    const [e, r] = item.split("=").map((x) => x.trim());
    const email = normaliseEmail(e);
    if (!email || !r) continue;
    if (r === "team") out.push({ email, role: "team" });
    else if (/^customer:[a-z0-9-]{1,40}$/.test(r))
      out.push({ email, role: "customer", customerId: r.slice("customer:".length) });
  }
  return out;
}
export const demoMode = () => demoAccounts().length > 0;

/** Team admins: LAB_TEAM_EMAILS (comma-separated). In development, team@quantumledger.dev too. */
export function teamEmails(): string[] {
  const list = (process.env.LAB_TEAM_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (process.env.NODE_ENV !== "production" && !list.length) list.push("team@quantumledger.dev");
  return list;
}

export const normaliseEmail = (e: unknown) =>
  typeof e === "string" && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e.trim())
    ? e.trim().toLowerCase()
    : undefined;

function mac(key: string, body: string) {
  return createHmac("sha256", key).update(`qsetu-lab-v1.${body}`).digest("base64url");
}

function seal(payload: object): string | undefined {
  const key = secret();
  if (!key) return undefined;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(key, body)}`;
}

function open<T extends { k: string; exp: number }>(token: string | undefined, kind: string) {
  const key = secret();
  if (!key || !token) return undefined;
  const [body, sig] = token.split(".");
  if (!body || !sig) return undefined;
  const want = Buffer.from(mac(key, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return undefined;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    return p.k === kind && p.exp > Date.now() ? p : undefined;
  } catch {
    return undefined;
  }
}

/** Links already used (until they would have expired anyway). Per server process. */
const used = shared.used;

export function linkToken(email: string): string | undefined {
  return seal({
    k: "link",
    e: email,
    n: randomBytes(12).toString("base64url"),
    exp: Date.now() + LINK_MS,
  });
}

/** The email a link was issued to, once. */
export function consumeLink(token: string | undefined): string | undefined {
  const p = open<{ k: string; exp: number; e: string; n: string }>(token, "link");
  if (!p || used.has(p.n)) return undefined;
  const now = Date.now();
  for (const [n, exp] of used) if (exp < now) used.delete(n);
  used.set(p.n, p.exp);
  return p.e;
}

export function sessionToken(u: LabUser): string | undefined {
  return seal({ k: "sess", ...u, exp: Date.now() + LAB_SESSION_MS });
}

export function readSession(token: string | undefined): LabUser | undefined {
  const p = open<{ k: string; exp: number } & LabUser>(token, "sess");
  if (!p || (p.role !== "team" && p.role !== "customer")) return undefined;
  if (p.role === "customer" && !p.customerId) return undefined;
  return { email: p.email, role: p.role, ...(p.customerId ? { customerId: p.customerId } : {}) };
}

/** The session from a request's Cookie header. */
export function sessionFromCookieHeader(header: string | null): LabUser | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === LAB_COOKIE)
      return readSession(decodeURIComponent(part.slice(i + 1).trim()));
  }
  return undefined;
}

export function sessionCookie(value: string, secure: boolean): string {
  return `${LAB_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LAB_SESSION_MS / 1000}${secure ? "; Secure" : ""}`;
}
export const clearCookie = () => `${LAB_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
