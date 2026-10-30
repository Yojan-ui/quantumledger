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

test("live endpoint scan refuses internal hosts without calling Atlas", async ({ page }) => {
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("atlas-api")) writes++;
  });
  await page.goto("/atlas/demo");
  const scan = page.locator("#endpoint");
  await expect(scan.getByRole("heading", { name: "Scan a live endpoint" })).toBeVisible();
  await expect(scan).toContainText("Scan only hosts you own or are authorised to assess.");
  await scan.getByRole("textbox", { name: "Public hostnames" }).fill("localhost, 10.0.0.1");
  await scan.getByRole("button", { name: "Scan and run" }).click();
  await expect(scan.getByRole("alert")).toContainText("only public hosts");
  expect(writes).toBe(0);
});

// Error fixtures are test-only; the shipped UI always calls Atlas through the proxy.
test("live endpoint scan: Atlas refusal and outage are actionable", async ({ page }) => {
  await page.route("**/atlas-api/me", (r) =>
    r.fulfill({
      json: { user: { username: "test", role: "operator" }, kiosk: false, demo: false },
    }),
  );
  await page.route("**/atlas-api/workspaces", (r) =>
    r.fulfill({ status: 201, json: { id: "test" } }),
  );
  await page.route("**/atlas-api/workspaces/*/endpoints", (r) =>
    r.fulfill({
      status: 422,
      json: {
        error: {
          code: "bad_endpoint",
          message: "intranet.example.com: resolves to a private or internal address (10.0.0.7)",
        },
      },
    }),
  );
  await page.goto("/atlas/demo");
  const scan = page.locator("#endpoint");
  await scan.getByRole("textbox", { name: "Public hostnames" }).fill("intranet.example.com");
  await scan.getByRole("button", { name: "Scan and run" }).click();
  await expect(scan.getByRole("alert")).toContainText("Confirm that you own");
  await scan.getByRole("checkbox").check();
  await scan.getByRole("button", { name: "Scan and run" }).click();
  await expect(scan.getByRole("alert")).toContainText("private or internal address");
  await page.route("**/atlas-api/workspaces", (r) =>
    r.fulfill({ status: 503, json: { error: { code: "atlas_down", message: "down" } } }),
  );
  await scan.getByRole("button", { name: "Scan and run" }).click();
  await expect(scan.getByRole("alert")).toContainText("Atlas is unavailable");
});
