import { devices, expect, test } from "@playwright/test";

// Phone in the room: a phone seals a real message, the big screen counts it; a tampered packet is
// rejected on both screens. The room is local: it needs no network.
test("a phone seals a message and a tampered one is rejected", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.locator("[data-room-qr] svg")).toBeVisible();
  await expect(page.locator("[data-room-qr] a")).toContainText("/join");
  const before = Number(
    (await page.locator("[data-room-feed] .sr-only").first().textContent())?.replace(/\D/g, "") ||
      0,
  );

  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const phone = await ctx.newPage();
  const errors: string[] = [];
  phone.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await phone.goto("/join");
  await expect(phone.getByTestId("visitor-name")).toHaveText(/^Visitor \d+$/);
  await phone.getByRole("button", { name: "Seal & send" }).click();
  await expect(phone.locator('[data-state="verified"]')).toContainText("matches");
  await expect(page.locator("[data-room-feed] .sr-only").first()).toHaveText(String(before + 1));
  await expect(page.locator('[data-room-pop="sealed"]').first()).toContainText(/Sealed by Visitor/);

  await phone.waitForTimeout(1300);
  await phone.getByRole("button", { name: "Try to tamper" }).click();
  await expect(phone.locator('[data-state="rejected"]')).toContainText("invalid tag");
  await expect(page.locator('[data-room-pop="rejected"]').first()).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});
