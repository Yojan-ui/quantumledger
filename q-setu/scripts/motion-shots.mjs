#!/usr/bin/env node
/**
 * `node scripts/motion-shots.mjs <outDir>`: screenshots for the motion pass, at 1440×900, against BASE
 * (default http://localhost:3000, a production server). For each page:
 *   - <page>.png: the first screen, as a visitor sees it;
 *   - with NOCANVAS=1 instead: the WebGL canvas hidden (as `?nocanvas=1` does), CSS animations frozen,
 *     and the page saved screen by screen (<page>-NN.png), for `scripts/motion-diff.mjs` to compare
 *     everything outside the 3D. The canvas is hidden by injected CSS, so the same capture works on a
 *     branch that predates `?nocanvas=1`.
 * PAGES=/,/shield limits the pages.
 */
/* global document, window -- the page.evaluate callbacks run in the browser */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const out = (process.argv[2] ?? "docs/motion2/baseline").replace(/\/?$/, "/");
const BASE = process.env.BASE ?? "http://localhost:3000";
const NOCANVAS = process.env.NOCANVAS === "1";
mkdirSync(out, { recursive: true });

export const MOTION_PAGES = [
  "/",
  "/diagnostics",
  "/shield",
  "/demo/deploy",
  "/demo/how-it-works",
  "/demo/ledger",
  "/demo/qday",
  "/demo/scanner",
  "/platform",
  "/solutions",
  "/solutions/fintech",
  "/demos",
  "/about",
  "/pricing",
  "/security",
  "/docs",
];
const PAGES = process.env.PAGES ? process.env.PAGES.split(",") : MOTION_PAGES;
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/[^a-z0-9]+/gi, "_"));

const HIDE = `canvas { visibility: hidden !important; }
*, *::before, *::after { animation-play-state: paused !important; caret-color: transparent !important; }`;

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: NOCANVAS ? "reduce" : "no-preference",
});
for (const path of PAGES) {
  const page = await ctx.newPage();
  if (NOCANVAS)
    await page.addInitScript((css) => {
      const add = () => {
        const s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
      };
      if (document.head) add();
      else document.addEventListener("DOMContentLoaded", add);
    }, HIDE);
  const res = await page
    .goto(BASE + path, { waitUntil: "load", timeout: 90_000 })
    .catch(() => null);
  if (!res || res.status() >= 400) {
    console.log(`skip ${path} (${res?.status() ?? "no response"})`);
    await page.close();
    continue;
  }
  await page.waitForTimeout(3000);
  if (!NOCANVAS) {
    await page.screenshot({ path: `${out}${slug(path)}.png` });
  } else {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let i = 0, y = 0; y < h; i++, y += 900) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
      await page.waitForTimeout(700);
      const n = String(i + 1).padStart(2, "0");
      await page.screenshot({
        path: `${out}${slug(path)}-${n}.png`,
        animations: "disabled",
        timeout: 90_000,
      });
    }
  }
  console.log(path);
  await page.close();
}
await browser.close();
