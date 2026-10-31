import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("landing: headline, live ticker and sourced facts", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Bank migration, backed by evidence.",
  );
  await expect(page.locator("[data-room-qr] svg")).toBeVisible();
  await expect(page.locator("#fact-1")).toContainText("as of");
  // The live strip streams real operations from the bus.
  const strip = page.getByLabel("Live operations");
  await expect(strip).toContainText("ops/sec");
  await expect(strip.locator("p").first()).toContainText(
    /SEAL|VERIFY|LEDGER|HANDSHAKE|KEYGEN|REJECT|ROTATE/,
  );
  // The Readiness Index headline is computed from the measured totals.
  await expect(page.locator("#index")).toContainText(/\d+% of the Indian banking sites we checked/);
  await expect(page.locator("#analogy")).toContainText("Everything has a lock");
  expect(errors).toEqual([]);
});

test("Demo 1: real handshake, then an attack is rejected by ML-DSA", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/demo/how-it-works");
  await page.getByRole("button", { name: /Play/ }).click();
  await expect(page.getByText(/messages over AES-256-GCM/)).toBeVisible();
  await page.getByRole("button", { name: /Attack it/ }).click();
  await expect(page.getByText(/ML-DSA-65 verification failed/)).toBeVisible();
  // Crypto agility: hot-swap the server policy, then put it back.
  await page.getByRole("radio", { name: "ML-KEM-512 · ML-DSA-44" }).click();
  await expect(page.getByText(/Policy g\d+: edge · ml-dsa-44/)).toBeVisible();
  await page.getByRole("radio", { name: "ML-KEM-768 · ML-DSA-65" }).click();
  await expect(page.getByText(/Policy g\d+: standard · ml-dsa-65/)).toBeVisible();
  await expect(page.getByRole("log")).toContainText(/HANDSHAKE|SIGN|POLICY/);
  expect(errors).toEqual([]);
});

test("Demo 2: Web, Database and IoT adapters deploy for real; tampering rejected", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto("/demo/deploy");
  await page.getByRole("button", { name: "Deploy QuantumLedger Web" }).click();
  await expect(page.getByText(/reply signature verified/)).toBeVisible();
  // A deployed node keeps doing real work: its counter climbs.
  await expect(page.getByLabel("operations since deploy").first()).not.toHaveText(/^0\s/, {
    timeout: 15_000,
  });
  await page.getByRole("radio", { name: /Database/ }).click();
  await page.getByRole("button", { name: "Deploy QuantumLedger Vault" }).click();
  await expect(page.getByText(/read back and signature verified/)).toBeVisible();
  await page.getByRole("button", { name: "Tamper with the stored record" }).click();
  await expect(page.getByText(/verification failed: record .* was modified/)).toBeVisible();
  await page.getByRole("radio", { name: /IoT device/ }).click();
  await page.getByRole("button", { name: "Deploy QuantumLedger Edge" }).click();
  await expect(page.getByText(/readings delivered, 3 batch signatures verified/)).toBeVisible();
  // Reading the tampered Vault record correctly answers 409 Conflict; Chrome logs that response.
  expect(errors.filter((e) => !e.includes("status of 409"))).toEqual([]);
});

test("Demo 2: Shield tunnels to the untouched legacy app", async ({ page }) => {
  await page.goto("/demo/deploy");
  await page.getByRole("radio", { name: /API server/ }).click();
  await page.getByRole("button", { name: "Deploy QuantumLedger Shield" }).click();
  await expect(page.getByText(/unaware it was tunnelled over PQC/)).toBeVisible();
});

test("Demo 3: Q-Day exposes classical records, none with QuantumLedger", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/demo/qday");
  await expect(
    page.getByRole("region", { name: "Classical system" }).locator("li").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /Go to Q-Day/ }).click();
  await expect(page.getByText("Exposed · QuantumLedger")).toBeVisible();
  await expect(page.getByText(/Factored n in \d+ steps/)).toBeVisible();
  await expect(page.getByText(/AES-256-GCM tag check failed/)).toBeVisible();
  const stats = page.locator("p.tabular");
  await expect(stats.nth(1)).toHaveText("0");
  expect(Number(await stats.nth(0).innerText())).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Demo 4: Proof Chain pinpoints a row edited in the database", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/demo/ledger");
  await page.getByRole("button", { name: "Verify the chain" }).click();
  await expect(page.getByText("Chain intact")).toBeVisible();
  await page.getByRole("button", { name: "Tamper with entry #42" }).click();
  await expect(page.getByText(/What the insider ran/)).toBeVisible();
  await page.getByRole("button", { name: "Verify the chain" }).click();
  await expect(page.getByText("Broken at entry #42")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await page.getByRole("button", { name: "Verify the chain" }).click();
  await expect(page.getByText("Chain intact")).toBeVisible();
  expect(errors).toEqual([]);
});

test("API: OpenAPI docs, consistent errors, SSRF guard", async ({ request }) => {
  const docs = await (await request.get("/api/docs")).json();
  expect(docs.openapi).toBe("3.1.0");
  expect(Object.keys(docs.paths)).toEqual(
    expect.arrayContaining(["/api/ledger/verify", "/api/scan/url", "/api/policy"]),
  );
  const bad = await request.post("/api/simulate", { data: { count: 99 } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatchObject({ code: "invalid_input" });
  const ssrf = await request.post("/api/scan/url", { data: { url: "http://169.254.169.254/" } });
  expect(ssrf.status()).toBeGreaterThanOrEqual(400);
  expect((await ssrf.json()).error.message).toMatch(/private|public/);
});

test("Scanner: Java TLS sample scores Critical and yields a CBOM", async ({ page }) => {
  await page.goto("/demo/scanner");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByText(/Readiness · Critical/)).toBeVisible();
  await expect(page.getByRole("table")).toContainText("TLS cipher suite");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CBOM" }).click();
  expect((await download).suggestedFilename()).toMatch(/^cbom-.*\.json$/);
  // Findings become an ordered migration plan, exportable as Markdown.
  await expect(page.getByText(/steps, most urgent first/)).toBeVisible();
  await expect(page.getByText("Front legacy services with QuantumLedger Shield")).toBeVisible();
  const md = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown" }).click();
  expect((await md).suggestedFilename()).toMatch(/^migration-plan-.*\.md$/);
});

test("Web shield: a plain HTML form is sealed by one script tag", async ({ page }) => {
  await page.goto("/web-shield-demo/");
  await expect(page.locator("html")).toHaveAttribute("data-qsetu", "on");
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText(/Arrived sealed with QuantumLedger/)).toBeVisible();
  await expect(page.getByRole("cell", { name: "Kavya Nair" })).toBeVisible();
});
