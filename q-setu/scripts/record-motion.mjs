#!/usr/bin/env node
/* global window, document, requestAnimationFrame -- page.evaluate code */
/**
 * `node scripts/record-motion.mjs <outDir>`: records /diagnostics in autoplay (the labelled cached
 * example) at 1440×900 and on a 390×844 phone, screenshots each of the five stages once its result
 * has played (stage-<n>-<width>.png), measures the frame rate per stage in a separate unrecorded run
 * and writes <outDir>/metrics.json. Uses the system Chrome (real GPU), against BASE.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const out = process.argv[2] ?? new URL("../docs/motion/after-1/", import.meta.url).pathname;
const BASE = process.env.BASE ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });

const VIEWPORTS = {
  1440: { viewport: { width: 1440, height: 900 } },
  390: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
};
const STAGES = ["detect", "score", "defend", "prove", "rescan"];

/** Frame intervals tagged with the stage on screen. */
const FPS_PROBE = () => {
  const w = window;
  w.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    const t = document.querySelector("[data-stage-title]")?.getAttribute("data-stage-title") ?? "-";
    w.__frames.push([t, now - last]);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/**
 * Runs autoplay to the end; calls `onShot(i)` for each stage once its effect has played (a fixed
 * delay after its real result arrived, shorter than autoplay's hold, so it's still on screen).
 */
const SHOT_AFTER_MS = [2600, 3000, 2800, 3900, 4300];
async function play(page, onShot) {
  await page.goto(`${BASE}/diagnostics`, { waitUntil: "load" });
  const t0 = Date.now();
  const doneAt = [];
  const shot = new Set();
  while (Date.now() - t0 < 120_000) {
    const st = await page
      .locator("[data-stage]")
      .evaluateAll((l) => l.slice(0, 5).map((x) => x.dataset.status));
    for (let i = 0; i < 5; i++) if (st[i] === "done" && !doneAt[i]) doneAt[i] = Date.now();
    for (let i = 0; i < 5; i++)
      if (doneAt[i] && !shot.has(i) && Date.now() >= doneAt[i] + SHOT_AFTER_MS[i]) {
        shot.add(i);
        await onShot(i);
      }
    if (shot.size === 5 || st.includes("failed")) break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  return (Date.now() - t0) / 1000;
}

function summarise(frames) {
  const by = {};
  for (const [k, dt] of frames) (by[k] ??= []).push(dt);
  return Object.fromEntries(
    Object.entries(by)
      .filter(([k, l]) => k !== "-" && l.length > 10)
      .map(([k, l]) => {
        const total = l.reduce((a, b) => a + b, 0);
        const sorted = [...l].sort((a, b) => a - b);
        return [
          k,
          {
            fps: Math.round((l.length / total) * 1000),
            p95FrameMs: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(1)),
            under50fps: Number(((l.filter((x) => x > 20).length / l.length) * 100).toFixed(1)),
          },
        ];
      }),
  );
}

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
});
const metrics = { measuredAt: new Date().toISOString(), base: BASE, runs: {} };
for (const [w, opts] of Object.entries(VIEWPORTS)) {
  await fetch(`${BASE}/api/reset-all`, { method: "POST" }).catch(() => {});
  // Recorded run, with a screenshot of each stage after its effect has played.
  const dir = `${out}/.rec-${w}`;
  const ctx = await browser.newContext({ ...opts, recordVideo: { dir, size: opts.viewport } });
  const page = await ctx.newPage();
  const seconds = await play(page, (i) =>
    page.screenshot({ path: `${out}/stage-${i + 1}-${STAGES[i]}-${w}.png` }),
  );
  const text = await page.locator("body").innerText();
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), `${out}/diagnostics-${w}.webm`);
  rmSync(dir, { recursive: true, force: true });
  // Measured run (no video: recording costs frames).
  const mctx = await browser.newContext(opts);
  await mctx.addInitScript(FPS_PROBE);
  const mpage = await mctx.newPage();
  await play(mpage, async () => {});
  const frames = await mpage.evaluate(() => window.__frames);
  await mctx.close();
  metrics.runs[w] = {
    seconds,
    fps: summarise(frames),
    oldBrand: (text.match(/Q-?Setu|Q-Ledger/gi) ?? []).length,
  };
  console.log(w, JSON.stringify(metrics.runs[w]));
}
await browser.close();
writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics, null, 2) + "\n");
console.log(`wrote ${out}/metrics.json`);
