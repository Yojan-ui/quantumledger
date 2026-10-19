/**
 * Repositories over Drizzle. The same code runs on SQLite (better-sqlite3) and Postgres (postgres.js,
 * or PGlite in tests): the two schemas have identical table and column names, and Drizzle's query
 * builder is the same for both. Everything that leaves this module is strongly typed.
 */
import { and, asc, between, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
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
      setSig(id: number, sig: string): Promise<void>;
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
  accounts: {
    create(row: AccountRow): Promise<void>;
    byEmail(email: string): Promise<AccountRow | undefined>;
    get(id: string): Promise<AccountRow | undefined>;
    setTotp(id: string, totpSealed: string, on: boolean): Promise<void>;
  };
  sites: {
    create(row: SiteRow): Promise<void>;
    forAccount(accountId: string): Promise<SiteRow[]>;
    /** A site, only if it belongs to this account (every dashboard read goes through this). */
    owned(accountId: string, id: string): Promise<SiteRow | undefined>;
    byKeyHash(keyHash: string): Promise<SiteRow | undefined>;
    /** The verified site for a domain, if any account has verified it. */
    verifiedFor(domain: string): Promise<SiteRow | undefined>;
    update(
      accountId: string,
      id: string,
      set: Partial<Pick<SiteRow, "mode" | "settings" | "verifiedAt" | "keyHash">>,
    ): Promise<void>;
  };
  shieldEvents: {
    insert(rows: ShieldEventRow[]): Promise<void>;
    recent(siteId: string, limit: number): Promise<(ShieldEventRow & { id: number })[]>;
    since(siteId: string, at: number): Promise<(ShieldEventRow & { id: number })[]>;
  };
  shieldStats: {
    add(siteId: string, day: string, d: Omit<ShieldStatsRow, "siteId" | "day">): Promise<void>;
    range(siteId: string, fromDay: string, toDay: string): Promise<ShieldStatsRow[]>;
  };
}

export interface AccountRow {
  id: string;
  email: string;
  pwHash: string;
  totpSealed: string;
  totpOn: number;
  createdAt: string;
}
export interface SiteRow {
  id: string;
  accountId: string;
  domain: string;
  verifyToken: string;
  keyHash: string;
  mode: string;
  settings: string;
  verifiedAt: string | null;
  createdAt: string;
}
export interface ShieldEventRow {
  siteId: string;
  at: number;
  type: string;
  score: number;
  detail: string;
}
export interface ShieldStatsRow {
  siteId: string;
  day: string;
  pq: number;
  classical: number;
  requests: number;
  challenged: number;
  blocked: number;
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
        setSig: async (id, sig) => void (await db.update(L).set({ sig }).where(eq(L.id, id))),
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
    accounts: {
      create: async (row) => void (await db.insert(t.accounts).values(row)),
      byEmail: async (email) =>
        (await db.select().from(t.accounts).where(eq(t.accounts.email, email)))[0],
      get: async (id) => (await db.select().from(t.accounts).where(eq(t.accounts.id, id)))[0],
      setTotp: async (id, totpSealed, on) =>
        void (await db
          .update(t.accounts)
          .set({ totpSealed, totpOn: on ? 1 : 0 })
          .where(eq(t.accounts.id, id))),
    },
    sites: {
      create: async (row) => void (await db.insert(t.sites).values(row)),
      forAccount: async (accountId) =>
        db
          .select()
          .from(t.sites)
          .where(eq(t.sites.accountId, accountId))
          .orderBy(asc(t.sites.createdAt)),
      owned: async (accountId, id) =>
        (
          await db
            .select()
            .from(t.sites)
            .where(and(eq(t.sites.accountId, accountId), eq(t.sites.id, id)))
        )[0],
      byKeyHash: async (keyHash) =>
        (await db.select().from(t.sites).where(eq(t.sites.keyHash, keyHash)))[0],
      verifiedFor: async (domain) =>
        (
          await db
            .select()
            .from(t.sites)
            .where(and(eq(t.sites.domain, domain), isNotNull(t.sites.verifiedAt)))
        )[0],
      update: async (accountId, id, set) =>
        void (await db
          .update(t.sites)
          .set(set)
          .where(and(eq(t.sites.accountId, accountId), eq(t.sites.id, id)))),
    },
    shieldEvents: {
      insert: async (r) => void (r.length && (await db.insert(t.shieldEvents).values(r))),
      recent: async (siteId, limit) =>
        (
          await db
            .select()
            .from(t.shieldEvents)
            .where(eq(t.shieldEvents.siteId, siteId))
            .orderBy(desc(t.shieldEvents.id))
            .limit(limit)
        ).map((r: ShieldEventRow & { id: number }) => ({ ...r, at: Number(r.at) })),
      since: async (siteId, at) =>
        (
          await db
            .select()
            .from(t.shieldEvents)
            .where(and(eq(t.shieldEvents.siteId, siteId), gte(t.shieldEvents.at, at)))
            .orderBy(asc(t.shieldEvents.id))
            .limit(50_000)
        ).map((r: ShieldEventRow & { id: number }) => ({ ...r, at: Number(r.at) })),
    },
    shieldStats: {
      add: async (siteId, day, d) => {
        const S = t.shieldStats;
        await db
          .insert(S)
          .values({ siteId, day, ...d })
          .onConflictDoUpdate({
            target: [S.siteId, S.day],
            set: {
              pq: sql`${S.pq} + ${d.pq}`,
              classical: sql`${S.classical} + ${d.classical}`,
              requests: sql`${S.requests} + ${d.requests}`,
              challenged: sql`${S.challenged} + ${d.challenged}`,
              blocked: sql`${S.blocked} + ${d.blocked}`,
            },
          });
      },
      range: async (siteId, fromDay, toDay) =>
        db
          .select()
          .from(t.shieldStats)
          .where(and(eq(t.shieldStats.siteId, siteId), between(t.shieldStats.day, fromDay, toDay)))
          .orderBy(asc(t.shieldStats.day)),
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
