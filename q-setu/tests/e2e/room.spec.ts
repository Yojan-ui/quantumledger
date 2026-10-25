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

test("a browser without workers gets a plain message, not a crash", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const phone = await ctx.newPage();
  const crashes: string[] = [];
  phone.on("pageerror", (e) => crashes.push(String(e)));
  await phone.addInitScript(() => {
    // @ts-expect-error simulating an old browser
    delete window.Worker;
  });
  await phone.goto("/join");
  await expect(phone.locator("[data-room-unsupported]")).toContainText("background workers");
  await expect(phone.getByText("watch the big screen")).toBeVisible();
  expect(crashes).toEqual([]);
  await ctx.close();
});

test("a crypto worker that fails to load offers a fresh start instead of hanging", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const phone = await ctx.newPage();
  // A worker whose script fails to load: it reports an error and never answers.
  await phone.addInitScript(() => {
    window.Worker = class extends EventTarget {
      onerror: ((e: ErrorEvent) => void) | null = null;
      constructor() {
        super();
        setTimeout(() => this.onerror?.(new ErrorEvent("error", { message: "404" })), 50);
      }
      postMessage() {}
      terminate() {}
    } as unknown as typeof Worker;
  });
  await phone.goto("/join");
  await expect(phone.locator("[data-room-error]")).toContainText("couldn't run the encryption");
  await expect(phone.getByRole("button", { name: "Start again" })).toBeVisible();
  await ctx.close();
});
