/** Postgres schema (production: Neon, Supabase or any Postgres via DATABASE_URL). Mirrors schema-sqlite.ts. */
import { bigint, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const ledgerEntries = pgTable("ledger_entries", {
  id: integer("id").primaryKey(),
  at: bigint("at", { mode: "number" }).notNull(),
  kind: text("kind").notNull(),
  subject: text("subject").notNull(),
  payload: text("payload").notNull(),
  prev: text("prev").notNull(),
  hash: text("hash").notNull(),
  sig: text("sig").notNull(),
  keyId: text("key_id").notNull(),
  alg: text("alg").notNull(),
});

export const ledgerTamperBackup = pgTable("ledger_tamper_backup", {
  id: integer("id").primaryKey(),
  payload: text("payload").notNull(),
});

export const signups = pgTable("signups", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  organisation: text("organisation").notNull(),
  sector: text("sector").notNull(),
  useCase: text("use_case").notNull(),
  createdAt: text("created_at").notNull(),
});

export const scans = pgTable("scans", {
  host: text("host").primaryKey(),
  result: text("result").notNull(),
  scannedAt: text("scanned_at").notNull(),
});

export const kmsKeys = pgTable("kms_keys", {
  id: text("id").primaryKey(),
  record: text("record").notNull(),
});

export const DDL_PG = `
CREATE TABLE IF NOT EXISTS ledger_entries (id INTEGER PRIMARY KEY, at BIGINT NOT NULL, kind TEXT NOT NULL,
  subject TEXT NOT NULL, payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL, sig TEXT NOT NULL,
  key_id TEXT NOT NULL, alg TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_tamper_backup (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS signups (id SERIAL PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
  email TEXT NOT NULL, organisation TEXT NOT NULL, sector TEXT NOT NULL, use_case TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scans (host TEXT PRIMARY KEY, result TEXT NOT NULL, scanned_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kms_keys (id TEXT PRIMARY KEY, record TEXT NOT NULL);
`;
