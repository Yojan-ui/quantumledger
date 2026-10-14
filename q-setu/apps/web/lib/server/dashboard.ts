import "server-only";
/**
 * The Shield dashboard's server side: accounts (password + mandatory TOTP), sites (DNS verification,
 * site keys, mode, alert settings), the event and stats intake from Shield Edge and the middleware,
 * and alerts by email and webhook.
 *
 * - Passwords: scrypt (N = 2^15, r = 8, p = 1), compared in constant time.
 * - TOTP secrets: sealed with AES-256-GCM under a key derived from DASHBOARD_SECRET (or SESSION_SECRET).
 * - Site keys: random 32 bytes, shown once; only their SHA-256 is stored.
 * - Sessions: an HMAC-signed cookie, 12 hours. It carries a stage: "enroll" (password ok, no 2FA yet),
 *   "otp" (password ok, code needed) or "full". Only "full" can see or change sites.
 * - Isolation: every site read and write goes through `sites.owned(accountId, id)`.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import type { SiteRow } from "@/lib/db/repo";
import { alert as securityAlert } from "./alert";
import { live } from "./runtime";
import { verifyTotp } from "./totp";

export const APP_COOKIE = "ql_app";
const SESSION_MS = 12 * 3_600_000;
const PARTIAL_MS = 10 * 60_000;
export type Stage = "enroll" | "otp" | "full";
export type Mode = "off" | "monitor" | "protect" | "strict";
export const MODES: Mode[] = ["off", "monitor", "protect", "strict"];

const g = globalThis as unknown as { __qlDashKey?: Buffer };
function rootKey(): Buffer {
  const s = process.env.DASHBOARD_SECRET ?? process.env.SESSION_SECRET;
  if (s && s.length >= 32)
    return Buffer.from(hkdfSync("sha256", s, Buffer.alloc(0), "qsetu-dashboard-v1", 32));
  // No secret configured: a random key per process (fine for local use; production sets one).
  return (g.__qlDashKey ??= randomBytes(32));
}
const subkey = (label: string) =>
  Buffer.from(hkdfSync("sha256", rootKey(), Buffer.alloc(0), label, 32));

// ── passwords ──────────────────────────────────────────────────────────────────────────────
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32, SCRYPT);
  return `scrypt$15$8$1$${salt.toString("base64")}$${h.toString("base64")}`;
}
export function checkPassword(pw: string, stored: string | undefined): boolean {
  // Unknown accounts still cost one scrypt, so timing doesn't reveal which emails exist.
  const [, , , , salt, hash] = (
    stored ??
    `scrypt$15$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(32).toString("base64")}`
  ).split("$");
  const h = scryptSync(pw, Buffer.from(salt ?? "", "base64"), 32, SCRYPT);
  const want = Buffer.from(hash ?? "", "base64");
  return stored !== undefined && want.length === h.length && timingSafeEqual(h, want);
}

// ── sealed TOTP secrets ────────────────────────────────────────────────────────────────────
function seal(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", subkey("totp"), iv);
  c.setAAD(Buffer.from(aad));
  return Buffer.concat([iv, c.update(plain, "utf8"), c.final(), c.getAuthTag()]).toString("base64");
}
function unseal(sealed: string, aad: string): string | undefined {
  try {
    const b = Buffer.from(sealed, "base64");
    const d = createDecipheriv("aes-256-gcm", subkey("totp"), b.subarray(0, 12));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(b.subarray(b.length - 16));
    return Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}
function newTotpSecret(): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return [...randomBytes(20)].map((b) => A[b & 31]).join("");
}

// ── sessions ───────────────────────────────────────────────────────────────────────────────
const sign = (body: string) =>
  createHmac("sha256", subkey("session")).update(body).digest("base64url");
export function sessionValue(accountId: string, stage: Stage, now = Date.now()): string {
  const body = `${accountId}.${stage}.${now}`;
  return `${body}.${sign(body)}`;
}
export function readSession(
  v: string | undefined,
  now = Date.now(),
): { accountId: string; stage: Stage } | undefined {
  if (!v || v.length > 200) return undefined;
  const parts = v.split(".");
  if (parts.length !== 4) return undefined;
  const [id, stage, iat, mac] = parts as [string, Stage, string, string];
  const want = sign(`${id}.${stage}.${iat}`);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want)))
    return undefined;
  const age = now - Number(iat);
  const max = stage === "full" ? SESSION_MS : PARTIAL_MS;
  if (!(age >= 0 && age <= max) || !["enroll", "otp", "full"].includes(stage)) return undefined;
  return { accountId: id, stage };
}
export function sessionCookie(value: string, secure: boolean, clear = false): string {
  return `${APP_COOKIE}=${clear ? "" : value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_MS / 1000}${secure ? "; Secure" : ""}`;
}
export const isSecure = (req: Request) =>
  new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

export async function currentSession() {
  return readSession((await cookies()).get(APP_COOKIE)?.value);
}
/** The signed-in account, only with a completed second factor. */
export async function fullAccount() {
  const s = await currentSession();
  if (s?.stage !== "full") return undefined;
  const { repos } = await live();
  return repos.accounts.get(s.accountId);
}

// ── accounts ───────────────────────────────────────────────────────────────────────────────
export async function signup(email: string, password: string) {
  const { repos } = await live();
  email = email.trim().toLowerCase();
  if (await repos.accounts.byEmail(email)) return undefined;
  const id = randomUUID();
  await repos.accounts.create({
    id,
    email,
    pwHash: hashPassword(password),
    totpSealed: "",
    totpOn: 0,
    createdAt: new Date().toISOString(),
  });
  return id;
}
export async function login(
  email: string,
  password: string,
): Promise<{ accountId: string; stage: Stage } | undefined> {
  const { repos } = await live();
  const a = await repos.accounts.byEmail(email.trim().toLowerCase());
  if (!checkPassword(password, a?.pwHash) || !a) return undefined;
  return { accountId: a.id, stage: a.totpOn ? "otp" : "enroll" };
}
export async function startEnrollment(accountId: string) {
  const { repos } = await live();
  const a = await repos.accounts.get(accountId);
  if (!a || a.totpOn) return undefined;
  const secret = newTotpSecret();
  await repos.accounts.setTotp(accountId, seal(secret, accountId), false);
  return {
    secret,
    url: `otpauth://totp/QuantumLedger:${encodeURIComponent(a.email)}?secret=${secret}&issuer=QuantumLedger&digits=6&period=30`,
  };
}
export async function confirmTotp(
  accountId: string,
  code: string,
  enrolling: boolean,
): Promise<boolean> {
  const { repos } = await live();
  const a = await repos.accounts.get(accountId);
  if (!a || !a.totpSealed || (enrolling ? a.totpOn : !a.totpOn)) return false;
  const secret = unseal(a.totpSealed, accountId);
  if (!secret || !verifyTotp(secret, code)) return false;
  if (enrolling) await repos.accounts.setTotp(accountId, a.totpSealed, true);
  return true;
}

// ── sites ──────────────────────────────────────────────────────────────────────────────────
export interface SiteSettings {
  alertEmail?: string;
  alertWebhook?: string;
}
export const keyHash = (key: string) => createHash("sha256").update(key).digest("hex");
export const settingsOf = (s: SiteRow): SiteSettings =>
  JSON.parse(s.settings || "{}") as SiteSettings;

export async function createSite(accountId: string, domain: string) {
  const { repos } = await live();
  const key = `qsk_live_${randomBytes(32).toString("base64url")}`;
  const row: SiteRow = {
    id: randomUUID(),
    accountId,
    domain: domain.toLowerCase(),
    verifyToken: randomBytes(18).toString("base64url"),
    keyHash: keyHash(key),
    mode: "monitor", // every new site starts in monitor
    settings: "{}",
    verifiedAt: null,
    createdAt: new Date().toISOString(),
  };
  await repos.sites.create(row);
  return { site: row, key };
}
export async function rotateSiteKey(accountId: string, siteId: string) {
  const { repos } = await live();
  if (!(await repos.sites.owned(accountId, siteId))) return undefined;
  const key = `qsk_live_${randomBytes(32).toString("base64url")}`;
  await repos.sites.update(accountId, siteId, { keyHash: keyHash(key) });
  return key;
}
export async function siteForKey(bearer: string | null) {
  if (!bearer?.startsWith("Bearer qsk_")) return undefined;
  const { repos } = await live();
  return repos.sites.byKeyHash(keyHash(bearer.slice(7)));
}

// ── intake and alerts ──────────────────────────────────────────────────────────────────────
const ALERT_TYPES = new Set(["honeypot", "trap", "canary", "block", "bot_impersonation"]);
const lastAlert = new Map<string, number>();

/** One alert per site per type per 10 minutes, to email and webhook as configured. */
export async function siteAlert(
  site: SiteRow,
  type: string,
  count: number,
  sample: Record<string, unknown>,
) {
  const k = `${site.id}:${type}`;
  if (Date.now() - (lastAlert.get(k) ?? 0) < 10 * 60_000) return;
  lastAlert.set(k, Date.now());
  const s = settingsOf(site);
  const text = `QuantumLedger Shield on ${site.domain}: ${count} ${type} event(s). Mode: ${site.mode}. Latest: ${JSON.stringify(sample).slice(0, 300)}`;
  const jobs: Promise<unknown>[] = [];
  if (s.alertWebhook && /^https:\/\//.test(s.alertWebhook))
    jobs.push(
      fetch(s.alertWebhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, site: site.domain, type, count, sample }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => {}),
    );
  const key = process.env.RESEND_API_KEY;
  if (s.alertEmail && key)
    jobs.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "QuantumLedger <alerts@quantumledger.example>",
          to: s.alertEmail,
          subject: `Shield alert: ${type} on ${site.domain}`,
          text,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {}),
    );
  if (type === "canary") void securityAlert("shield_canary", { site: site.domain });
  await Promise.all(jobs);
}

export interface IntakeEvent {
  type: string;
  at: number;
  ip: string;
  path: string;
  score: number;
  reasons: string[];
  monitorOnly: boolean;
}
export interface IntakeStats {
  pq?: number;
  classical?: number;
  requests?: number;
}

export async function ingest(site: SiteRow, events: IntakeEvent[], stats?: IntakeStats) {
  const { repos } = await live();
  const salt = subkey("ip");
  const rows = events.slice(0, 500).map((e) => ({
    siteId: site.id,
    at: Number.isFinite(e.at) ? e.at : Date.now(),
    type: String(e.type).slice(0, 32),
    score: Math.max(0, Math.min(100, Math.round(e.score))),
    detail: JSON.stringify({
      // Never store the raw IP: a keyed hash, enough to group without identifying.
      ip: createHmac("sha256", salt).update(String(e.ip)).digest("hex").slice(0, 16),
      path: String(e.path).slice(0, 200),
      reasons: (e.reasons ?? []).slice(0, 8).map((r) => String(r).slice(0, 80)),
      monitorOnly: !!e.monitorOnly,
    }),
  }));
  await repos.shieldEvents.insert(rows);
  const day = new Date().toISOString().slice(0, 10);
  const challenged = rows.filter((r) => r.type === "challenge").length;
  const blocked = rows.filter((r) => r.type === "block" || ALERT_TYPES.has(r.type)).length;
  await repos.shieldStats.add(site.id, day, {
    pq: Math.max(0, Math.round(stats?.pq ?? 0)),
    classical: Math.max(0, Math.round(stats?.classical ?? 0)),
    requests: Math.max(0, Math.round(stats?.requests ?? 0)),
    challenged,
    blocked,
  });
  const byType = new Map<string, typeof rows>();
  for (const r of rows)
    if (ALERT_TYPES.has(r.type)) byType.set(r.type, [...(byType.get(r.type) ?? []), r]);
  for (const [type, list] of byType)
    void siteAlert(site, type, list.length, JSON.parse(list[list.length - 1]!.detail));
}
