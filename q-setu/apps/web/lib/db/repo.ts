/**
 * Repositories over Drizzle. The same code runs on SQLite (better-sqlite3) and Postgres (postgres.js,
 * or PGlite in tests): the two schemas have identical table and column names, and Drizzle's query
 * builder is the same for both. Everything that leaves this module is strongly typed.
 */
import { asc, between, count, desc, eq } from "drizzle-orm";
import * as pg from "./schema-pg";
import * as lite from "./schema-sqlite";

export interface LedgerRow {
  id: number;
  at: number;
  kind: string;
  subject: string;
  payload: string;
  prev: string;
  hash: string;
  sig: string;
  keyId: string;
  alg: string;
}

export interface SignupRow {
  kind: "early-access" | "contact";
  name: string;
  email: string;
  organisation: string;
  sector: string;
  useCase: string;
  createdAt: string;
}

export interface Repos {
  dialect: "sqlite" | "postgres";
  ledger: {
    last(): Promise<{ id: number; hash: string } | undefined>;
    insert(row: LedgerRow): Promise<void>;
    count(): Promise<number>;
    recent(limit: number): Promise<LedgerRow[]>;
    range(from: number, to: number): Promise<LedgerRow[]>;
    /** Pages through every row in id order. */
    page(afterId: number, limit: number): Promise<LedgerRow[]>;
    get(id: number): Promise<LedgerRow | undefined>;
    setPayload(id: number, payload: string): Promise<void>;
    backup(id: number, payload: string): Promise<void>;
    backups(): Promise<{ id: number; payload: string }[]>;
    clearBackups(): Promise<void>;
    /** Test hooks: raw edits an attacker with database access could make. */
    raw: {
      setHash(id: number, hash: string): Promise<void>;
      delete(id: number): Promise<void>;
    };
  };
  signups: {
    insert(row: SignupRow): Promise<void>;
    list(): Promise<(SignupRow & { id: number })[]>;
  };
  scans: {
    upsert(host: string, result: string, scannedAt: string): Promise<void>;
    get(host: string): Promise<{ result: string; scannedAt: string } | undefined>;
  };
  kms: {
    all(): Promise<{ id: string; record: string }[]>;
    upsert(id: string, record: string): Promise<void>;
  };
}

type Tables = typeof pg | typeof lite;
/** Drizzle's SQLite and Postgres databases share this query-builder surface. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzle = any;

export function makeRepos(db: AnyDrizzle, t: Tables, dialect: Repos["dialect"]): Repos {
  const L = t.ledgerEntries;
  const B = t.ledgerTamperBackup;
  const rows = async (q: Promise<LedgerRow[]>) =>
    (await q).map((r) => ({ ...r, at: Number(r.at) }));
  return {
    dialect,
    ledger: {
      last: async () =>
        (await db.select({ id: L.id, hash: L.hash }).from(L).orderBy(desc(L.id)).limit(1))[0],
      insert: async (row) => void (await db.insert(L).values(row)),
      count: async () => Number((await db.select({ n: count() }).from(L))[0]?.n ?? 0),
      recent: (limit) => rows(db.select().from(L).orderBy(desc(L.id)).limit(limit)),
      range: (a, b) =>
        rows(
          db
            .select()
            .from(L)
            .where(between(L.id, a, b))
            .orderBy(asc(L.id)),
        ),
      page: (afterId, limit) =>
        rows(
          db
            .select()
            .from(L)
            .where(between(L.id, afterId + 1, 2 ** 31 - 1))
            .orderBy(asc(L.id))
            .limit(limit),
        ),
      get: async (id) => (await rows(db.select().from(L).where(eq(L.id, id))))[0],
      setPayload: async (id, payload) =>
        void (await db.update(L).set({ payload }).where(eq(L.id, id))),
      backup: async (id, payload) =>
        void (await db.insert(B).values({ id, payload }).onConflictDoNothing()),
      backups: async () => db.select().from(B),
      clearBackups: async () => void (await db.delete(B)),
      raw: {
        setHash: async (id, hash) => void (await db.update(L).set({ hash }).where(eq(L.id, id))),
        delete: async (id) => void (await db.delete(L).where(eq(L.id, id))),
      },
    },
    signups: {
      insert: async (row) => void (await db.insert(t.signups).values(row)),
      list: async () => db.select().from(t.signups).orderBy(desc(t.signups.id)),
    },
    scans: {
      upsert: async (host, result, scannedAt) =>
        void (await db
          .insert(t.scans)
          .values({ host, result, scannedAt })
          .onConflictDoUpdate({ target: t.scans.host, set: { result, scannedAt } })),
      get: async (host) =>
        (
          await db
            .select({ result: t.scans.result, scannedAt: t.scans.scannedAt })
            .from(t.scans)
            .where(eq(t.scans.host, host))
        )[0],
    },
    kms: {
      all: async () => db.select().from(t.kmsKeys),
      upsert: async (id, record) =>
        void (await db
          .insert(t.kmsKeys)
          .values({ id, record })
          .onConflictDoUpdate({ target: t.kmsKeys.id, set: { record } })),
    },
  };
}
