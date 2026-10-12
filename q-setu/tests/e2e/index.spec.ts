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
