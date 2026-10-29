#!/usr/bin/env node
/**
 * Lab route check against a running server (no mocks: every screen reads the real /api/lab backend).
 *   node tools/route_check.mjs [--base http://127.0.0.1:3000] [--out screenshots/lab/stageN] [--swiftshader]
 * 1. End-to-end through the UI: sample scan -> run -> results -> finding (J) -> evidence; a cached host
 *    scan; a rejected input (field error); an oversized upload (field error).
 * 2. 3D: picking (tooltip fields = the finding the click opens), Esc flight back within the band, draw
 *    calls <= 60, fps / p95 / worst frame on the real GPU (Chromium with Metal/ANGLE unless --swiftshader).
 * 3. Fallbacks: ?no3d, reduced motion and a forced WebGL context loss all give the 2D map with working links.
 * 4. Every route x 3 viewports x (3D, ?no3d): no console errors or warnings, no page errors, no failed or
 *    4xx/5xx requests, an h1, no horizontal scroll, skip link first in tab order; full-page screenshot.
 * Exits 1 on any problem.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://127.0.0.1:3000");
const OUT = arg("--out", "screenshots/lab/latest");
const GPU_ARGS = process.argv.includes("--swiftshader")
  ? []
  : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"];
mkdirSync(OUT, { recursive: true });
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 844 },
};
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const report = {};

function watch(page, where) {
  page.on("console", (m) => {
    if (!["error", "warning"].includes(m.type())) return;
    if (page._expect4xx && /status of 4\d\d/.test(m.text())) return;
    fail(where(), `console ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => fail(where(), `page error: ${e.message}`));
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText || "";
    if (!/ERR_ABORTED/.test(f)) fail(where(), `request failed ${r.url()} ${f}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !page._expect4xx) fail(where(), `HTTP ${r.status()} ${r.url()}`);
  });
}
const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
};
const settle = (page) =>
  page
    .waitForFunction(() => !window.__lab3d || !window.__lab3d.flying, null, { timeout: 5000 })
    .catch(() => {});
const worldOn = (page) => page.waitForSelector('[data-stage][data-world="on"]', { timeout: 15000 });

const browser = await chromium.launch({ args: GPU_ARGS });
const t0 = Date.now();

// ---------- 1. end-to-end ----------
let runId = null,
  hostRunId = null;
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  let step = "e2e";
  watch(page, () => step);
  await page.goto(`${BASE}/lab`);
  step = "e2e landing";
  await page
    .getByRole("link", { name: /New scan/ })
    .first()
    .click();
  step = "e2e input";
  await page.waitForURL(/\/lab\/input/);
  await page.locator("aside .list li").first().getByRole("button", { name: "Add" }).click();
  await page.getByText(/Parse preview/).waitFor();
  await page.getByRole("button", { name: /Run scan/ }).click();
  step = "e2e run";
  await page.waitForURL(/\/lab\/runs\/[a-f0-9]{16}$/);
  runId = page.url().match(/runs\/([a-f0-9]{16})/)[1];
  await page.getByRole("link", { name: /Open results/ }).waitFor({ timeout: 30000 });
  await page.getByRole("link", { name: /Open results/ }).click();
  step = "e2e results";
  await page.waitForURL(/\/results$/);
  const inspect = page.getByRole("button", { name: /Inspect findings/ });
  if (await inspect.count()) {
    await inspect.click();
    step = "e2e finding";
    await page.waitForURL(/\/findings\/\d+\/\d+$/);
    const before = page.url();
    await page.keyboard.press("j");
    await page
      .waitForFunction((u) => location.href !== u, before)
      .catch(() => fail(step, "J did not move to the next finding"));
  }
  await page.goto(`${BASE}/lab/runs/${runId}/evidence`);
  step = "e2e evidence";
  await page
    .getByText(/Chain verified/)
    .first()
    .waitFor()
    .catch(() => fail(step, "no 'Chain verified' on evidence"));

  step = "e2e host";
  await page.goto(`${BASE}/lab/input`);
  await page.fill("#url", "ecc256.badssl.com");
  await page.locator(".meta", { hasText: "cached real scan only" }).first().waitFor();
  await page.getByRole("button", { name: /Run scan/ }).click();
  await page.waitForURL(/\/lab\/runs\/[a-f0-9]{16}$/);
  hostRunId = page.url().match(/runs\/([a-f0-9]{16})/)[1];
  await page.getByRole("link", { name: /Open results/ }).waitFor({ timeout: 30000 });

  step = "e2e invalid";
  page._expect4xx = true;
  await page.goto(`${BASE}/lab/input`);
  await page.locator("aside .list li").first().getByRole("button", { name: "Add" }).click();
  await page.fill("#lifetime", "500");
  await page
    .locator(".field[data-invalid] .field-error")
    .waitFor()
    .catch(() => fail(step, "no field error for lifetime 500"));
  step = "e2e oversized upload";
  await page.goto(`${BASE}/lab/input`);
  await page.setInputFiles("#file-input", {
    name: "big.properties",
    mimeType: "text/plain",
    buffer: Buffer.alloc(256 * 1024 + 1, 0x61),
  });
  await page
    .locator(".dropzone[data-invalid]")
    .waitFor({ timeout: 5000 })
    .catch(() => fail(step, "oversized file not rejected"));
  page._expect4xx = false;
  await ctx.close();
}

// a run over all three Sample data inputs (16 findings) for the 3D checks
const ws = (await post("/api/lab/workspaces", {})).id;
const samples = (await (await fetch(`${BASE}/api/lab/samples`)).json()).samples;
const multi = (
  await post("/api/lab/runs", {
    workspace: ws,
    inputs: samples.map((s) => ({ kind: "sample", id: s.id })),
  })
).runId;
for (let i = 0; i < 100; i++) {
  const r = await (await fetch(`${BASE}/api/lab/runs/${multi}`)).json();
  if (r.status === "done") break;
  await new Promise((s) => setTimeout(s, 50));
}

// ---------- 2. 3D: picking, flight, budgets ----------
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  let step = "3d results";
  watch(page, () => step);
  await page.goto(`${BASE}/lab/runs/${multi}/results`, { waitUntil: "networkidle" });
  await worldOn(page).catch(() => fail(step, "3D stage never attached"));
  await page.locator("[data-stage]").scrollIntoViewIfNeeded();
  await settle(page);
  await page.evaluate(() => window.__lab3d.resetStats());
  await page.waitForTimeout(4000);
  const s = await page.evaluate(() => window.__lab3d.stats());
  report.frames = s;
  if (s.drawCalls > 60) fail(step, `${s.drawCalls} draw calls (budget 60)`);

  step = "3d picking";
  const scene = await (await fetch(`${BASE}/api/lab/runs/${multi}/scene`)).json();
  let picked = false;
  outer: for (const [fi, f] of scene.files.entries()) {
    for (const x of f.findings) {
      const pt = await page.evaluate((ref) => window.__lab3d.project(ref), { fi, n: x.n });
      if (!pt) continue;
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(120);
      const tip = page.locator(".tip:not([hidden])");
      if (!(await tip.count())) continue;
      const first = (await tip.locator("b").innerText()).trim();
      if (!/:\d+$/.test(first)) continue; // a score slab, not a pillar
      await page.mouse.click(pt.x, pt.y);
      await page.waitForURL(/\/findings\/\d+\/\d+$/, { timeout: 5000 });
      // the URL changes first; wait until the finding view itself has rendered
      await page.waitForFunction(
        () => /:\d+$/.test(document.getElementById("crumbs").textContent),
        null,
        { timeout: 5000 },
      );
      const crumbs = await page.locator("#crumbs").innerText();
      if (!crumbs.toLowerCase().includes(first.toLowerCase()))
        fail(step, `tooltip "${first}" but the click opened "${crumbs}"`);
      report.picking = { tooltip: first, opened: crumbs };
      picked = true;
      break outer;
    }
  }
  if (!picked) fail(step, "no pillar could be hovered and opened");

  step = "3d flight";
  await worldOn(page);
  await settle(page);
  await page.evaluate(() => window.__lab3d.resetStats());
  await page.keyboard.press("Escape");
  await page.waitForURL(/\/results$/);
  const fly0 = Date.now();
  await page
    .waitForFunction(() => window.__lab3d.flying, null, { timeout: 2000 })
    .catch(() => fail(step, "Esc did not start a flight"));
  await page.waitForFunction(() => !window.__lab3d.flying, null, { timeout: 4000 });
  report.flightMs = Date.now() - fly0;
  report.framesDuringFlight = await page.evaluate(() => window.__lab3d.stats());
  if (report.flightMs > 1600 + 250) fail(step, `flight took ${report.flightMs} ms`);

  step = "3d context loss";
  await page.evaluate(() =>
    document
      .querySelector("canvas.world")
      .getContext("webgl2")
      .getExtension("WEBGL_lose_context")
      .loseContext(),
  );
  await page
    .waitForFunction(() => document.documentElement.dataset.world === "off", null, {
      timeout: 5000,
    })
    .catch(() => fail(step, "no fallback after context loss"));
  if (await page.locator('[data-stage][data-world="on"]').count())
    fail(step, "stage still marked 3D after context loss");
  if (!(await page.locator(".fallback2d svg a").first().isVisible()))
    fail(step, "2D map not visible after context loss");
  await ctx.close();
}

// ---------- 2b. stage-4 scenes: intro, chain picking, verify, cancel, live map, DPR 2 ----------
const addSamples = async (page, n = 3) => {
  for (let i = 0; i < n; i++)
    await page.locator("aside .list li").nth(i).getByRole("button", { name: "Add" }).click();
  await page.getByText(/Parse preview/).waitFor();
};
{
  const health = await (await fetch(`${BASE}/api/lab/health`)).json();
  report.testDelayMs = health.testDelayMs;
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  let step = "landing intro";
  watch(page, () => step);
  await page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
  await worldOn(page).catch(() => fail(step, "chain stage never attached"));
  if (!(await page.evaluate(() => window.__lab3d.flying)))
    fail(step, "no intro flight on the first landing visit");
  await settle(page);

  step = "chain picking";
  const chain = await (await fetch(`${BASE}/api/lab/chain`)).json();
  const entry = chain.entries.find((e) => e.runId === multi);
  const pt = entry && (await page.evaluate((id) => window.__lab3d.project({ id }), entry.id));
  if (!pt) fail(step, "the multi run's lab-run entry is not on the chain");
  else {
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(150);
    const tip = await page
      .locator(".tip:not([hidden]) b")
      .innerText()
      .catch(() => "");
    if (!tip.startsWith(`#${entry.id} `)) fail(step, `tooltip "${tip}" for entry #${entry.id}`);
    else {
      await page.mouse.click(pt.x, pt.y);
      await page
        .waitForURL(new RegExp(`/runs/${multi}/results$`), { timeout: 5000 })
        .catch(() => fail(step, "clicking the lab-run slab did not open its run"));
      report.chainPicking = { tooltip: tip, opened: page.url().replace(BASE, "") };
    }
  }

  step = "evidence verify";
  await page.goto(`${BASE}/lab/runs/${multi}/evidence`, { waitUntil: "networkidle" });
  await worldOn(page).catch(() => fail(step, "chain stage never attached"));
  await page.getByRole("button", { name: "Verify chain now" }).click();
  await page
    .getByText(/Verified now: \d+ entries/)
    .waitFor({ timeout: 10000 })
    .catch(() => fail(step, "no verify result"));

  if (health.testDelayMs > 0) {
    step = "cancel";
    await page.goto(`${BASE}/lab/input`, { waitUntil: "networkidle" });
    await addSamples(page);
    await page.getByRole("button", { name: /Run scan/ }).click();
    await page.waitForURL(/\/lab\/runs\/[a-f0-9]{16}$/);
    const cid = page.url().match(/runs\/([a-f0-9]{16})/)[1];
    await page.getByRole("button", { name: /Cancel run/ }).click();
    await page
      .getByText(/· cancelled/)
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => fail(step, "run view never showed cancelled"));
    const r = await (await fetch(`${BASE}/api/lab/runs/${cid}/result`)).json();
    if (r.status !== "cancelled" || r.ledger !== null)
      fail(step, `result ${r.status}, ledger ${JSON.stringify(r.ledger)}`);
    report.cancel = {
      runId: cid,
      status: r.status,
      filesScanned: r.files.length,
      of: r.inputs.length,
    };
    await page.goto(`${BASE}/lab/runs/${cid}/results`, { waitUntil: "networkidle" });
    await page
      .getByText(/This run was cancelled/)
      .waitFor({ timeout: 5000 })
      .catch(() => fail(step, "results did not say cancelled"));
  } else report.cancel = "skipped: server started without LAB_TEST_DELAY_MS";
  await ctx.close();
}
{
  // live map in 2D: every "waiting" column resolves from the run's own events
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  const step = "live map 2D";
  watch(page, () => step);
  await page.goto(`${BASE}/lab/input?no3d`, { waitUntil: "networkidle" });
  await addSamples(page);
  await page.getByRole("button", { name: /Run scan/ }).click();
  await page.waitForURL(/\/lab\/runs\/[a-f0-9]{16}$/);
  await page.getByRole("link", { name: /Open results/ }).waitFor({ timeout: 30000 });
  const texts = await page.locator(".fallback2d svg text").allTextContents(); // SVG text has no innerText
  if (texts.some((t) => t.startsWith("waiting")))
    fail(step, "a column still says waiting after the run");
  if (texts.filter((t) => / \/ 100 · /.test(t)).length !== 3)
    fail(step, `scores on the map: ${texts.join(" | ")}`);
  if ((await page.locator(".fallback2d svg a").count()) === 0)
    fail(step, "bars did not become links when done");
  await ctx.close();
}
{
  // frame stats at DPR 2 (Retina-class backing store)
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const step = "3d dpr2";
  watch(page, () => step);
  await page.goto(`${BASE}/lab/runs/${multi}/results`, { waitUntil: "networkidle" });
  await worldOn(page).catch(() => fail(step, "3D stage never attached"));
  await page.locator("[data-stage]").scrollIntoViewIfNeeded();
  await settle(page);
  await page.evaluate(() => window.__lab3d.resetStats());
  await page.waitForTimeout(4000);
  report.framesDpr2 = await page.evaluate(() => window.__lab3d.stats());
  if (report.framesDpr2.dpr !== 2) fail(step, `renderer DPR ${report.framesDpr2.dpr}, expected 2`);
  await ctx.close();
}

// ---------- 2c. stage-5 interaction: palette, shortcuts, theme, sound, printable report ----------
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  let step = "palette";
  watch(page, () => step);
  await page.goto(`${BASE}/lab/runs/${multi}/results`, { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  const dlg = page.getByRole("dialog", { name: "Command palette" });
  await dlg.waitFor({ timeout: 3000 }).catch(() => fail(step, "Ctrl+K did not open the palette"));
  if (!(await page.evaluate(() => document.activeElement?.classList.contains("palette-input"))))
    fail(step, "focus is not in the palette input");
  await page.keyboard.type("evidence");
  const first = await page
    .locator('.palette-list li[aria-selected="true"] .palette-title')
    .innerText();
  if (first !== "Evidence and export") fail(step, `top match for "evidence" is "${first}"`);
  await page.keyboard.press("Escape");
  await dlg
    .waitFor({ state: "detached", timeout: 2000 })
    .catch(() => fail(step, "Esc did not close the palette"));
  if (!page.url().endsWith("/results")) fail(step, "Esc navigated");
  await page.click("#palette-btn");
  await page.keyboard.type("new scan");
  await page.keyboard.press("Enter");
  await page
    .waitForURL(/\/lab\/input/, { timeout: 5000 })
    .catch(() => fail(step, "Enter did not run the command"));

  step = "shortcuts";
  await page.locator("main h1").first().waitFor();
  await page.focus("main");
  await page.keyboard.press("?");
  const sc = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await sc.waitFor({ timeout: 3000 }).catch(() => fail(step, "? did not open the shortcut list"));
  await page.keyboard.press("Escape");
  await sc
    .waitFor({ state: "detached", timeout: 2000 })
    .catch(() => fail(step, "Esc did not close it"));
  if ((await page.evaluate(() => document.activeElement?.tagName)) === "BODY")
    fail(step, "focus lost after closing");

  step = "theme and sound";
  await page.click("#theme-btn");
  await page.click("#sound-btn");
  await page.reload({ waitUntil: "networkidle" });
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== "light")
    fail(step, "light theme not kept after reload");
  if ((await page.getAttribute("#sound-btn", "aria-pressed")) !== "true")
    fail(step, "sound setting not kept after reload");
  await worldOn(page).catch(() => fail(step, "3D stage missing in the light theme"));
  await page.click("#theme-btn");
  await page.click("#sound-btn");
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== undefined)
    fail(step, "dark theme not restored");

  step = "printable report";
  const res = await page.request.get(`${BASE}/api/lab/runs/${multi}/export?format=report&inline=1`);
  if (
    res.status() !== 200 ||
    !/default-src 'none'/.test(res.headers()["content-security-policy"] || "")
  )
    fail(step, `HTTP ${res.status()}, CSP ${res.headers()["content-security-policy"]}`);
  const rp = await ctx.newPage();
  const msgs = [];
  rp.on("console", (m) => msgs.push(m.text()));
  rp.on("pageerror", (e) => msgs.push(e.message));
  await rp.goto(`${BASE}/api/lab/runs/${multi}/export?format=report&inline=1`);
  const result = await (await fetch(`${BASE}/api/lab/runs/${multi}/result`)).json();
  const body = await rp.content();
  if (!body.includes(result.resultSha256) || !body.includes(result.inputSha256))
    fail(step, "report lacks the run's hashes");
  if (msgs.length) fail(step, `report console: ${msgs.join(" | ")}`);
  await rp.screenshot({ path: join(OUT, "report-desktop.png"), fullPage: true });
  report.printableReport = { bytes: body.length, consoleMessages: msgs.length };
  await ctx.close();
}
{
  // light theme: every route once at desktop size, 3D on, zero errors, stage attached where there is one
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("qlab.theme", "light");
    } catch {}
  });
  const page = await ctx.newPage();
  let where = "";
  watch(page, () => where);
  for (const [name, path] of [
    ["landing", "/lab"],
    ["input", "/lab/input"],
    ["results", `/lab/runs/${multi}/results`],
    ["finding", `/lab/runs/${multi}/findings/0/0`],
    ["evidence", `/lab/runs/${multi}/evidence`],
  ]) {
    where = `light ${name}`;
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== "light")
      fail(where, "not light");
    await worldOn(page).catch(() => fail(where, "3D stage never attached"));
    await settle(page);
    await page.locator("[data-stage]").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(OUT, `${name}-desktop-light.png`) });
  }
  await ctx.close();
}

// ---------- 3. fallbacks ----------
for (const [name, opts, q] of [
  ["no3d", {}, "?no3d"],
  ["reduced motion", { reducedMotion: "reduce" }, ""],
]) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, ...opts });
  const page = await ctx.newPage();
  const step = `fallback ${name}`;
  watch(page, () => step);
  await page.goto(`${BASE}/lab/runs/${multi}/results${q}`, { waitUntil: "networkidle" });
  if ((await page.evaluate(() => document.documentElement.dataset.world)) !== "off")
    fail(step, "3D not off");
  if (await page.locator("canvas.world").count()) fail(step, "a WebGL canvas was created");
  const links = await page.locator(".fallback2d svg a").count();
  const total = (await (await fetch(`${BASE}/api/lab/runs/${multi}/scene`)).json()).files.reduce(
    (a, f) => a + f.findings.length,
    0,
  );
  if (links !== total) fail(step, `${links} map links for ${total} findings`);
  await page.locator(".fallback2d svg a").first().click();
  await page
    .waitForURL(/\/findings\/\d+\/\d+$/, { timeout: 5000 })
    .catch(() => fail(step, "map link did not open the finding"));
  await ctx.close();
}

// ---------- 4. matrix ----------
const routes = [
  ["landing", "/lab"],
  ["input", "/lab/input"],
  ["run", `/lab/runs/${runId}`],
  ["results", `/lab/runs/${multi}/results`],
  ["finding", `/lab/runs/${multi}/findings/0/0`],
  ["evidence", `/lab/runs/${runId}/evidence`],
  ["host-results", `/lab/runs/${hostRunId}/results`],
  ["not-found", "/lab/nope"],
];
const fcp = {};
let checked = 0;
for (const [vp, size] of Object.entries(VIEWPORTS)) {
  for (const mode of ["3d", "no3d"]) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    let where = "";
    watch(page, () => where);
    for (const [name, path] of routes) {
      where = `${vp}/${mode} ${name}`;
      await page.goto(`${BASE}${path}${mode === "no3d" ? "?no3d" : ""}`, {
        waitUntil: "networkidle",
      });
      await page
        .locator("main h1")
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => fail(where, "no h1 rendered"));
      if (name === "landing" && !fcp[vp])
        fcp[vp] = await page.evaluate(
          () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
        );
      const hasStage = await page.locator("[data-stage]").count();
      if (hasStage && mode === "3d") {
        await worldOn(page).catch(() => fail(where, "3D stage never attached"));
        await settle(page);
        const calls = await page.evaluate(() => window.__lab3d.stats().drawCalls);
        if (calls > 60) fail(where, `${calls} draw calls`);
      }
      if (hasStage && mode === "no3d" && !(await page.locator(".fallback2d svg").isVisible()))
        fail(where, "2D map not visible");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) fail(where, `horizontal scroll ${over}px`);
      await page.screenshot({ path: join(OUT, `${name}-${vp}-${mode}.png`), fullPage: true });
      if (hasStage && mode === "3d") {
        // the world canvas is fixed to the viewport, so a full-page capture cannot show a stage below the
        // first screen; this viewport shot shows the stage as a person scrolled to it sees it
        await page.locator("[data-stage]").first().scrollIntoViewIfNeeded();
        await settle(page);
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(OUT, `${name}-${vp}-3d-stage.png`) });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.keyboard.press("Tab");
      const first = await page.evaluate(() => document.activeElement?.className);
      if (first !== "skip") fail(where, `first Tab focuses .${first}, not the skip link`);
      checked++;
    }
    await ctx.close();
  }
}
await browser.close();

console.log(
  JSON.stringify(
    {
      base: BASE,
      runId,
      multiRunId: multi,
      hostRunId,
      pagesChecked: checked,
      screenshots: OUT,
      fcpMs: fcp,
      ...report,
      seconds: (Date.now() - t0) / 1000,
      problems: problems.length,
    },
    null,
    1,
  ),
);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("route_check: OK");
