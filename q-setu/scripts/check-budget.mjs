#!/usr/bin/env node
/**
 * `pnpm check:budget`: fails if the home page's initial JavaScript (gzipped, every chunk loaded
 * before hydration: layout + page + framework) exceeds the budget. The 3D globe is lazy-loaded
 * after first paint and is deliberately not counted. Run after `pnpm build`.
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const NEXT = new URL("../apps/web/.next/", import.meta.url).pathname;
const BUDGET_KB = Number(process.env.JS_BUDGET_KB ?? 250);
const ROUTES = (process.env.BUDGET_ROUTES ?? "/page").split(",");

const app = JSON.parse(readFileSync(join(NEXT, "app-build-manifest.json"), "utf8")).pages;
const build = JSON.parse(readFileSync(join(NEXT, "build-manifest.json"), "utf8"));
let failed = false;
for (const route of ROUTES) {
  const files = new Set([...build.rootMainFiles, ...(app["/layout"] ?? []), ...(app[route] ?? [])]);
  const kb =
    [...files]
      .filter((f) => f.endsWith(".js"))
      .reduce((n, f) => n + gzipSync(readFileSync(join(NEXT, f))).length, 0) / 1024;
  const ok = kb <= BUDGET_KB;
  failed ||= !ok;
  console.log(
    `${ok ? "✓" : "✗"} ${route}: ${kb.toFixed(1)} KB initial JS (gzip), budget ${BUDGET_KB} KB`,
  );
}
process.exit(failed ? 1 : 0);
