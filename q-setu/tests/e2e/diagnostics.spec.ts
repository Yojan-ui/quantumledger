import { expect, test } from "@playwright/test";

// The diagnostics pipeline: autoplay runs the five stages on real results (the cached example),
// the sweep verifies, a tamper is caught at the anchored block, and R resets.
test("diagnostics: five real stages, verified, then tamper is caught", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/diagnostics");
  const status = (id: string) => page.locator(`[data-stage="${id}"]`).first();
  await expect(status("detect")).toHaveAttribute("data-status", "done", { timeout: 60_000 });
  await expect(page.locator('[data-diag="TARGET"]').first()).toHaveText("ecc256.badssl.com");
  await expect(status("rescan")).toHaveAttribute("data-status", "done", { timeout: 90_000 });
  await expect(page.locator("[data-threat]")).toHaveAttribute("data-threat", "secured");
  await expect(page.locator('[data-diag="MERKLE_ROOT"]').first()).toHaveText(/^[0-9a-f]{16}…$/);
  await expect(page.locator('[data-diag="KEX_GROUP"]').first()).toContainText("(sim)");
  await page.getByRole("button", { name: "Try tamper" }).click();
  await page.locator('[data-stage="rescan"] button').first().click();
  await expect(status("rescan")).toHaveAttribute("data-status", "failed", { timeout: 30_000 });
  await expect(page.getByRole("alert").first()).toContainText("SHA3-256 no longer matches");
  await page.keyboard.press("r");
  await expect(status("detect")).toHaveAttribute("data-status", "idle");
});

test("diagnostics: L5 switches the live policy to ML-KEM-1024 / ML-DSA-87", async ({
  page,
  request,
}) => {
  await page.goto("/diagnostics");
  await page.getByRole("radio", { name: /L5/ }).click();
  await expect
    .poll(async () => (await (await request.get("/api/policy")).json()).profile)
    .toBe("maximum");
  await page.getByRole("radio", { name: /L3/ }).click();
  await expect
    .poll(async () => (await (await request.get("/api/policy")).json()).profile)
    .toBe("standard");
});
