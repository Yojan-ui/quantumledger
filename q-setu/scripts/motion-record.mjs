#!/usr/bin/env node
/* global window, document, requestAnimationFrame -- page.evaluate code */
/**
 * `node scripts/motion-record.mjs <outDir>`: the motion pass's review recordings, against BASE
 * (default http://localhost:3000, a production server). Each scene is played the way a visitor would
 * play it, at 1440×900:
 *   - recorded to <outDir>/<scene>.webm (system Chrome, software GL so the video is deterministic);
 *   - then played again unrecorded on the real GPU, measuring frame times (rAF deltas), into
 *     <outDir>/fps.json: per scene, p50 / p95 frame time, the share of frames over 20 ms (< 50 fps)
 *     and the worst frame, and when each frame over 50 ms happened (ms since the page started).
 * ONLY=deploy-dns,ledger limits the scenes.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const out = (process.argv[2] ?? "docs/motion2/after-1").replace(/\/?$/, "/");
const BASE = process.env.BASE ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const press = async (p, name) => {
  const b = p.getByRole("button", { name }).first();
  if (await b.count()) await b.click().catch(() => {});
};
const dive = (route) => async (p) => {
  await wait(2500);
  await p.evaluate(() =>
    document.querySelectorAll('[aria-label="What are you protecting?"] button')[1]?.click(),
  );
  await wait(2200);
  if (route !== "DNS") await press(p, route);
  // The whole run (scan → verify), then the attack where the route has one.
  await p
    .getByText(/A fresh scan from outside/)
    .first()
    .waitFor({ timeout: 60_000 })
    .catch(() => {});
  await wait(4500);
  if (route !== "One line of code") {
    await press(p, /Attack it/);
    await wait(8000);
  }
  await press(p, /Back to the map/);
  await wait(3500);
};

const SCENES = [
  [
    "diagnostics",
    "/diagnostics",
    async (p) => {
      await p
        .locator('[data-stage="rescan"][data-status="done"]')
        .first()
        .waitFor({ timeout: 90_000 })
        .catch(() => {});
      await wait(3000);
    },
  ],
  [
    "home",
    "/",
    async (p) => {
      // The whole page, scrolled at reading pace: the globe's chapters, how it works, Q-Day, the
      // Shield slot.
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 220) {
        await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
        await wait(260);
      }
    },
  ],
  [
    "how-it-works",
    "/demo/how-it-works",
    async (p) => {
      await wait(2500);
      await press(p, /^Play$/);
      await p
        .getByText(/messages over AES-256-GCM|Every message is now locked/)
        .first()
        .waitFor({ timeout: 90_000 })
        .catch(() => {});
      await wait(5000);
    },
  ],
  [
    "qday",
    "/demo/qday",
    async (p) => {
      await wait(2500);
      await press(p, /^Play$/);
      await wait(36_000);
    },
  ],
  [
    "ledger",
    "/demo/ledger",
    async (p) => {
      await wait(2500);
      await press(p, "Verify the chain");
      await wait(5000);
      await press(p, "Tamper with entry #42");
      await wait(4000);
      await press(p, "Verify the chain");
      await wait(6000);
      await press(p, "Restore");
      await wait(4000);
      await press(p, "Verify the chain");
      await wait(5000);
    },
  ],
  ["deploy-dns", "/demo/deploy", dive("DNS")],
  ["deploy-container", "/demo/deploy", dive("Container")],
  ["deploy-code", "/demo/deploy", dive("One line of code")],
  [
    "deploy-all",
    "/demo/deploy",
    async (p) => {
      await wait(2500);
      await press(p, "Deploy all");
      await p
        .getByText(/Every \w+ system now seals/)
        .first()
        .waitFor({ timeout: 120_000 })
        .catch(() => {});
      await wait(4000);
    },
  ],
].filter(([id]) => !process.env.ONLY || process.env.ONLY.split(",").includes(id));

const FPS_PROBE = () => {
  const w = window;
  w.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    w.__frames.push([now, now - last]);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const stats = (pairs) => {
  const a = pairs.map((p) => p[1]);
  const s = [...a].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  return {
    frames: s.length,
    p50: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    over20: +((s.filter((x) => x > 20).length / Math.max(1, s.length)) * 100).toFixed(2),
    worst: +(s[s.length - 1] ?? 0).toFixed(1),
    /** Every frame over 50 ms: [ms since the page started, frame time]. */
    spikes: pairs.filter((p) => p[1] > 50).map((p) => [Math.round(p[0]), +p[1].toFixed(1)]),
  };
};

const fps = {};
// 1. Recorded (software GL, so the video doesn't depend on this machine's GPU timing).
{
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const [id, path, play] of SCENES) {
    const dir = `${out}.rec-${id}/`;
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir, size: { width: 1440, height: 900 } },
    });
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: "load" });
    await play(page);
    const video = page.video();
    await ctx.close();
    if (video) renameSync(await video.path(), `${out}${id}.webm`);
    rmSync(dir, { recursive: true, force: true });
    console.log(`recorded ${id}`);
  }
  await browser.close();
}
// 2. Measured on the GPU, unrecorded.
{
  const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu"] });
  for (const [id, path, play] of SCENES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(FPS_PROBE);
    await page.goto(BASE + path, { waitUntil: "load" });
    await play(page);
    const frames = await page.evaluate(() => window.__frames.slice(30));
    fps[id] = stats(frames);
    console.log(id, JSON.stringify(fps[id]));
    await ctx.close();
  }
  await browser.close();
}
writeFileSync(`${out}fps.json`, JSON.stringify(fps, null, 2) + "\n");
