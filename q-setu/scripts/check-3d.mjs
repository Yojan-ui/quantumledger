#!/usr/bin/env node
/* global window, document, getComputedStyle, requestAnimationFrame, HTMLCanvasElement, scrollY, innerHeight -- page code */
/**
 * `node scripts/check-3d.mjs [path...]`: proves the site's 3D renders, against BASE (default
 * http://localhost:3000). Opens /, /diagnostics and every /demo/* page at 1440×900 and, for every 3D
 * area on the page ([data-3d] Views and [data-world-focus] globe areas), scrolls it into view and
 * fails unless:
 *   - a visible WebGL canvas exists;
 *   - the frame and draw-call counters keep increasing for 3 s (counted by wrapping the GL context's
 *     draw calls: a "frame" is an animation frame in which at least one draw happened);
 *   - more than 2% of the area's canvas pixels differ from the background (the canvas clears to
 *     transparent, so a drawn pixel is one with alpha > 0; read back via preserveDrawingBuffer);
 *   - there are no console errors and no webglcontextlost events.
 * A page with no 3D area is reported SKIP. `/demo/deploy@dive` also opens Demo 2's Shield dive.
 * HTTP 429 responses are reported separately (rate limiting, not a 3D failure).
 * GL=swiftshader uses software GL; the default is the real GPU. Exit code 1 on any failure.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PAGES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "/",
      "/diagnostics",
      "/demo/deploy",
      "/demo/deploy@dive",
      "/demo/how-it-works",
      "/demo/ledger",
      "/demo/qday",
      "/demo/scanner",
    ];
const WINDOW_MS = 3000;
const MIN_PIXELS = 0.02;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs in the page before any script: counts draws per animation frame and context losses. */
function instrument() {
  const s = (window.__3d = { draws: 0, frames: 0, lost: 0, canvases: [] });
  let inFrame = 0;
  const count = () => {
    s.draws++;
    inFrame++;
  };
  const tick = () => {
    if (inFrame) s.frames++;
    inFrame = 0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const fn of [
      "drawArrays",
      "drawElements",
      "drawArraysInstanced",
      "drawElementsInstanced",
      "drawRangeElements",
    ]) {
      const orig = C.prototype[fn];
      if (!orig) continue;
      C.prototype[fn] = function (...a) {
        count();
        return orig.apply(this, a);
      };
    }
  }
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = /webgl/.test(type);
    const ctx = get.call(this, type, gl ? { ...attrs, preserveDrawingBuffer: true } : attrs);
    if (gl && ctx && !s.canvases.includes(this)) {
      s.canvases.push(this);
      this.addEventListener("webglcontextlost", () => s.lost++);
    }
    return ctx;
  };
}

/** The share of drawn pixels of the WebGL canvas inside the element's on-screen rectangle. */
function coverage({ sel, i: idx }) {
  const el = document.querySelectorAll(sel)[idx];
  const c = window.__3d.canvases.find((x) => x.isConnected);
  if (!el || !c) return { pixels: 0, visibleCanvas: false };
  const cs = getComputedStyle(c);
  const cr = c.getBoundingClientRect();
  const visibleCanvas =
    cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0 && cr.width > 0;
  const r = el.getBoundingClientRect();
  const left = Math.max(0, r.left);
  const top = Math.max(0, r.top);
  const right = Math.min(window.innerWidth, r.right);
  const bottom = Math.min(window.innerHeight, r.bottom);
  if (right <= left || bottom <= top)
    return {
      pixels: 0,
      visibleCanvas,
      at: ["offscreen", Math.round(r.top), Math.round(r.height), Math.round(scrollY)],
    };
  const k = c.width / cr.width;
  const w = Math.round((right - left) * k);
  const h = Math.round((bottom - top) * k);
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w / 2));
  cv.height = Math.max(1, Math.round(h / 2));
  const x = cv.getContext("2d");
  x.drawImage(c, (left - cr.left) * k, (top - cr.top) * k, w, h, 0, 0, cv.width, cv.height);
  const d = x.getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
  return {
    pixels: n / (d.length / 4),
    visibleCanvas,
    at: [Math.round(r.top), Math.round(r.height), Math.round(scrollY)],
  };
}

const browser = await chromium.launch({
  channel: "chrome",
  args:
    process.env.GL === "swiftshader"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : [],
});
const results = [];
/** Steps that open a scene a visitor reaches by clicking (`<path>@<step>`). */
const STEPS = {
  // Demo 2: pick a system and the camera dives into the "Shield plugs in" scene.
  dive: async (page) => {
    await wait(2500);
    await page.evaluate(() =>
      document.querySelectorAll('[aria-label="What are you protecting?"] button')[1]?.click(),
    );
    await wait(3000);
  },
};
for (const entry of PAGES) {
  const [path, step] = entry.split("@");
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(instrument);
  const errors = [];
  const limited = new Set();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("console", (m) => {
    // A 429 is the server's per-IP rate limit, reported on its own line, not as a 3D failure.
    if (/status of 429/.test(m.text())) return;
    if (m.type() === "error" || /Shader Error|WebGLProgram|GL_INVALID/.test(m.text()))
      errors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("response", (r) => {
    if (r.status() === 429) limited.add(new URL(r.url()).pathname);
  });
  const res = await page.goto(BASE + path, { waitUntil: "load" }).catch((e) => e);
  if (res instanceof Error || !res.ok()) {
    results.push({
      path: entry,
      pass: false,
      areas: [],
      errors: [`navigation: ${res instanceof Error ? res.message : res.status()}`],
      limited: [...limited],
    });
    await page.close();
    continue;
  }
  // The world boots in idle time after load.
  await page
    .waitForFunction(() => window.__3d.canvases.some((c) => c.isConnected), null, {
      timeout: 20_000,
    })
    .catch(() => {});
  await wait(1500);
  if (step) await STEPS[step](page);
  const areas = await page.evaluate(() => {
    const out = [];
    for (const sel of ["[data-3d]", "[data-world-focus]"])
      document.querySelectorAll(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        // Skip zero-size variants (breakpoint twins) and globe areas that wrap a View.
        if (r.width < 4 || r.height < 4) return;
        if (sel === "[data-world-focus]" && el.querySelector("[data-3d]")) return;
        // Tagged, not indexed: Views mount and unmount as the page scrolls, shifting indices.
        el.setAttribute("data-check3d", String(out.length));
        out.push({
          sel: `[data-check3d="${out.length}"]`,
          kind: sel,
          i: 0,
          label: el.getAttribute("aria-label") ?? sel,
        });
      });
    return out;
  });
  const measured = [];
  for (const a of areas) {
    // Measured now, not at load: pinned sections add their spacers after the page boots.
    // A View in a pinned (sticky) section is scrubbed by that section's scroll: it's measured a third
    // of the way through the pin, not at its first pixel (beat 0 of a film can be a near-empty wide).
    await page.evaluate(({ sel, i }) => {
      const el = document.querySelectorAll(sel)[i];
      let sticky = el;
      while (sticky && getComputedStyle(sticky).position !== "sticky")
        sticky = sticky.parentElement;
      const track = sticky?.parentElement;
      if (track && track.offsetHeight > innerHeight * 1.5) {
        const t = track.getBoundingClientRect();
        window.scrollTo({
          top: t.top + scrollY + (t.height - innerHeight) / 3,
          behavior: "instant",
        });
        return;
      }
      const r = el.getBoundingClientRect();
      const y = r.top + scrollY;
      window.scrollTo({
        top: Math.max(0, y + Math.min(r.height, innerHeight) / 2 - innerHeight / 2),
        behavior: "instant",
      });
    }, a);
    if (a.kind === "[data-3d]")
      await page
        .waitForFunction(
          ({ sel, i }) => document.querySelectorAll(sel)[i]?.hasAttribute("data-ready"),
          a,
          { timeout: 20_000 },
        )
        .catch(() => {});
    await wait(800);
    const s0 = await page.evaluate(() => ({ ...window.__3d, canvases: undefined }));
    const t0 = Date.now();
    // Counters must keep rising through the whole window, not just once.
    let stalled = false;
    let prev = s0;
    for (let k = 0; k < 3; k++) {
      await wait(WINDOW_MS / 3);
      const s = await page.evaluate(() => ({ ...window.__3d, canvases: undefined }));
      if (s.frames <= prev.frames || s.draws <= prev.draws) stalled = true;
      prev = s;
    }
    const secs = (Date.now() - t0) / 1000;
    const cov = await page
      .evaluate(coverage, a)
      .catch((e) => (errors.push(`check: ${e.message}`), null));
    const ready = await page.evaluate(
      ({ sel, i }) => document.querySelectorAll(sel)[i]?.hasAttribute("data-ready") ?? null,
      a,
    );
    const frames = prev.frames - s0.frames;
    const draws = prev.draws - s0.draws;
    const m = {
      label: a.label.slice(0, 60),
      fps: +(frames / secs).toFixed(1),
      drawsPerFrame: frames ? +(draws / frames).toFixed(1) : 0,
      pixels: cov ? +(cov.pixels * 100).toFixed(1) : 0,
      visibleCanvas: !!cov?.visibleCanvas,
      ready: a.kind === "[data-3d]" ? ready : "n/a",
      lost: prev.lost,
      at: cov?.at,
      stalled,
    };
    m.fail = [
      !m.visibleCanvas && "no visible WebGL canvas",
      stalled && "frame/draw counters stalled",
      m.pixels <= MIN_PIXELS * 100 && `only ${m.pixels}% pixels drawn`,
      m.lost && "webglcontextlost",
      a.kind === "[data-3d]" && !ready && "scene never drew its first frame",
    ].filter(Boolean);
    measured.push(m);
  }
  // A page with no 3D area at all (the scanner) is skipped, not failed: the world never boots there
  // by design (WorldCanvas starts only on pages that have a 3D area).
  const pass = measured.every((m) => !m.fail.length) && !errors.length;
  results.push({
    path: entry,
    pass,
    areas: measured,
    errors,
    limited: [...limited],
    none: !areas.length,
  });
  await page.close();
}
await browser.close();

let ok = true;
for (const r of results) {
  ok &&= r.pass;
  console.log(
    `\n${r.none && r.pass ? "SKIP" : r.pass ? "PASS" : "FAIL"} ${r.path}${r.limited.length ? `  (HTTP 429 rate limit on ${r.limited.join(", ")})` : ""}`,
  );
  if (r.none) console.log("  no 3D area on this page (nothing to check)");
  for (const m of r.areas)
    console.log(
      `  ${m.fail.length ? "✗" : "✓"} ${m.label.padEnd(60)} ${String(m.fps).padStart(5)} fps  ${String(m.drawsPerFrame).padStart(5)} draws/frame  ${String(m.pixels).padStart(5)}% drawn${m.fail.length ? "  — " + m.fail.join("; ") : ""}`,
    );
  for (const e of r.errors) console.log(`  console ${e}`);
}
if (process.env.JSON) console.log(JSON.stringify(results, null, 2));
process.exit(ok ? 0 : 1);
