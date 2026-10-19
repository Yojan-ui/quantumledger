#!/usr/bin/env node
/* global document, window -- page.evaluate code */
/**
 * `node scripts/wow-shots.mjs <label>`: screenshots `/`, `/diagnostics` and every `/demo/*` route at
 * 1440×900 and 390×844 into docs/wow/<label>/. Each page: the first screen 4 s after load. The
 * homepage also gets one frame per section (scrolled so the section's top meets the nav), which
 * shows whether consecutive sections share a framing. Uses system Chrome (real GPU), against BASE.
 */
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const label = process.argv[2] ?? "before";
const BASE = process.env.BASE ?? "http://localhost:3000";
const out = new URL(`../docs/wow/${label}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const PAGES = [
  "/",
  "/diagnostics",
  "/demo/how-it-works",
  "/demo/deploy",
  "/demo/qday",
  "/demo/ledger",
  "/demo/scanner",
];
const SIZES = {
  1440: { viewport: { width: 1440, height: 900 } },
  390: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
};
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "_"));

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
});
for (const [w, opts] of Object.entries(SIZES)) {
  const ctx = await browser.newContext(opts);
  for (const path of PAGES) {
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}${slug(path)}-${w}.png` });
    if (path === "/") {
      const ids = await page.evaluate(() =>
        [...document.querySelectorAll("main > section, main > div > section")].map((s, i) => {
          s.setAttribute("data-shot-i", String(i));
          return [i, s.id || s.getAttribute("aria-label") || `section-${i}`];
        }),
      );
      for (const [i, name] of ids) {
        await page.evaluate((i) => {
          const s = document.querySelector(`[data-shot-i="${i}"]`);
          if (!s) return;
          const y = s.getBoundingClientRect().top + window.scrollY - 56;
          window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
        }, i);
        await page.waitForTimeout(1800);
        const n = String(i).padStart(2, "0");
        const tag = String(name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 32);
        await page.screenshot({ path: `${out}home-${w}-s${n}-${tag}.png` });
      }
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`wrote ${out}`);
