import { expect, test } from "@playwright/test";

// The judge tour: one click starts it; → skips through all eight steps across the demo pages.
test("judge tour drives the site and → skips ahead", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Take the 3-minute tour" }).click();
  const bar = page.locator("[data-tour-bar]");
  await expect(bar).toHaveAttribute("data-tour-step", "hero");
  await expect(page.locator("[data-tour-caption]")).toContainText("quantum-safe");
  const order = ["phone", "index", "qday", "deploy", "ledger", "impact", "cta"];
  for (const id of order) {
    await page.keyboard.press("ArrowRight");
    await expect(bar).toHaveAttribute("data-tour-step", id);
    if (id === "qday") await expect(page).toHaveURL(/\/demo\/qday/);
    if (id === "ledger") await expect(page).toHaveURL(/\/demo\/ledger/);
  }
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
});

test("?tour=1 starts the tour", async ({ page }) => {
  await page.goto("/?tour=1");
  await expect(page.locator("[data-tour-bar]")).toHaveAttribute("data-tour-step", "hero");
  await page.keyboard.press("Escape");
});
