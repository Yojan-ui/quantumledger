#!/usr/bin/env node
/**
 * `node scripts/judge-tour.mjs [outDir]`: plays the one-click judge tour (?tour=1) end to end and
 *  - records it as <outDir>/tour-1440.webm (1440×900) and <outDir>/tour-390.webm (390×844 phone),
 *  - measures frame rate per tour step in separate, unrecorded runs (recording costs frames),
 *  - measures INP from real (trusted) input on the interactive parts of the site,
 * and writes <outDir>/metrics.json. During the "join" step a second, phone-sized browser opens
 * /join and seals a real message, so the tour's wait for the audience is exercised too.
 * Uses the system Chrome with its normal GPU path (Metal on a Mac), against BASE.
 */
/* global window, document, requestAnimationFrame, PerformanceObserver -- page.evaluate code */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const out = process.argv[2] ?? new URL("../docs/judge/", import.meta.url).pathname;
const BASE = process.env.BASE ?? "http://localhost:3000";
const ONLY = process.env.ONLY?.split(","); // e.g. ONLY=measure or ONLY=record
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = {
  1440: { viewport: { width: 1440, height: 900 } },
  390: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
};

/** A phone joins and seals one message (a separate browser context, like a judge's phone). */
async function phoneSeal(browser) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const ph = await ctx.newPage();
  await ph.goto(`${BASE}/join`);
  await ph.getByTestId("visitor-name").waitFor();
  await ph.getByRole("button", { name: "Seal & send" }).click();
  await ph.locator('[data-state="verified"]').waitFor({ timeout: 30_000 });
  await ctx.close();
}

/** Installed in the page: frame intervals tagged with the tour step on screen. */
const FPS_PROBE = () => {
  const w = window;
  w.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    const step = document.querySelector("[data-tour-bar]")?.getAttribute("data-tour-step") ?? "-";
    w.__frames.push([step, now - last]);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** Plays the tour on `page` until it ends; joins from a phone during the join step. */
async function playTour(browser, page, log) {
  await page.goto(`${BASE}/?tour=1`, { waitUntil: "load" });
  const t0 = Date.now();
  let last = "";
  let joined = false;
  const steps = [];
  while (Date.now() - t0 < 300_000) {
    const step = await page
      .locator("[data-tour-bar]")
      .getAttribute("data-tour-step", { timeout: 1000 })
      .catch(() => null);
    if (step !== last) {
      if (step) steps.push({ step, at: (Date.now() - t0) / 1000 });
      log(`  ${((Date.now() - t0) / 1000).toFixed(1)} s  ${step ?? "end"}`);
      last = step;
    }
    if (!step && Date.now() - t0 > 5000) break;
    if (step === "phone" && !joined) {
      joined = true;
      await phoneSeal(browser);
    }
    await wait(300);
  }
  return { seconds: (Date.now() - t0) / 1000, steps };
}

function fpsSummary(frames) {
  const by = {};
  for (const [step, dt] of frames) (by[step] ??= []).push(dt);
  const out = {};
  for (const [step, list] of Object.entries(by)) {
    if (step === "-" || list.length < 10) continue;
    const sorted = [...list].sort((a, b) => a - b);
    const total = list.reduce((a, b) => a + b, 0);
    out[step] = {
      fps: Math.round((list.length / total) * 1000),
      p95FrameMs: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(1)),
      over33ms: Number(((list.filter((x) => x > 33.4).length / list.length) * 100).toFixed(1)),
    };
  }
  return out;
}

/** INP from trusted input: the slowest interaction (all runs have < 50 interactions). */
async function measureInp(browser, key) {
  const ctx = await browser.newContext(VIEWPORTS[key]);
  const page = await ctx.newPage();
  const phone = key === "390";
  await page.addInitScript(() => {
    window.__inp = [];
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => {
        if (e.interactionId)
          window.__inp.push([
            e.name,
            Math.round(e.duration),
            e.target?.textContent?.slice(0, 30) ?? "",
          ]);
      }),
    ).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  const act = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      console.log(`    (skipped ${label}: ${e.message.split("\n")[0]})`);
    }
    await wait(700);
  };
  const tap = (loc) => (phone ? loc.tap() : loc.click());
  const collected = [];
  const flush = async (where) => {
    const list = await page.evaluate(() => window.__inp.splice(0));
    for (const [name, ms, target] of list) collected.push({ where, name, ms, target });
  };

  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await wait(2500);
  if (!phone)
    await act("copy toggle", () => tap(page.getByRole("button", { name: "technical" }).first()));
  if (!phone)
    await act("copy toggle back", () => tap(page.getByRole("button", { name: "simple" }).first()));
  await page.locator("#index").scrollIntoViewIfNeeded();
  await wait(800);
  for (const n of [1, 2, 0])
    await act("index measure", () => tap(page.locator("#index [aria-pressed]").nth(n)));
  await page.locator("#impact").scrollIntoViewIfNeeded();
  await act("impact sector", () => page.locator("#impact select").selectOption("banking"));
  await act("impact years", async () => {
    const y = page.locator('#impact input[max="100"]');
    await tap(y);
    await y.fill("45");
  });
  await page.locator("#scan").scrollIntoViewIfNeeded();
  await act("scan suggestion", () => tap(page.getByRole("button", { name: "npci.org.in" })));
  await wait(3000);
  await flush("home");

  await page.goto(`${BASE}/demo/how-it-works`, { waitUntil: "load" });
  await wait(3000);
  for (let i = 0; i < 3; i++)
    await act("demo 1 next", () => tap(page.getByRole("button", { name: /^Next/ }).first()));
  await wait(2500);
  await flush("demo 1");

  await page.goto(`${BASE}/demo/ledger`, { waitUntil: "load" });
  await wait(3000);
  await act("ledger verify", () =>
    tap(page.getByRole("button", { name: /Verify the chain/ }).first()),
  );
  await wait(3000);
  await flush("demo 4");

  await page.goto(`${BASE}/join`, { waitUntil: "load" });
  await page.getByTestId("visitor-name").waitFor();
  await act("join emoji", () => tap(page.getByRole("button", { name: "🚀" })));
  await act("seal & send", () => tap(page.getByRole("button", { name: "Seal & send" })));
  await wait(2000);
  await flush("join");
  await ctx.close();

  const worst = collected.reduce((m, x) => Math.max(m, x.ms), 0);
  const slow = collected.filter((x) => x.ms >= 100);
  return { inpMs: worst, interactions: collected.length, slow };
}

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
});
const renderer = await (async () => {
  const p = await browser.newPage();
  const r = await p.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const e = gl?.getExtension("WEBGL_debug_renderer_info");
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  await p.close();
  return r;
})();
console.log("renderer:", renderer);
await fetch(`${BASE}/api/reset-all`, { method: "POST" }).catch(() => {});

const metrics = { measuredAt: new Date().toISOString(), base: BASE, renderer, runs: {} };
for (const key of Object.keys(VIEWPORTS)) {
  if (!ONLY || ONLY.includes("record")) {
    console.log(`record ${key}`);
    const dir = `${out}/.rec-${key}`;
    const ctx = await browser.newContext({
      ...VIEWPORTS[key],
      recordVideo: { dir, size: VIEWPORTS[key].viewport },
    });
    const page = await ctx.newPage();
    const r = await playTour(browser, page, console.log);
    const video = page.video();
    await ctx.close();
    renameSync(await video.path(), `${out}/tour-${key}.webm`);
    rmSync(dir, { recursive: true, force: true });
    (metrics.runs[key] ??= {}).recorded = r;
  }
  if (!ONLY || ONLY.includes("measure")) {
    console.log(`measure ${key}`);
    const ctx = await browser.newContext(VIEWPORTS[key]);
    await ctx.addInitScript(FPS_PROBE);
    const page = await ctx.newPage();
    const r = await playTour(browser, page, console.log);
    const frames = await page.evaluate(() => window.__frames);
    await ctx.close();
    (metrics.runs[key] ??= {}).tour = r;
    metrics.runs[key].fps = fpsSummary(frames);
    metrics.runs[key].inp = await measureInp(browser, key);
    console.log(JSON.stringify(metrics.runs[key].fps), "INP", metrics.runs[key].inp.inpMs, "ms");
  }
}
await browser.close();
writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics, null, 2) + "\n");
console.log(`wrote ${out}/metrics.json`);
