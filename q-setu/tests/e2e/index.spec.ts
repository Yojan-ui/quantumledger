import { expect, test } from "@playwright/test";

// The Readiness Index shows sector totals (never a site) with its scan date and method.
test("readiness index: sector totals, methodology, no site names", async ({ page }) => {
  await page.goto("/index");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-index-headline]")).toHaveText(/^\d+%$/);
  await expect(page.locator("[data-sector]")).toHaveCount(5);
  await page.getByRole("button", { name: "RSA-2048 certs" }).click();
  await expect(page.getByRole("button", { name: "RSA-2048 certs" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#method")).toContainText("Disclaimer");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/hdfcbank|icicibank|uidai|aiims|airtel/i);
});

// Simple / Technical: one toggle swaps every section's copy and is remembered.
test("simple / technical copy toggle persists", async ({ page }) => {
  await page.goto("/");
  const simple = page.locator("#analogy").getByText("Everything has a lock");
  const technical = page.locator("#analogy").getByText("Today: classical key exchange");
  await expect(simple).toBeVisible();
  await expect(technical).toBeHidden();
  await page.getByRole("button", { name: "technical" }).first().click();
  await expect(technical).toBeVisible();
  await expect(simple).toBeHidden();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-copy-mode", "technical");
  await page.locator('[data-term="ml-kem"]').first().hover();
  await expect(page.getByRole("tooltip").filter({ hasText: "FIPS 203" })).toBeVisible();
  await page.getByRole("button", { name: "simple" }).first().click();
});
