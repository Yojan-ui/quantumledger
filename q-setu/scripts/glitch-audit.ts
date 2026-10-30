/**
 * `pnpm audit:glitch [before|after]`: opens every page and demo at 1440×900 and at 390×844 (with 4×
 * CPU throttling for the phone run) against a production server at BASE, scrolls through, clicks
 * the page's main action, and records:
 *   - console errors and warnings (React hydration and WebGL included) and uncaught page errors
 *   - webglcontextlost events
 *   - long tasks over 50 ms
 *   - frame times while scrolling and during demo transitions (worst, p95, frames over 50 ms)
 *   - Cumulative Layout Shift, with the elements that shifted
 *   - failed network requests (errors and HTTP ≥ 400)
 *   - a 10-second video of the scroll and clicks (docs/smooth/videos-<label>/, not committed)
 * and writes docs/smooth/audit-<label>.md (ranked) and audit-<label>.json.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chromium, devices, type BrowserContext, type Page } from "@playwright/test";

const label = process.argv[2] ?? "before";
const BASE = process.env.BASE ?? "http://localhost:3000";
const ONLY = process.env.ONLY?.split(",");
const root = new URL("../docs/smooth/", import.meta.url).pathname;
const videos = `${root}videos-${label}/`;
mkdirSync(videos, { recursive: true });

/** What each page's "main action" is during the run (clicked if present). */
const ACTIONS: Record<string, string[]> = {
  "/": [],
  "/diagnostics": [],
  "/demo/how-it-works": ["Play"],
  "/demo/deploy": ["Play"],
  "/demo/qday": ["Try it"],
  "/demo/ledger": ["Verify the chain", "Tamper with entry #42", "Verify the chain"],
  "/demo/scanner": ["Scan", "Scan live TLS"],
  "/atlas/demo/ledger": ["#3"],
};

interface Metrics {
  console: { type: string; text: string }[];
  pageErrors: string[];
  hydration: string[];
  webgl: string[];
  contextLost: number;
  longTasks: number[];
  scroll: FrameStats;
  transition: FrameStats;
  cls: number;
  shifts: { value: number; nodes: string[] }[];
  failed: { url: string; why: string }[];
}
interface FrameStats {
  frames: number;
  worst: number;
  p95: number;
  over50: number;
  fps: number;
}

/**
 * Installed before any page script: the probes the page reports back from. A plain JS string: tsx
 * would otherwise wrap named functions in a helper that doesn't exist in the page.
 */
const PROBES = `(() => {
  var longTasks = [], shifts = [], frames = [], cls = 0, lost = 0;
  window.__audit = { longTasks: longTasks, shifts: shifts, frames: frames, phase: "load",
    cls: function () { return cls; }, lost: function () { return lost; } };
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) { longTasks.push(Math.round(e.duration)); });
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) {
        if (e.hadRecentInput) return;
        cls += e.value;
        var nodes = (e.sources || []).map(function (s) {
          var n = s.node;
          if (!n || !(n instanceof Element)) return "(text)";
          var id = n.id ? "#" + n.id : "";
          var c = typeof n.className === "string" ? "." + n.className.split(" ").slice(0, 3).join(".") : "";
          return (n.tagName.toLowerCase() + id + c).slice(0, 120);
        });
        if (e.value > 0.001) shifts.push({ value: Number(e.value.toFixed(4)), nodes: nodes });
      });
    }).observe({ type: "layout-shift", buffered: true });
  } catch (err) {}
  // Context loss is dispatched on the canvas and doesn't bubble: listen in the capture phase.
  window.addEventListener("webglcontextlost", function () { lost++; }, true);
  var last = performance.now();
  var tick = function (now) {
    frames.push([window.__audit.phase, now - last]);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

function stats(list: number[]): FrameStats {
  if (!list.length) return { frames: 0, worst: 0, p95: 0, over50: 0, fps: 0 };
  const sorted = [...list].sort((a, b) => a - b);
  const total = list.reduce((a, b) => a + b, 0);
  return {
    frames: list.length,
    worst: Math.round(sorted.at(-1)!),
    p95: Number(sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1)),
    over50: list.filter((x) => x > 50).length,
    fps: Math.round((list.length / total) * 1000),
  };
}

const setPhase = (page: Page, phase: string) =>
  page.evaluate(
    (p) => ((window as unknown as { __audit: { phase: string } }).__audit.phase = p),
    phase,
  );

async function scrollThrough(page: Page, ms: number) {
  await setPhase(page, "scroll");
  const h = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = Math.max(1, Math.round(ms / 120));
  for (let i = 1; i <= steps; i++) {
    await page.mouse.wheel(0, Math.max(60, h / steps));
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
}

async function act(page: Page, path: string) {
  await setPhase(page, "transition");
  const names = ACTIONS[path] ?? [];
  if (path === "/diagnostics") {
    await page.waitForTimeout(6000); // autoplay transitions
    return;
  }
  for (const n of names) {
    const b = page.getByRole("button", { name: n, exact: true }).first();
    if (await b.count()) {
      await b.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }
  if (!names.length) {
    // Hover across the page's main area (cards tilt, buttons pull) and click nothing destructive.
    for (let x = 200; x <= 1200; x += 250) {
      await page.mouse.move(x, 420, { steps: 4 });
      await page.waitForTimeout(80);
    }
  }
}

async function audit(ctx: BrowserContext, path: string, throttle: boolean, tag: string) {
  const page = await ctx.newPage();
  const m: Metrics = {
    console: [],
    pageErrors: [],
    hydration: [],
    webgl: [],
    contextLost: 0,
    longTasks: [],
    scroll: stats([]),
    transition: stats([]),
    cls: 0,
    shifts: [],
    failed: [],
  };
  page.on("console", (msg) => {
    const t = msg.type();
    if (t !== "error" && t !== "warning") return;
    const text = msg.text().slice(0, 400);
    if (/hydrat/i.test(text)) m.hydration.push(text);
    else if (/webgl|GL Driver|GL_|THREE\.WebGL/i.test(text)) m.webgl.push(text);
    else m.console.push({ type: t, text });
  });
  page.on("pageerror", (e) => m.pageErrors.push(String(e).slice(0, 400)));
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "failed";
    // An EventSource closed by navigation is not a failure.
    if (/ERR_ABORTED/.test(why) && /\/api\/(stream|room\/stream)/.test(r.url())) return;
    // Chrome aborts a video's first request once it switches to range requests, and on pause.
    if (/ERR_ABORTED/.test(why) && /\.(webm|mp4)(\?|$)/.test(r.url())) return;
    m.failed.push({ url: r.url().replace(BASE, ""), why });
  });
  page.on("response", (r) => {
    if (r.status() >= 400)
      m.failed.push({ url: r.url().replace(BASE, ""), why: `HTTP ${r.status()}` });
  });
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60_000 }).catch((e) => {
    m.pageErrors.push(`navigation: ${(e as Error).message.split("\n")[0]}`);
  });
  await page.waitForTimeout(1500);
  await scrollThrough(page, 3500);
  await act(page, path);
  const left = 10_000 - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(Math.min(left, 3000));
  const a = await page.evaluate(() => {
    const x = (
      window as unknown as {
        __audit: {
          longTasks: number[];
          shifts: { value: number; nodes: string[] }[];
          frames: [string, number][];
          cls: () => number;
          lost: () => number;
        };
      }
    ).__audit;
    return {
      longTasks: x.longTasks,
      shifts: x.shifts,
      frames: x.frames,
      cls: x.cls(),
      lost: x.lost(),
    };
  });
  m.longTasks = a.longTasks.filter((d) => d > 50);
  m.shifts = a.shifts.sort((p, q) => q.value - p.value).slice(0, 5);
  m.cls = Number(a.cls.toFixed(4));
  m.contextLost = a.lost;
  m.scroll = stats(a.frames.filter(([p]) => p === "scroll").map(([, d]) => d));
  m.transition = stats(a.frames.filter(([p]) => p === "transition").map(([, d]) => d));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    m.pageErrors.push("Horizontal page overflow");
  const shotDir = `${root}screenshots-${label}`;
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({
    path: `${shotDir}/${path === "/" ? "home" : path.slice(1).replace(/[^a-z0-9]/gi, "-")}-${tag}.png`,
    fullPage: true,
  });
  const video = page.video();
  await page.close();
  if (video) {
    const name = (path === "/" ? "home" : path.slice(1).replace(/[/.]/g, "_")) + `-${tag}.webm`;
    renameSync(await video.path(), `${videos}${name}`);
  }
  return m;
}

/** A severity score: errors and context loss dominate, then hitches and layout shift. */
function score(m: Metrics): number {
  return (
    m.pageErrors.length * 40 +
    m.contextLost * 40 +
    m.hydration.length * 25 +
    m.console.filter((c) => c.type === "error").length * 15 +
    m.failed.length * 10 +
    m.console.filter((c) => c.type === "warning").length * 3 +
    m.webgl.length * 2 +
    Math.max(0, m.transition.worst - 50) / 5 +
    Math.max(0, m.scroll.worst - 50) / 5 +
    m.longTasks.length * 1 +
    Math.max(0, m.cls - 0.05) * 200
  );
}

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const pages = [
  ...new Set([
    ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => new URL(x[1]!).pathname),
    "/diagnostics",
    "/join",
    "/pitch",
    "/scan/www.npci.org.in",
    "/this-page-does-not-exist",
    // Q-Shield (Atlas) pages: need `pnpm dev:atlas` on :8100; the demo workspace is public.
    "/atlas/signin",
    "/atlas/demo",
    "/atlas/demo/tiebreak",
    "/atlas/demo/ledger?section=2",
    "/atlas/demo/ledger?section=6",
    "/atlas/demo/detect",
    "/atlas/demo/inventory",
    "/atlas/demo/schedule",
    "/atlas/demo/handshakes",
    "/atlas/demo/qaoa",
    "/atlas/demo/ledger",
    "/atlas/demo/review",
    "/diagnostics?ws=demo",
  ]),
].filter((p) => !ONLY || ONLY.includes(p));

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
});
const results: { path: string; tag: string; m: Metrics; score: number }[] = [];
for (const [tag, opts, throttle] of [
  ["1440", { viewport: { width: 1440, height: 900 } }, false],
  ["390", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } }, true],
] as const) {
  for (const path of pages) {
    const dir = `${videos}.rec`;
    const ctx = await browser.newContext({
      ...opts,
      recordVideo: { dir, size: opts.viewport },
    });
    await ctx.addInitScript({ content: PROBES });
    const m = await audit(ctx, path, throttle, tag);
    await ctx.close();
    rmSync(dir, { recursive: true, force: true });
    const s = score(m);
    results.push({ path, tag, m, score: s });
    console.log(
      `${tag.padEnd(5)} ${path.padEnd(40)} score ${s.toFixed(0).padStart(4)}  err ${m.console.filter((c) => c.type === "error").length + m.pageErrors.length}  hyd ${m.hydration.length}  lost ${m.contextLost}  lt ${m.longTasks.length}  scroll ${m.scroll.worst}ms  trans ${m.transition.worst}ms  cls ${m.cls}  fail ${m.failed.length}`,
    );
  }
}
await browser.close();

writeFileSync(`${root}audit-${label}.json`, JSON.stringify(results, null, 2) + "\n");

const ranked = [...results].sort((a, b) => b.score - a.score);
const lines: string[] = [
  `# Glitch audit (${label})`,
  "",
  `\`pnpm audit:glitch ${label}\` against the production build at ${BASE}, ${new Date().toISOString().slice(0, 16)} UTC.`,
  "Every page at 1440×900, and at 390×844 with 4× CPU throttling. Each run: load, scroll to the end, the",
  "page's main action (Play, Verify, Tamper, Scan… or hover across it), 10 s in all. Videos are in",
  `\`docs/smooth/videos-${label}/\` (not committed).`,
  "",
  "## Totals",
  "",
  "| | 1440 | 390 (4× CPU) |",
  "| --- | --- | --- |",
];
const tot = (tag: string, f: (m: Metrics) => number) =>
  results.filter((r) => r.tag === tag).reduce((n, r) => n + f(r.m), 0);
const worst = (tag: string, f: (m: Metrics) => number) =>
  Math.max(0, ...results.filter((r) => r.tag === tag).map((r) => f(r.m)));
for (const [name, f, agg] of [
  [
    "Console errors + page errors",
    (m: Metrics) => m.console.filter((c) => c.type === "error").length + m.pageErrors.length,
    tot,
  ],
  ["Console warnings", (m: Metrics) => m.console.filter((c) => c.type === "warning").length, tot],
  ["Hydration warnings", (m: Metrics) => m.hydration.length, tot],
  ["WebGL driver messages", (m: Metrics) => m.webgl.length, tot],
  ["WebGL contexts lost", (m: Metrics) => m.contextLost, tot],
  ["Long tasks > 50 ms", (m: Metrics) => m.longTasks.length, tot],
  ["Worst frame while scrolling (ms)", (m: Metrics) => m.scroll.worst, worst],
  ["Worst frame in a transition (ms)", (m: Metrics) => m.transition.worst, worst],
  ["Worst page CLS", (m: Metrics) => m.cls, worst],
  ["Failed requests", (m: Metrics) => m.failed.length, tot],
] as const)
  lines.push(`| ${name} | ${agg("1440", f)} | ${agg("390", f)} |`);
lines.push("", "## Ranked (worst first)", "");
lines.push(
  "| # | Page | Width | Score | Errors | Hydration | Lost | Long tasks | Scroll worst / p95 (ms) | Transition worst / p95 (ms) | CLS | Failed |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
);
ranked.forEach((r, i) =>
  lines.push(
    `| ${i + 1} | \`${r.path}\` | ${r.tag} | ${r.score.toFixed(0)} | ${r.m.console.filter((c) => c.type === "error").length + r.m.pageErrors.length} | ${r.m.hydration.length} | ${r.m.contextLost} | ${r.m.longTasks.length}${r.m.longTasks.length ? ` (max ${Math.max(...r.m.longTasks)})` : ""} | ${r.m.scroll.worst} / ${r.m.scroll.p95} | ${r.m.transition.worst} / ${r.m.transition.p95} | ${r.m.cls} | ${r.m.failed.length} |`,
  ),
);
lines.push("", "## Details", "");
for (const r of ranked.filter((x) => x.score >= 1)) {
  lines.push(`### \`${r.path}\` at ${r.tag} (score ${r.score.toFixed(0)})`, "");
  for (const e of r.m.pageErrors) lines.push(`- page error: ${e}`);
  for (const c of r.m.console) lines.push(`- console ${c.type}: ${c.text.replace(/\n/g, " ")}`);
  for (const h of [...new Set(r.m.hydration)])
    lines.push(`- hydration: ${h.replace(/\n/g, " ").slice(0, 200)}`);
  const gl = [...new Set(r.m.webgl)];
  if (gl.length)
    lines.push(`- WebGL (${r.m.webgl.length}): ${gl.slice(0, 2).join(" | ").slice(0, 240)}`);
  if (r.m.contextLost) lines.push(`- WebGL context lost ×${r.m.contextLost}`);
  if (r.m.longTasks.length) lines.push(`- long tasks: ${r.m.longTasks.join(", ")} ms`);
  for (const s of r.m.shifts)
    lines.push(`- layout shift ${s.value}: ${s.nodes.join(", ") || "(unknown)"}`);
  for (const f of r.m.failed) lines.push(`- failed: ${f.url} (${f.why})`);
  lines.push("");
}
writeFileSync(`${root}audit-${label}.md`, lines.join("\n") + "\n");
console.log(`wrote docs/smooth/audit-${label}.md`);
