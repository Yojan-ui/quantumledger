import { defineConfig } from "drizzle-kit";

/** `pnpm --filter @qsetu/web exec drizzle-kit generate` writes SQL migrations for the Postgres schema. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema-pg.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/qsetu" },
});
