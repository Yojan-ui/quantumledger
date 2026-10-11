import { expect, test } from "@playwright/test";

// Run with `pnpm test:e2e:offline`: the server has no outbound network (QSETU_OFFLINE=1).
test("@offline the scan falls back to labelled cached results", async ({ page }) => {
  await page.goto("/#scan");
  await page.getByRole("button", { name: "onlinesbi.sbi" }).click();
  await expect(page.getByText(/Cached scan from .* · offline/)).toBeVisible();
  await expect(page.getByText("Harvestable today")).toBeVisible();
});

test("@offline uncached sites fail with a clear message and a retry", async ({ page }) => {
  await page.goto("/#scan");
  await page.getByLabel("Enter any website").fill("example.org");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByText(/Offline mode: no cached scan/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("@offline crypto still runs: Demo 1 handshake and Q-Day in the browser", async ({ page }) => {
  await page.goto("/demo/how-it-works");
  await page.getByRole("button", { name: /Play/ }).click();
  await expect(page.getByText(/messages over AES-256-GCM/)).toBeVisible();
  await page.goto("/demo/qday");
  await page.getByRole("button", { name: /Go to Q-Day/ }).click();
  await expect(page.getByText(/Factored n in \d+ steps/)).toBeVisible();
});

test("@offline the live strip and ledger keep working", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Live operations").locator("p").first()).toContainText(
    /SEAL|VERIFY|LEDGER|HANDSHAKE|KEYGEN/,
  );
  await page.goto("/demo/ledger");
  await page.getByRole("button", { name: "Verify the chain" }).click();
  await expect(page.getByText("Chain intact")).toBeVisible();
});
