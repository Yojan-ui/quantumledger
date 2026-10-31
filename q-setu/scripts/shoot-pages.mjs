#!/usr/bin/env node
/**
 * `node scripts/shoot-pages.mjs <outDir>`: a screenshot of every page in the sitemap (plus a few
 * pages that aren't in it) at 1440×900 and 390×844, as <outDir>/<page>-<width>.png (first screen).
 */
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const out = process.argv[2] ?? new URL("../docs/motion/before/", import.meta.url).pathname;
const BASE = process.env.BASE ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const extra = (
  process.env.EXTRA ?? "/join,/pitch,/scan/www.npci.org.in,/this-page-does-not-exist"
).split(",");
const all = [...new Set([...paths, ...extra])];
const browser = await chromium.launch({ channel: "chrome" });
for (const [w, ctxOpts] of [
  [1440, { viewport: { width: 1440, height: 900 } }],
  [390, { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } }],
]) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  for (const p of all) {
    const name = (p === "/" ? "home" : p.slice(1).replace(/[/.]/g, "_")) + `-${w}.png`;
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${out}/${name}` });
    } catch (e) {
      console.log("✗", p, e.message.split("\n")[0]);
    }
  }
  await ctx.close();
  console.log(`✓ ${all.length} pages at ${w}px`);
}
await browser.close();
