#!/usr/bin/env node
/* global document, window -- page.evaluate code */
/**
 * `node scripts/real-shots.mjs <label>` → docs/real/<label>/:
 *  - <page>-1440.png and <page>-390.png for every page in the sitemap plus /diagnostics, /join,
 *    /pitch and a scan page (the first screen, 3 s after load);
 *  - overflow.json / overflow.md: at 360, 390, 768 and 1440 px, whether the page is wider than the
 *    device (scrollWidth, or a widened layout viewport, > the device width) and, if so, the widest element sticking out (tag, classes,
 *    right edge), so each overflow points at its cause.
 * Against BASE (default http://localhost:3000), system Chrome.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const label = process.argv[2] ?? "before";
const BASE = process.env.BASE ?? "http://localhost:3000";
const out = new URL(`../docs/real/${label}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const pages = [
  ...new Set([
    ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => new URL(x[1]).pathname),
    "/diagnostics",
    "/join",
    "/pitch",
    "/scan/www.irctc.co.in",
  ]),
].filter((p) => !process.env.ONLY || process.env.ONLY.split(",").includes(p));
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/[^a-z0-9]+/gi, "_"));

const WIDTHS = [360, 390, 768, 1440];
const ctxFor = (w) =>
  w < 768
    ? { ...devices["iPhone 13"], viewport: { width: w, height: 844 } }
    : { viewport: { width: w, height: 900 } };

// Measured against the device width \`w\`, not innerWidth: when content is too wide a mobile
// browser widens the layout viewport to fit it (a 390 px phone reports innerWidth 434), which would
// hide exactly the overflow being looked for.
const OVERFLOW = (w) => `(() => {
  const vw = ${w}, sw = Math.max(document.documentElement.scrollWidth, window.innerWidth);
  let worst = null;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    // Skip things clipped by an overflow-hidden/clip ancestor: they don't cause page overflow.
    let clipped = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o === "hidden" || o === "clip" || o === "auto" || o === "scroll") { clipped = true; break; }
    }
    if (clipped || getComputedStyle(el).position === "fixed") continue;
    if (!worst || r.right > worst.right)
      worst = { right: Math.round(r.right), tag: el.tagName.toLowerCase(), cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 90), text: (el.textContent || "").trim().slice(0, 40) };
  }
  return { vw, sw, overflow: sw - vw, worst };
})()`;

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
});
const results = {};
for (const w of WIDTHS) {
  const ctx = await browser.newContext(ctxFor(w));
  for (const path of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
    await page.goto(BASE + path, { waitUntil: "load" }).catch(() => {});
    await page.waitForTimeout(3000);
    if (w === 1440 || w === 390) await page.screenshot({ path: `${out}${slug(path)}-${w}.png` });
    const o = await page.evaluate(OVERFLOW(w)).catch(() => ({ vw: w, sw: w, overflow: 0, worst: null }));
    (results[path] ??= {})[w] = { ...o, errors };
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}overflow.json`, JSON.stringify(results, null, 2) + "\n");
const rows = Object.entries(results).map(
  ([p, r]) =>
    `| \`${p}\` | ${WIDTHS.map((w) => (r[w].overflow > 0 ? `**+${r[w].overflow}**` : "0")).join(" | ")} | ${
      WIDTHS.map((w) => r[w].worst && r[w].overflow > 0 ? `${w}: \`${r[w].worst.tag}.${r[w].worst.cls.split(" ").slice(0, 4).join(".")}\` → ${r[w].worst.right}px` : "")
        .filter(Boolean)
        .join("<br>") || "–"
    } |`,
);
writeFileSync(
  `${out}overflow.md`,
  `# Horizontal overflow (${label})\n\n\`node scripts/real-shots.mjs ${label}\` against ${BASE}. Overflow = document scrollWidth − innerWidth, in px (0 = no sideways scroll).\n\n| Page | 360 | 390 | 768 | 1440 | Widest element sticking out |\n| --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`,
);
const bad = Object.values(results).flatMap((r) => WIDTHS.filter((w) => r[w].overflow > 0));
console.log(`${pages.length} pages; ${bad.length} page×width combinations overflow; wrote ${out}`);
