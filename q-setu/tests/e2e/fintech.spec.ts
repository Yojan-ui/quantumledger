import { expect, test } from "@playwright/test";

test("home leads to the bank pipeline and disclosures start closed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore the pipeline", exact: true }).click();
  await expect(page).toHaveURL(/\/atlas\/demo$/);
  const about = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "About this pipeline" }) })
    .first();
  await expect(about).not.toHaveAttribute("open", "");
  await about.locator("summary").click();
  await expect(about).toContainText("fictional-bank demo");
  await expect(about).toContainText("not a regulatory deadline");
  await expect(
    page.getByRole("navigation", { name: "Pipeline steps" }).getByRole("link"),
  ).toHaveCount(10);
});

test("removed sectors return 404 and are absent from the sitemap", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const sector of ["healthcare", "education", "government"]) {
    expect((await request.get(`/solutions/${sector}`)).status()).toBe(404);
    expect(sitemap).not.toContain(`/solutions/${sector}`);
  }
});

test("GitHub input rejects credentials without sending them", async ({ page }) => {
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("atlas-api")) writes++;
  });
  await page.goto("/atlas/demo");
  await page
    .getByRole("textbox", { name: "Public GitHub repository URL" })
    .fill("https://token@github.com/owner/repo");
  await page.getByRole("button", { name: "Clone and run" }).click();
  await expect(page.locator("#github").getByRole("alert")).toContainText("without credentials");
  expect(writes).toBe(0);
});

// Error fixtures are test-only; the shipped UI always calls Atlas through the proxy.
test("GitHub private repo and Atlas outage are actionable", async ({ page }) => {
  await page.route("**/atlas-api/me", (r) =>
    r.fulfill({
      json: { user: { username: "test", role: "operator" }, kiosk: false, demo: false },
    }),
  );
  await page.route("**/atlas-api/workspaces", (r) =>
    r.fulfill({ status: 201, json: { id: "test" } }),
  );
  await page.route("**/atlas-api/workspaces/*/clone", (r) =>
    r.fulfill({ status: 502, json: { error: { code: "clone_failed", message: "private" } } }),
  );
  await page.goto("/atlas/demo");
  await page
    .getByRole("textbox", { name: "Public GitHub repository URL" })
    .fill("https://github.com/owner/private");
  await page.getByRole("button", { name: "Clone and run" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Private repositories" })).toBeVisible();
  await page.route("**/atlas-api/workspaces", (r) =>
    r.fulfill({ status: 503, json: { error: { code: "atlas_down", message: "down" } } }),
  );
  await page.getByRole("button", { name: "Clone and run" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Atlas is unavailable" })).toBeVisible();
});
