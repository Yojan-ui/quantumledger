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

async function scanSuggested(page: import("@playwright/test").Page) {
  await page.goto("/#scan");
  await page.locator("#scan").getByRole("button", { name: "npci.org.in" }).click();
  await expect(page.getByText("What a quantum computer breaks here")).toBeVisible();
}

test("one scanner: handshake cards, what breaks, fixes, formula closed, send needs consent", async ({
  page,
}) => {
  await scanSuggested(page);
  const scan = page.locator("#scan");
  for (const label of ["TLS version", "Key exchange", "Certificate", "Expires"])
    await expect(scan.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(scan.getByText("Recommended fixes")).toBeVisible();
  const formula = scan.locator("details").filter({ hasText: "How the score is computed" });
  await expect(formula).not.toHaveAttribute("open", "");
  await scan.getByRole("button", { name: "Send to pipeline" }).click();
  await expect(scan.getByRole("alert").first()).toContainText("Confirm that you own");
  await expect(page.locator("#endpoint")).toHaveCount(0); // no second scanner on the home page
});

// Error fixtures are test-only; the shipped UI always calls Atlas through the proxy.
test("send to pipeline: Atlas refusal is shown with the recorded fallback", async ({ page }) => {
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
        error: { code: "bad_endpoint", message: "resolves to a private or internal address" },
      },
    }),
  );
  await scanSuggested(page);
  const send = page.locator("[data-send-pipeline]");
  await send.getByRole("checkbox").check();
  await send.getByRole("button", { name: "Send to pipeline" }).click();
  await expect(send.getByRole("alert")).toContainText("private or internal address");
  await expect(send.getByRole("link", { name: /recorded live scan/ })).toHaveAttribute(
    "href",
    "/atlas/tls-check3",
  );
});

test("anonymous: the home scan works signed out; Send to pipeline asks for an operator sign-in", async ({
  page,
}) => {
  await page.route("**/atlas-api/me", (r) =>
    r.fulfill({ json: { user: null, kiosk: false, demo: false } }),
  );
  await scanSuggested(page); // no session cookie: the scan itself needs no sign-in
  const send = page.locator("[data-send-pipeline]");
  await send.getByRole("checkbox").check();
  await send.getByRole("button", { name: "Send to pipeline" }).click();
  await expect(page).toHaveURL(/\/atlas\/signin\?next=/);
});
