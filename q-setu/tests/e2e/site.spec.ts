import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

// Every page in the sitemap renders its one-sentence h1 without console errors.
const PAGES: [string, RegExp][] = [
  ["/platform", /One core\. Five ways in\./],
  ["/solutions", /most sensitive rails/],
  ["/solutions/fintech", /Payment and banking traffic/],
  ["/solutions/healthcare", /A diagnosis stays sensitive/],
  ["/solutions/education", /A degree is verified/],
  ["/solutions/government", /Identity, tax and land records/],
  ["/demos", /Real crypto\. No slides\./],
  ["/pricing", /Start free/],
  ["/security", /What we protect/],
  ["/about", /Quantum-safe India before Q-Day/],
  ["/changelog", /release by release/],
  ["/contact", /Talk to the team/],
  ["/privacy", /as little as we can/],
  ["/terms", /Plain terms/],
  ["/docs", /Quickstart/],
  ["/docs/adapters/shield", /Shield/],
  ["/docs/adapters/web", /Web/],
  ["/docs/adapters/sdk", /SDK/],
  ["/docs/adapters/edge", /Edge/],
  ["/docs/adapters/vault", /Vault/],
  ["/docs/concepts", /Overview/],
  ["/docs/concepts/hybrid-kem", /Hybrid key exchange/],
  ["/docs/api", /API reference/],
  ["/docs/security-model", /Security model/],
  ["/pitch", /.+/],
];

for (const [path, h1] of PAGES) {
  test(`page ${path}`, async ({ page }) => {
    const errors = trackErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(h1);
    expect(errors).toEqual([]);
  });
}

test("home: nine sections in order, each with an index label", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator("main > section[id]").evaluateAll((s) => s.map((x) => x.id));
  expect(ids).toEqual([
    "top",
    "scan",
    "why-now",
    "how-it-works",
    "adapters",
    "solutions",
    "proof",
    "why-q-setu",
    "early-access",
  ]);
  await expect(page.getByRole("link", { name: "Try it live" })).toBeVisible();
  // No raw escape sequences leak into rendered copy (JSX attributes don't process "\u2011").
  expect(await page.locator("main").innerText()).not.toMatch(/\\u[0-9a-f]{4}/i);
  await expect(page.getByRole("link", { name: "Scan any site" })).toBeVisible();
});

test("scan: a site gets a score, plain findings and a share page", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#scan");
  await page.getByRole("button", { name: "irctc.co.in" }).click();
  await expect(page.getByText(/Hybrid post-quantum key exchange|Harvestable today/)).toBeVisible();
  await expect(page.getByText("Fix this with Q-Setu Shield, zero code change →")).toBeVisible();
  await page.getByRole("link", { name: "Open result page" }).click();
  await expect(page).toHaveURL(/\/scan\/www\.irctc\.co\.in/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Is www.irctc.co.in quantum-safe?",
  );
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toMatch(/opengraph-image/);
  expect(errors).toEqual([]);
});

test("early access: validated, stored, thanked", async ({ page, request }) => {
  const bad = await request.post("/api/early-access", { data: { email: "nope" } });
  expect(bad.status()).toBe(400);
  await page.goto("/#early-access");
  const form = page.locator("#early-access");
  await form.getByLabel("Name").fill("Asha Rao");
  await form.getByLabel("Work email").fill("asha@example.in");
  await form.getByLabel("Organisation").fill("Example Bank");
  await form.getByLabel("Sector").selectOption("fintech");
  await form.getByLabel("What would you protect first?").fill("UPI switch links");
  await form.getByRole("button", { name: "Request early access" }).click();
  await expect(page.getByText("Thanks. We’ll write to asha@example.in.")).toBeVisible();
});

test("SEO: sitemap, robots, security.txt, OG image, 404", async ({ page, request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/solutions/government");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  expect(await (await request.get("/.well-known/security.txt")).text()).toMatch(/^Contact: /m);
  const og = await request.get("/og?title=Hello");
  expect(og.headers()["content-type"]).toBe("image/png");
  const res = await page.goto("/this-was-harvested");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This page was harvested. Just kidding.")).toBeVisible();
});

test("⌘K jumps to any page", async ({ page }) => {
  await page.goto("/about");
  // Retry the shortcut until the page has hydrated and the menu opens.
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByPlaceholder(/Search pages/)).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByPlaceholder(/Search pages/).fill("pricing");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pricing$/);
});

test("presenter mode: keyboard drives the demos, R resets everything", async ({ page }) => {
  await page.goto("/demo/ledger?present=1");
  await expect(page.locator("html")).toHaveAttribute("data-present", "");
  await expect(page.getByText(/Presenting · ←\/→ step/)).toBeVisible();
  await page.keyboard.press("ArrowRight"); // verify
  await expect(page.getByText("Chain intact")).toBeVisible();
  await page.keyboard.press("ArrowRight"); // tamper with #42
  await expect(page.getByText(/What the insider ran/)).toBeVisible();
  await page.keyboard.press("ArrowRight"); // verify: the break is found
  await expect(page.getByText("Broken at entry #42")).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByText("Everything reset ✓")).toBeVisible();
  await page.keyboard.press("3");
  await expect(page).toHaveURL(/\/demo\/qday/);
  // Presenter mode plays the Q-Day film (→ also advances it): the timeline leaves 2026.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#year")).not.toHaveValue("2026");
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).not.toHaveAttribute("data-present", "");
});

test("pitch: seven slides with keyboard navigation", async ({ page }) => {
  await page.goto("/pitch");
  await expect(page.getByText("1 / 7")).toBeVisible();
  for (let k = 0; k < 6; k++) await page.keyboard.press("ArrowRight");
  await expect(page.getByText("7 / 7")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("design partners");
});
