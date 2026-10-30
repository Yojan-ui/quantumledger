/**
 * Q-Shield (Atlas) pages through the /atlas-api proxy. Needs Atlas on :8100 (`pnpm dev:atlas`); without it
 * the data tests skip and one test checks the atlas_down panel instead. Expected values are read from
 * Atlas's own API at test time, never hard-coded.
 */
import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

type Results = {
  assets: unknown[];
  detect: { findings: { file: string; line: number }[] } | null;
  exposure: { makespan_weeks: number };
  qaoa: { table: { status: string; status_text: string | null }[] } | null;
};

let atlasUp = false;
let demo: Results | null = null;
test.beforeAll(async ({ request }) => {
  const h = await request.get("/atlas-api/health");
  atlasUp = h.ok();
  if (atlasUp)
    demo = (
      (await (await request.get("/atlas-api/workspaces/demo/results")).json()) as {
        results: Results | null;
      }
    ).results;
});

test("proxy refuses a cross-origin write and keeps Atlas's error shape", async ({ request }) => {
  const r = await request.post("/atlas-api/auth/login", {
    headers: { origin: "https://evil.example" },
    data: {},
  });
  expect(r.status()).toBe(403);
  expect((await r.json()).error.code).toBe("bad_origin");
});

test("atlas_down: a clear panel, not a blank page", async ({ page }) => {
  test.skip(atlasUp, "Atlas is running; this checks the down state");
  await page.goto("/atlas/demo/detect");
  await expect(page.getByRole("alert")).toContainText("Q-Shield backend not running");
});

test.describe("with Atlas on :8100", () => {
  test.beforeEach(() =>
    test.skip(
      !atlasUp || !demo,
      "Atlas not running (pnpm dev:atlas) or the demo snapshot is not built",
    ),
  );

  test("/atlas lists the public demo when signed out", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/atlas");
    await expect(page.getByRole("link", { name: "Open the demo workspace" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Detect shows file:line evidence from results.json", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/atlas/demo/detect");
    await page
      .locator("summary")
      .filter({ hasText: /^Findings/ })
      .click();
    const f = demo!.detect!.findings[0]!;
    await expect(page.getByText(`${f.file}:${f.line}`).first()).toBeVisible();
    await expect(page.getByText(`${demo!.detect!.findings.length} findings`)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Plan compares MILP with FCFS and greedy, assumptions labelled", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/atlas/demo/schedule");
    await expect(page.getByText(`${demo!.exposure.makespan_weeks} weeks`).first()).toBeVisible();
    for (const p of [
      "QpiAI Opt MILP best",
      "First-come-first-served",
      "Greedy (highest risk first)",
    ])
      await expect(page.getByRole("cell", { name: p, exact: true })).toBeVisible();
    await expect(page.getByText("assumption", { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Wave selection renders every qaoa.table row; non-ok rows show status_text", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/atlas/demo/qaoa");
    const table = page.getByRole("table", { name: "QAOA rows by depth and backend" });
    await expect(table.locator("tbody tr")).toHaveCount(demo!.qaoa!.table.length);
    const notOk = demo!.qaoa!.table.find((r) => r.status !== "ok");
    if (notOk?.status_text) await expect(table.getByText(notOk.status_text).first()).toBeVisible();
    await expect(
      page.getByText("simulators; a cross-check, no quantum advantage", { exact: true }),
    ).toBeVisible(); // short label; the sentence is in its dropdown
    expect(errors).toEqual([]);
  });

  test("Proof Chain: entries, live verification, Merkle proof on click", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/atlas/demo/ledger");
    await expect(page.getByText(/verified live · \d+ entries/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "#1", exact: true }).click();
    await expect(page.getByRole("region", { name: "Merkle proof for entry 1" })).toContainText(
      "verified",
      { timeout: 20_000 },
    );
    expect(errors).toEqual([]);
  });

  test("Review asks a signed-out visitor to sign in (no 401 in the console)", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/atlas/demo/review");
    await expect(page.getByText("Sign in to see the items awaiting review.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("diagnostics ?ws=demo: Atlas's stages in the HUD; the domain HUD is unchanged without it", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/diagnostics?ws=demo");
    const stages = page.getByRole("list", { name: "Q-Shield pipeline stages" }).locator("li");
    const n = (
      (await (await page.request.get("/atlas-api/stages")).json()) as { stages: unknown[] }
    ).stages.length;
    await expect(stages).toHaveCount(n);
    // the pipeline view (3D, or its static SVG on phones / reduced motion) with its station labels
    await expect(page.getByRole("list", { name: "Stations" }).locator("li")).toHaveCount(n);
    await expect(page.getByRole("button", { name: /Run pipeline/ })).toBeDisabled(); // demo is read-only
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { level: 2, name: "Detect" })).toBeVisible();
    await page.goto("/diagnostics");
    await expect(page.getByRole("list", { name: "Q-Shield pipeline stages" })).toHaveCount(0);
    await expect(page.getByLabel("Enter any domain")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("phone width: no horizontal scroll on the Plan page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/atlas/demo/schedule");
    await expect(page.locator("summary").filter({ hasText: /^Wave plan/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});
