/** SQLite schema (local development and single-node deployments). Mirrors schema-pg.ts. */
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ledgerEntries = sqliteTable("ledger_entries", {
  id: integer("id").primaryKey(),
  at: integer("at").notNull(),
  kind: text("kind").notNull(),
  subject: text("subject").notNull(),
  payload: text("payload").notNull(),
  prev: text("prev").notNull(),
  hash: text("hash").notNull(),
  sig: text("sig").notNull(),
  keyId: text("key_id").notNull(),
  alg: text("alg").notNull(),
});

export const ledgerTamperBackup = sqliteTable("ledger_tamper_backup", {
  id: integer("id").primaryKey(),
  payload: text("payload").notNull(),
});

export const signups = sqliteTable("signups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  organisation: text("organisation").notNull(),
  sector: text("sector").notNull(),
  useCase: text("use_case").notNull(),
  createdAt: text("created_at").notNull(),
});

export const scans = sqliteTable("scans", {
  host: text("host").primaryKey(),
  result: text("result").notNull(),
  scannedAt: text("scanned_at").notNull(),
});

export const kmsKeys = sqliteTable("kms_keys", {
  id: text("id").primaryKey(),
  record: text("record").notNull(),
});

// ── Shield dashboard ─────────────────────────────────────────────────────────────────────────
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  pwHash: text("pw_hash").notNull(),
  /** The TOTP secret, sealed (AES-256-GCM) under the dashboard key; empty until enrolled. */
  totpSealed: text("totp_sealed").notNull(),
  totpOn: integer("totp_on").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  domain: text("domain").notNull(),
  verifyToken: text("verify_token").notNull(),
  /** SHA-256 of the site key (the key itself is shown once and never stored). */
  keyHash: text("key_hash").notNull().unique(),
  mode: text("mode").notNull(),
  settings: text("settings").notNull(),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull(),
});

export const shieldEvents = sqliteTable("shield_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: text("site_id").notNull(),
  at: integer("at").notNull(),
  type: text("type").notNull(),
  score: integer("score").notNull(),
  detail: text("detail").notNull(),
});

export const shieldStats = sqliteTable(
  "shield_stats",
  {
    siteId: text("site_id").notNull(),
    day: text("day").notNull(),
    pq: integer("pq").notNull(),
    classical: integer("classical").notNull(),
    requests: integer("requests").notNull(),
    challenged: integer("challenged").notNull(),
    blocked: integer("blocked").notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day] })],
);

export const DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS ledger_entries (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL,
  subject TEXT NOT NULL, payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL, sig TEXT NOT NULL,
  key_id TEXT NOT NULL, alg TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_tamper_backup (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS signups (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL,
  email TEXT NOT NULL, organisation TEXT NOT NULL, sector TEXT NOT NULL, use_case TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scans (host TEXT PRIMARY KEY, result TEXT NOT NULL, scanned_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kms_keys (id TEXT PRIMARY KEY, record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, pw_hash TEXT NOT NULL,
  totp_sealed TEXT NOT NULL, totp_on INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, domain TEXT NOT NULL,
  verify_token TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, mode TEXT NOT NULL, settings TEXT NOT NULL,
  verified_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sites_account ON sites (account_id);
CREATE TABLE IF NOT EXISTS shield_events (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL, at INTEGER NOT NULL,
  type TEXT NOT NULL, score INTEGER NOT NULL, detail TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS shield_events_site ON shield_events (site_id, at);
CREATE TABLE IF NOT EXISTS shield_stats (site_id TEXT NOT NULL, day TEXT NOT NULL, pq INTEGER NOT NULL,
  classical INTEGER NOT NULL, requests INTEGER NOT NULL, challenged INTEGER NOT NULL, blocked INTEGER NOT NULL,
  PRIMARY KEY (site_id, day));
`;
