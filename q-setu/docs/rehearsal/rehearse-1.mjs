#!/usr/bin/env node
/* global window, document, requestAnimationFrame, PerformanceObserver, performance */
/**
 * Judge rehearsal: plays ?tour=1 end to end the way a judge sees it.
 * node rehearse.mjs <label> <base> <width> <videoOut> [--present] [--block-external] [--norecord]
 * Writes <scratch>/<label>/{result.json, shots/*.png}.
 */
import { createRequire } from "node:module";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
const require = createRequire(
  "/Users/yashas/securemailscope/pqc-scanner/quantum-dark-pool/q-setu/package.json",
);
const { chromium, devices } = require("@playwright/test");

const [label, BASE, width, videoOut] = process.argv.slice(2);
const flags = new Set(process.argv.slice(6));
const PRESENT = flags.has("--present");
const BLOCK = flags.has("--block-external");
const RECORD = !flags.has("--norecord");
const SCR = `/private/tmp/claude-501/-Users-yashas/40dd4f48-a5b0-4fd9-97c1-38e567a4d899/scratchpad/judge-rehearsal/${label}`;
mkdirSync(`${SCR}/shots`, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const vp =
  width === "390"
    ? { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } }
    : { viewport: { width: 1440, height: 900 } };

const PROBE = () => {
  const w = window;
  w.__frames = [];
  w.__long = [];
  const stepNow = () =>
    document.querySelector("[data-tour-bar]")?.getAttribute("data-tour-step") ?? "-";
  w.__drew = 0;
  for (const C of [w.WebGL2RenderingContext, w.WebGLRenderingContext]) {
    if (!C) continue;
    for (const f of [
      "drawElements",
      "drawArrays",
      "drawElementsInstanced",
      "drawArraysInstanced",
    ]) {
      const o = C.prototype[f];
      if (!o) continue;
      C.prototype[f] = function (...a) {
        w.__drew++;
        return o.apply(this, a);
      };
    }
  }
  let last = performance.now();
  const tick = (now) => {
    w.__frames.push([stepNow(), now - last, now, w.__drew]);
    w.__drew = 0;
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) =>
      l
        .getEntries()
        .forEach((e) => w.__long.push([stepNow(), Math.round(e.duration), location.pathname])),
    ).observe({ type: "longtask", buffered: true });
  } catch {}
};

/** Text boxes that visibly overlap one another (leaf text nodes, not ancestor/descendant). */
const OVERLAPS = () => {
  const els = [...document.querySelectorAll("body *")].filter((e) => {
    if (!e.childNodes.length) return false;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) return false;
    const r = e.getBoundingClientRect();
    if (
      r.width < 4 ||
      r.height < 4 ||
      r.bottom < 0 ||
      r.top > innerHeight ||
      r.right < 0 ||
      r.left > innerWidth
    )
      return false;
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || Number(cs.opacity) < 0.2) return false;
    if (e.closest("[aria-hidden='true'],.sr-only")) return false;
    // ancestors' opacity
    let p = e.parentElement;
    while (p) {
      if (Number(getComputedStyle(p).opacity) < 0.2) return false;
      p = p.parentElement;
    }
    return true;
  });
  const out = [];
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i],
        b = els[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(),
        rb = b.getBoundingClientRect();
      const x = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
      const y = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
      const area = x * y;
      const small = Math.min(ra.width * ra.height, rb.width * rb.height);
      if (area > 0.3 * small && area > 60)
        out.push([
          a.textContent.trim().slice(0, 50),
          b.textContent.trim().slice(0, 50),
          Math.round(ra.top),
          Math.round(ra.left),
        ]);
    }
  return out.slice(0, 12);
};

const GL = () => {
  const c = [...document.querySelectorAll("canvas")].map((c) => {
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), pos: getComputedStyle(c).position };
  });
  return {
    canvases: c,
    glLost: document.documentElement.hasAttribute("data-gl-lost"),
    posters: document.querySelectorAll("[data-gl-poster],[data-poster]").length,
    caption: document.querySelector("[data-tour-caption]")?.textContent ?? null,
  };
};

async function phoneSeal(browser, log) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const ph = await ctx.newPage();
  const t = Date.now();
  try {
    await ph.goto(`${BASE}/join`);
    await ph.getByTestId("visitor-name").waitFor({ timeout: 20_000 });
    await ph.getByRole("button", { name: "Seal & send" }).click();
    await ph.locator('[data-state="verified"]').waitFor({ timeout: 30_000 });
    log(`  phone sealed in ${((Date.now() - t) / 1000).toFixed(1)} s`);
    return { ok: true, s: (Date.now() - t) / 1000 };
  } catch (e) {
    const shot = `${SCR}/shots/phone-fail.png`;
    await ph.screenshot({ path: shot }).catch(() => {});
    log(`  phone seal FAILED: ${e.message.split("\n")[0]}`);
    return { ok: false, err: e.message.split("\n")[0] };
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch({ channel: "chrome" });
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
const recDir = `${SCR}/.rec`;
const ctx = await browser.newContext({
  ...vp,
  ...(RECORD ? { recordVideo: { dir: recDir, size: vp.viewport } } : {}),
});
await ctx.addInitScript(PROBE);
const external = [];
const httpErr = [];
const consoleMsgs = [];
const pageErrors = [];
if (BLOCK) {
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.protocol === "data:" ||
      u.protocol === "blob:"
    )
      return route.continue();
    external.push(route.request().url());
    return route.abort("internetdisconnected");
  });
}
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 300) });
});
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
page.on("request", (r) => {
  const u = new URL(r.url());
  if (!BLOCK && !["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("data"))
    external.push(r.url());
});
page.on("response", (r) => {
  if (r.status() >= 400) httpErr.push({ status: r.status(), url: r.url().replace(BASE, "") });
});

const log = (s) => console.log(`[${label}] ${s}`);
log(`renderer ${renderer}`);
const t0 = Date.now();
if (PRESENT) {
  await page.goto(`${BASE}/?present=1`, { waitUntil: "load" });
  await page
    .waitForURL(/\/diagnostics/, { timeout: 15_000 })
    .catch(() => log("present=1 did not redirect"));
  await wait(1500);
  const presentOn = await page.evaluate(() =>
    document.documentElement.hasAttribute("data-present"),
  );
  log(`presenter on: ${presentOn}`);
  await page.screenshot({ path: `${SCR}/shots/00-present.png` });
}
const tNav = Date.now();
await page.goto(`${BASE}/?tour=1`, { waitUntil: "load" });
const loadMs = Date.now() - tNav;
log(`tour page load ${loadMs} ms`);
const tStart = Date.now();
const steps = [];
const checks = {};
let last = "";
let joined = null;
let n = 0;
let shotN = 0;
const periodic = setInterval(async () => {
  const st = last;
  if (!st) return;
  const id = `p${String(++shotN).padStart(3, "0")}-${st}`;
  try {
    await page.screenshot({ path: `${SCR}/shots/${id}.png` });
    checks[id] = {
      at: (Date.now() - tStart) / 1000,
      overlaps: await page.evaluate(OVERLAPS),
      gl: await page.evaluate(GL),
      url: page.url().replace(BASE, ""),
    };
  } catch {}
}, 3500);
while (Date.now() - tStart < 360_000) {
  const step = await page
    .locator("[data-tour-bar]")
    .getAttribute("data-tour-step", { timeout: 1000 })
    .catch(() => null);
  const at = (Date.now() - tStart) / 1000;
  if (step !== last) {
    if (steps.length) steps[steps.length - 1].end = at;
    if (step) steps.push({ step, start: at, url: page.url().replace(BASE, "") });
    log(`${at.toFixed(1)} s  ${step ?? "end"}`);
    last = step;
    if (step) {
      n++;
      const id = `${String(n).padStart(2, "0")}-${step}`;
      // A first shot 2.5 s in, a second near the step's middle.
      setTimeout(async () => {
        try {
          await page.screenshot({ path: `${SCR}/shots/${id}-a.png` });
          checks[`${id}-a`] = {
            overlaps: await page.evaluate(OVERLAPS),
            gl: await page.evaluate(GL),
            url: page.url().replace(BASE, ""),
          };
          if (step === "index" || step === "impact" || step === "diagnostics" || step === "ledger")
            checks[`${id}-a`].text = (
              await page.evaluate(() => document.querySelector("main")?.innerText ?? "")
            ).slice(0, 4000);
        } catch {}
      }, 2500);
      setTimeout(async () => {
        try {
          if (
            (await page
              .locator("[data-tour-bar]")
              .getAttribute("data-tour-step", { timeout: 500 })) !== step
          )
            return;
          await page.screenshot({ path: `${SCR}/shots/${id}-b.png` });
          checks[`${id}-b`] = {
            overlaps: await page.evaluate(OVERLAPS),
            gl: await page.evaluate(GL),
            url: page.url().replace(BASE, ""),
          };
          if (
            step === "index" ||
            step === "diagnostics" ||
            step === "ledger" ||
            step === "qday" ||
            step === "deploy"
          )
            checks[`${id}-b`].text = (
              await page.evaluate(() => document.querySelector("main")?.innerText ?? "")
            ).slice(0, 4000);
        } catch {}
      }, 11_000);
    }
  }
  if (!step && Date.now() - tStart > 5000) break;
  if (step === "phone" && !joined) {
    joined = "pending";
    joined = await phoneSeal(browser, log);
  }
  await wait(250);
}
clearInterval(periodic);
const total = (Date.now() - tStart) / 1000;
await wait(1500);
await page.screenshot({ path: `${SCR}/shots/99-after.png` });
const frames = await page.evaluate(() => window.__frames).catch(() => []);
const longs = await page.evaluate(() => window.__long).catch(() => []);
const video = RECORD ? page.video() : null;
await ctx.close();
if (video) {
  renameSync(await video.path(), videoOut);
  rmSync(recDir, { recursive: true, force: true });
}
await browser.close();

// Per-step frame stats (frames from the page that ended the run only: rAF data resets on full loads,
// but the tour uses client-side navigation, so this is the whole tour).
const by = {};
for (const [s, dt, at, dr] of frames) (by[s] ??= []).push([dt, at, dr]);
const fps = {};
for (const [s, list] of Object.entries(by)) {
  if (list.length < 10) continue;
  const d = list.map((x) => x[0]);
  const sorted = [...d].sort((a, b) => a - b);
  const sum = d.reduce((a, b) => a + b, 0);
  fps[s] = {
    fps: Math.round((d.length / sum) * 1000),
    p50: +sorted[Math.floor(d.length * 0.5)].toFixed(1),
    p95: +sorted[Math.floor(d.length * 0.95)].toFixed(1),
    max: Math.round(sorted[sorted.length - 1]),
    stalls300: list.filter((x) => x[0] > 300).map((x) => Math.round(x[0])),
    over100: d.filter((x) => x > 100).length,
    glFps: Math.round((list.filter((x) => x[2] > 0).length / sum) * 1000),
    glFramesShare: +(list.filter((x) => x[2] > 0).length / list.length).toFixed(2),
  };
}
const result = {
  label,
  base: BASE,
  width,
  present: PRESENT,
  blockExternal: BLOCK,
  renderer,
  tourPageLoadMs: loadMs,
  totalSeconds: total,
  steps,
  phone: joined,
  fps,
  longTasksOver300: longs.filter((l) => l[1] > 300),
  longTasksOver100: longs.filter((l) => l[1] > 100).length,
  httpErrors: httpErr,
  external: [...new Set(external)],
  console: consoleMsgs,
  pageErrors,
  checks,
  video: videoOut,
};
writeFileSync(`${SCR}/result.json`, JSON.stringify(result, null, 2));
log(
  `done ${total.toFixed(1)} s; http errors ${httpErr.length}; external ${result.external.length}; console ${consoleMsgs.length}; pageErrors ${pageErrors.length}`,
);
