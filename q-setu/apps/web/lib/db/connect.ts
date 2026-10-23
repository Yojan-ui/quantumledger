/**
 * Opens the database: Postgres when DATABASE_URL is a postgres:// URL (production), otherwise a
 * SQLite file under QSETU_DATA_DIR (local). Tables are created if missing (see the DDL in the schemas;
 * `drizzle.config.ts` generates equivalent migrations for teams that prefer them).
 */
import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { makeRepos, type Repos } from "./repo";
import * as pg from "./schema-pg";
import * as lite from "./schema-sqlite";

export async function openSqlite(file: string): Promise<Repos> {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(lite.DDL_SQLITE);
  return makeRepos(drizzle(sqlite), lite, "sqlite");
}

export async function openPostgres(url: string): Promise<Repos> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
  await client.unsafe(pg.DDL_PG);
  return makeRepos(drizzle(client), pg, "postgres");
}

/** In-process Postgres (PGlite), used by tests to exercise the production dialect. */
export async function openPglite(): Promise<Repos> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  await client.exec(pg.DDL_PG);
  return makeRepos(drizzle(client), pg, "postgres");
}

export function openFromEnv(dataDir: string): Promise<Repos> {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) return openPostgres(url);
  return openSqlite(url?.startsWith("file:") ? url.slice(5) : `${dataDir}/q-setu.sqlite`);
}
