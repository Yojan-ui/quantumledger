#!/usr/bin/env node
/**
 * `node scripts/record-demos.mjs <outDir>`: records each demo, played the way a presenter would
 * (the film's Play, then the demo's key action), as <outDir>/<demo>.webm at 1440×900.
 */
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? new URL("../docs/demos/after/", import.meta.url).pathname;
const BASE = process.env.BASE ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Clicks the first visible button whose accessible name matches, if there is one. */
async function press(page, name) {
  const b = page.getByRole("button", { name }).first();
  if (await b.count()) await b.click().catch(() => {});
}

/** Waits (up to `ms`) until `text` is on the page: each film is recorded until its real work ends. */
const until = (page, text, ms = 120_000) =>
  page
    .getByText(text)
    .first()
    .waitFor({ timeout: ms })
    .catch(() => {});

const DEMOS = [
  [
    "1-how-it-works",
    "/demo/how-it-works",
    async (p) => {
      await wait(3000);
      await press(p, /^Play$/);
      await until(p, /messages over AES-256-GCM/);
      await wait(4000);
      await press(p, /Attack it/);
      await until(p, /verification failed/);
      await wait(5000);
    },
  ],
  [
    "2-deploy",
    "/demo/deploy",
    async (p) => {
      await wait(4000);
      await press(p, /^Play$/);
      await until(p, /5 \/ 5/);
      await wait(5000);
    },
  ],
  [
    "3-qday",
    "/demo/qday",
    async (p) => {
      await wait(5000);
      await press(p, /Go to Q-Day/);
      await until(p, "Exposed · QuantumLedger");
      await wait(9000);
    },
  ],
  [
    "4-ledger",
    "/demo/ledger",
    async (p) => {
      await wait(5000);
      await press(p, /^Play$/);
      await until(p, /The original row is restored/);
      await until(p, "✓ Chain intact");
      await wait(4000);
    },
  ],
];

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
await fetch(`${BASE}/api/reset-all`, {
  method: "POST",
  // The API refuses unauthenticated writes; scripts use the bearer token (API_TOKEN).
  headers: process.env.API_TOKEN ? { authorization: `Bearer ${process.env.API_TOKEN}` } : {},
}).catch(() => {});
// ONLY=3-qday,4-ledger re-records just those.
const only = process.env.ONLY?.split(",");
for (const [name, path, act] of DEMOS.filter(([n]) => !only || only.includes(n))) {
  const tmp = `${out}/.tmp-${name}`;
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: tmp, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.mouse.move(700, 400);
  await act(page);
  const v = page.video();
  await ctx.close();
  renameSync(await v.path(), `${out}/${name}.webm`);
  rmSync(tmp, { recursive: true, force: true });
  console.log("recorded", name);
}
await fetch(`${BASE}/api/reset-all`, {
  method: "POST",
  // The API refuses unauthenticated writes; scripts use the bearer token (API_TOKEN).
  headers: process.env.API_TOKEN ? { authorization: `Bearer ${process.env.API_TOKEN}` } : {},
}).catch(() => {});
await browser.close();
