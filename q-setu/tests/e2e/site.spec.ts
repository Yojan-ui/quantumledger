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
  ["/demos", /Real crypto\. No slides\./],
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

test("home: live scan first, pipeline second, then the story", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator("main > section[id]").evaluateAll((s) => s.map((x) => x.id));
  expect(ids).toEqual([
    "top",
    "scan",
    "pipeline",
    "join-live",
    "analogy",
    "index",
    "how-it-works",
    "adapters",
    "solutions",
    "impact",
    "whats-new",
    "why-quantumledger",
    "early-access",
  ]);
  // Every numbered section label, 02–10, in order (the hero is 01 and the scan box is part of 03).
  const labels = await page.locator("main > section [class*=uppercase]").allInnerTexts();
  const nums = labels.map((t) => /^(\d{2}) —/.exec(t)?.[1]).filter(Boolean);
  expect([...new Set(nums)]).toEqual(["02", "03", "04", "05", "06", "07", "08", "09", "10"]);
  await expect(page.getByRole("link", { name: "Explore the pipeline" })).toBeVisible();
  // No raw escape sequences leak into rendered copy (JSX attributes don't process "\u2011").
  expect(await page.locator("main").innerText()).not.toMatch(/\\u[0-9a-f]{4}/i);
  await expect(
    page.locator("#top").getByRole("link", { name: "Scan a site", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#pipeline [data-hud-stage]")).toBeVisible();
  // the live scan comes first, the pipeline second
  const top = (id: string) => page.locator(id).evaluate((e) => e.getBoundingClientRect().top);
  expect(await top("#scan")).toBeLessThan(await top("#pipeline"));
});

test("scan: a site gets a score, plain findings and a share page", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#scan");
  await page.getByRole("button", { name: "npci.org.in" }).click();
  await expect(page.getByText(/Hybrid post-quantum key exchange|Harvestable today/)).toBeVisible();
  await expect(
    page.getByText("Fix this with QuantumLedger Shield, zero code change →"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open result page" }).click();
  await expect(page).toHaveURL(/\/scan\/www\.npci\.org\.in/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Is www.npci.org.in quantum-safe?",
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
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/solutions/fintech");
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
  await page.getByPlaceholder(/Search pages/).fill("contact");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/contact$/);
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
  // 1 is the diagnostics HUD; 2–6 the demos (4 = Q-Day).
  await page.keyboard.press("4");
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
