#!/usr/bin/env node
/**
 * Lab route check against a running server (no mocks: every screen reads the real /api/lab backend).
 *   node tools/route_check.mjs [--base http://127.0.0.1:3000] [--out screenshots/lab/stageN]
 * 1. End-to-end through the UI: sample scan -> run -> results -> finding (J) -> evidence; a cached
 *    host scan; a rejected input showing its field error.
 * 2. Every route x 3 viewports x (default, ?no3d): no console errors, no page errors, no failed or
 *    4xx/5xx requests, an h1, no horizontal scroll, skip link first in tab order; full-page screenshot.
 * 3. FCP of /lab per viewport (performance paint timing).
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
mkdirSync(OUT, { recursive: true });
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 844 },
};
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

function watch(page, where) {
  page.on("console", (m) => {
    if (m.type() === "error" && !(page._expect4xx && /status of 4\d\d/.test(m.text())))
      fail(where(), `console error: ${m.text()}`);
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

const browser = await chromium.launch();
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

  // cached real host scan (offline-safe)
  step = "e2e host";
  await page.goto(`${BASE}/lab/input`);
  await page.fill("#url", "ecc256.badssl.com");
  await page.getByText(/cached real scan only/).waitFor();
  await page.getByRole("button", { name: /Run scan/ }).click();
  await page.waitForURL(/\/lab\/runs\/[a-f0-9]{16}$/);
  hostRunId = page.url().match(/runs\/([a-f0-9]{16})/)[1];
  await page.getByRole("link", { name: /Open results/ }).waitFor({ timeout: 30000 });

  // rejected input: the server's field error renders on the field
  step = "e2e invalid";
  page._expect4xx = true;
  await page.goto(`${BASE}/lab/input`);
  await page.locator("aside .list li").first().getByRole("button", { name: "Add" }).click();
  await page.fill("#lifetime", "500");
  await page
    .locator(".field[data-invalid] .field-error")
    .waitFor()
    .catch(() => fail(step, "no field error for lifetime 500"));
  page._expect4xx = false;
  await ctx.close();
}

// ---------- 2. matrix ----------
const routes = runId
  ? [
      ["landing", "/lab"],
      ["input", "/lab/input"],
      ["run", `/lab/runs/${runId}`],
      ["results", `/lab/runs/${runId}/results`],
      ["finding", `/lab/runs/${runId}/findings/0/0`],
      ["evidence", `/lab/runs/${runId}/evidence`],
      ["host-results", `/lab/runs/${hostRunId}/results`],
      ["not-found", "/lab/nope"],
    ]
  : [];
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
      const url = `${BASE}${path}${mode === "no3d" ? (path.includes("?") ? "&" : "?") + "no3d" : ""}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page
        .locator("main h1")
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => fail(where, "no h1 rendered"));
      if (name === "landing" && !fcp[vp])
        fcp[vp] = await page.evaluate(
          () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
        );
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) fail(where, `horizontal scroll ${over}px`);
      await page.screenshot({ path: join(OUT, `${name}-${vp}-${mode}.png`), fullPage: true });
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
      hostRunId,
      pagesChecked: checked,
      screenshots: OUT,
      fcpMs: fcp,
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
