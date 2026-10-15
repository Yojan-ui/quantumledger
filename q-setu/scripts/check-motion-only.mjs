#!/usr/bin/env node
/**
 * `node scripts/check-motion-only.mjs [base]`: the motion pass changes 3D motion only. Fails if the
 * working tree, against `base` (default shield-real, the look before the art-direction redesign),
 * touches a forbidden path, or any path that isn't on the allowlist below. Untracked files count.
 *
 * Forbidden (never, whatever the allowlist says): the design tokens, global CSS, the Tailwind config,
 * the fonts (the root layout), the UI components, page layouts.
 * Allowed: 3D scenes, the world (globe), the director, the demo films (3D only), motion helpers in
 * lib/, tooling (scripts, docs, tests), and the files in MOUNTING, each with the reason it's needed.
 */
import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "shield-real";
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).split("\n").filter(Boolean);
const top = git("rev-parse", "--show-toplevel")[0];
const here = git("rev-parse", "--show-prefix")[0] ?? ""; // e.g. "q-setu/" from the repository root
// Paths relative to q-setu/.
const strip = (p) => (here && p.startsWith(here) ? p.slice(here.length) : p);

const changed = new Set(
  [
    ...git("-C", top, "diff", base, "--name-only"),
    ...git("-C", top, "ls-files", "--others", "--exclude-standard"),
  ]
    .filter((p) => !here || p.startsWith(here))
    .map(strip),
);

const FORBIDDEN = [
  /^apps\/web\/styles\//,
  /^apps\/web\/app\/globals\.css$/,
  /^apps\/web\/tailwind\.config\.[jt]s$/,
  /^apps\/web\/postcss\.config\./,
  /^apps\/web\/app\/layout\.tsx$/, // the fonts
  /^apps\/web\/components\/ui\//,
  /^apps\/web\/app\/.*\/?(page|layout)\.tsx$/,
  /^apps\/web\/public\/fonts\//,
];

const ALLOWED = [
  /^apps\/web\/components\/scenes\//,
  /^apps\/web\/components\/world\//,
  /^apps\/web\/components\/director\//,
  /^apps\/web\/components\/demo\/[^/]+\/[A-Za-z]+Film\.tsx$/,
  /^apps\/web\/lib\/motion\//,
  /^apps\/web\/lib\/client\/motion\.ts$/,
  /^scripts\//,
  /^docs\//,
  /^tests\//,
  /^\.gitignore$/,
  /^apps\/web\/test\/motion[^/]*\.test\.ts$/,
];

/** Files outside the 3D folders that the pass may touch, and why. Keep this short. */
const MOUNTING = {
  // Part 4's event source ("Shield plugs in": every beat from a real run). Server and package code
  // only, no pages or UI; ported from the parked art-direction branch (5313bab) at the user's choice.
  "apps/web/app/api/shield/plugin/route.ts": "real-run event stream for the Shield scene",
  "apps/web/app/api/shield/plugin/attack/route.ts": "real attack run for the Shield scene",
  "apps/web/lib/server/shield-plugin.ts": "the run behind the Shield scene's events",
  "apps/web/lib/server/api-policy.ts": "rate limits for the two Shield scene routes",
  "apps/web/lib/shield-score.ts": "the readiness score the scene shows",
  "apps/legacy-bank/src/app.ts": "the bundled bank's real headers (the scan's findings)",
  "packages/shield-edge/src/attacks.ts": "attack subset for the scene's Attack beat",
  "packages/shield-edge/src/edge.ts": "the harden option behind the scene's Fix beat",
  "packages/shield-edge/src/index.ts": "exports the harden option",
  "packages/shield-edge/test/harden.test.ts": "tests the harden option",
  "apps/web/test/shield-plugin.test.ts": "tests the Shield scene's event source",
  "apps/web/data/shield-runs.json": "recorded real runs (offline, scroll-driven slot)",
  "apps/web/scripts/record-shield-run.mts": "records shield-runs.json",
  "apps/web/public/scenes/legacy-bank.jpg": "the bank page, sampled into the website's dots",
  "apps/web/next.config.mjs": "transpiles @qsetu/shield for the event source",
  "apps/web/package.json": "@qsetu/shield dependency for the event source",
  "pnpm-lock.yaml": "the @qsetu/shield workspace link",
  // Mounting and the Part 4 state bug.
  "apps/web/components/demo/deploy/DeployDemo.tsx":
    "the dive into the Shield scene, and the counter / caption / console state bug",
  "apps/web/components/home/Sections.tsx": "the Shield scene in the Deploy anywhere 3D slot",
};

const bad = [];
for (const p of [...changed].sort()) {
  if (FORBIDDEN.some((r) => r.test(p))) bad.push(`${p}  (forbidden: not 3D motion)`);
  else if (!ALLOWED.some((r) => r.test(p)) && !(p in MOUNTING))
    bad.push(
      `${p}  (not on the allowlist; add it to MOUNTING with a reason if it's mounting code)`,
    );
}

if (bad.length) {
  console.error(`✗ check-motion-only: ${bad.length} path(s) outside 3D motion, against ${base}:`);
  for (const b of bad) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`✓ check-motion-only: ${changed.size} changed path(s) against ${base}, all 3D motion.`);
for (const [p, why] of Object.entries(MOUNTING))
  if (changed.has(p)) console.log(`  mounting: ${p} (${why})`);
