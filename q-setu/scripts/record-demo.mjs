#!/usr/bin/env node
/**
 * `pnpm record:demo`: records the full 3-minute judge flow, driven by Playwright against a running
 * site (default http://localhost:3000), and writes docs/final/demo.mp4. The backup for when the venue's
 * laptop or projector fails. Every frame is the real site doing real crypto.
 *
 *   Hero ticker → scan a bank → Why now → Q-Day → Deploy → Proof Chain tamper → Why QuantumLedger
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, renameSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = new URL("../docs/final/", import.meta.url).pathname;
const TMP = `${OUT}.recording`;
const W = 1440;
const H = 900;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Smooth scroll to an element, like a presenter would. */
async function glide(page, selector, ms = 1800) {
  await page.evaluate(
    ([sel, dur]) =>
      new Promise((done) => {
        const el = document.querySelector(sel);
        if (!el) return done();
        const from = window.scrollY;
        const to = el.getBoundingClientRect().top + window.scrollY - 56;
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - k, 3);
          window.scrollTo(0, from + (to - from) * e);
          if (k < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    [selector, ms],
  );
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: TMP, size: { width: W, height: H } },
});
const page = await ctx.newPage();
const t0 = Date.now();
const mark = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(3)} s  ${s}`);

// Clean slate.
await fetch(`${BASE}/api/reset-all`, { method: "POST" }).catch(() => {});

// 1. Hero: the key generated in this browser, the globe assembling, the live ticker (25 s).
mark("hero");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.mouse.move(900, 450);
await wait(14000);
await page.mouse.move(1050, 500, { steps: 30 });
await wait(9000);

// 2. "Is your bank quantum-safe?" (25 s)
mark("scan");
await glide(page, "#scan");
await wait(1500);
await page.getByLabel("Enter any website").click();
await page.keyboard.type("onlinesbi.sbi", { delay: 90 });
await page.getByRole("button", { name: "Scan", exact: true }).click();
await wait(9000);
await page.getByLabel("Enter any website").fill("");
await page.getByRole("button", { name: "irctc.co.in" }).click();
await wait(9000);

// 3. Why now, then the Harvest → Q-Day scrub (30 s).
mark("why now");
await glide(page, "#why-now", 2000);
await wait(8000);
mark("how it works");
await glide(page, "#how-it-works", 2000);
for (let k = 0; k < 10; k++) {
  await page.mouse.wheel(0, 260);
  await wait(1500);
}
await wait(3000);

// 4. Demo 3: Q-Day (35 s).
mark("demo 3");
await page.goto(`${BASE}/demo/qday`, { waitUntil: "domcontentloaded" });
await wait(6000);
await page.getByRole("button", { name: /Go to Q-Day/ }).click();
await wait(22000);
await page.mouse.wheel(0, 500);
await wait(6000);

// 5. Demo 2: deploy all five adapters; counters climb (35 s).
mark("demo 2");
await page.goto(`${BASE}/demo/deploy`, { waitUntil: "domcontentloaded" });
await wait(5000);
await page.getByRole("button", { name: "Deploy all" }).click();
await wait(30000);

// 6. Demo 4: tamper with the Proof Chain (25 s).
mark("demo 4");
await page.goto(`${BASE}/demo/ledger`, { waitUntil: "domcontentloaded" });
await wait(3500);
await page.getByRole("button", { name: "Verify the chain" }).click();
await wait(4500);
await page.getByRole("button", { name: "Tamper with entry #42" }).click();
await wait(5000);
await page.getByRole("button", { name: "Verify the chain" }).click();
await wait(8000);

// 7. Why QuantumLedger (15 s).
mark("why quantumledger");
await page.goto(`${BASE}/#why-quantumledger`, { waitUntil: "domcontentloaded" });
await wait(2500);
await glide(page, "#why-quantumledger", 800);
await wait(11000);
mark("end");

const video = page.video();
await ctx.close();
await browser.close();
await fetch(`${BASE}/api/reset-all`, { method: "POST" }).catch(() => {});

const webm = `${OUT}demo.webm`;
renameSync(await video.path(), webm);
rmSync(TMP, { recursive: true, force: true });
const ffmpeg = require("ffmpeg-static");
execFileSync(
  ffmpeg,
  [
    "-y",
    "-loglevel",
    "error",
    "-i",
    webm,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "26",
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
    `${OUT}demo.mp4`,
  ],
  { stdio: "inherit" },
);
rmSync(webm);
console.log(`✓ ${OUT}demo.mp4`);
