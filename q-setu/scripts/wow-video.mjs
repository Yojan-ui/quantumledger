#!/usr/bin/env node
/* global document, window -- page.evaluate code */
/**
 * `node scripts/wow-video.mjs <label>` → docs/wow/<label>/:
 *  - attract-1440.webm: the homepage opening from load until the input takes over (~16 s);
 *  - home-scroll-1440.webm: a 45 s scroll from the top of the homepage to the bottom;
 *  - fps.json: the same scroll in a separate, unrecorded run (recording costs frames), frame times
 *    grouped by the homepage section on screen: fps, p95 frame, share of frames over 20 ms (< 50 fps).
 * System Chrome (real GPU), 1440 × 900, against BASE.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import ffmpeg from "ffmpeg-static";
import { chromium } from "@playwright/test";

const label = process.argv[2] ?? "after-1";
const BASE = process.env.BASE ?? "http://localhost:3000";
const out = new URL(`../docs/wow/${label}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const viewport = { width: 1440, height: 900 };

/** Scroll the whole page in `ms`, in small wheel steps (Lenis smooths them like a trackpad). */
async function scrollAll(page, ms) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const steps = Math.round(ms / 50);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, h / steps);
    await page.waitForTimeout(50);
  }
}

const FPS_PROBE = `(() => {
  window.__f = [];
  let last = performance.now();
  const sec = () => {
    const y = innerHeight / 2;
    for (const s of document.querySelectorAll("main > section, main > div")) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom >= y) return s.id || s.getAttribute("aria-label") || "band";
    }
    return "-";
  };
  const tick = (now) => { window.__f.push([sec(), now - last]); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
});
await fetch(`${BASE}/api/reset-all`, { method: "POST" }).catch(() => {});

async function record(name, run) {
  const dir = `${out}.rec-${name}`;
  const ctx = await browser.newContext({ viewport, recordVideo: { dir, size: viewport } });
  const page = await ctx.newPage();
  await run(page);
  const v = page.video();
  await ctx.close();
  // Re-encoded small enough to commit (VP9, 1200 px wide, CRF 42).
  const raw = `${out}${name}.raw.webm`;
  renameSync(await v.path(), raw);
  rmSync(dir, { recursive: true, force: true });
  execFileSync(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    raw,
    "-vf",
    "scale=1200:-2",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    "42",
    "-row-mt",
    "1",
    "-an",
    `${out}${name}.webm`,
  ]);
  rmSync(raw);
}

await record("attract-1440", async (page) => {
  await page.goto(BASE + "/", { waitUntil: "commit" });
  await page.waitForTimeout(16000);
});
await record("home-scroll-1440", async (page) => {
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await scrollAll(page, 45000);
  await page.waitForTimeout(1000);
});

// Unrecorded: the frame rate per section.
const ctx = await browser.newContext({ viewport });
await ctx.addInitScript({ content: FPS_PROBE });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForTimeout(14000); // the opening, measured too (as "top")
await scrollAll(page, 45000);
const frames = await page.evaluate("window.__f");
await ctx.close();
await browser.close();

const by = {};
for (const [k, dt] of frames) (by[k] ??= []).push(dt);
const sections = Object.fromEntries(
  Object.entries(by)
    .filter(([k, l]) => k !== "-" && l.length > 20)
    .map(([k, l]) => {
      const total = l.reduce((a, b) => a + b, 0);
      const sorted = [...l].sort((a, b) => a - b);
      return [
        k,
        {
          fps: Math.round((l.length / total) * 1000),
          p95FrameMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
          worstMs: +sorted[sorted.length - 1].toFixed(1),
          over20ms: +((l.filter((x) => x > 20).length / l.length) * 100).toFixed(1),
        },
      ];
    }),
);
writeFileSync(`${out}fps.json`, JSON.stringify({ base: BASE, sections }, null, 2) + "\n");
console.log(JSON.stringify(sections, null, 1));
