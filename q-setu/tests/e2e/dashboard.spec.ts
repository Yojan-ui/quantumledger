/**
 * The Shield dashboard end to end: sign up, enrol an authenticator (the test computes the code),
 * add a site, receive events with the site key, see % quantum-safe, switch the mode (and see the
 * site's config follow), download the monthly PDF, and confirm another account can't see the site.
 */
import { createHmac, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function code(secret: string, offsetSteps = 0) {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of secret) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const step = Math.floor(Date.now() / 30_000) + offsetSteps;
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  msg.writeUInt32BE(step >>> 0, 4);
  const h = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  return String(
    (((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!) % 1_000_000,
  ).padStart(6, "0");
}

async function signUp(page: Page, email: string) {
  await page.goto("/app");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("a long enough password 1");
  await page.getByRole("button", { name: "Create account" }).click();
  const secret = (await page.locator("code").first().textContent())!.trim();
  expect(secret).toMatch(/^[A-Z2-7]{20,}$/);
  await page.getByLabel("6-digit code").fill(code(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Your sites")).toBeVisible();
}

test("Shield dashboard: sign-up with 2FA, a site, events, mode, report, isolation", async ({
  page,
  browser,
  request,
}) => {
  const tag = randomBytes(4).toString("hex");
  await signUp(page, `owner-${tag}@example.com`);

  await page.getByLabel("Domain").fill(`www.e2e-${tag}.example`);
  await page.getByRole("button", { name: "Add" }).click();
  const keyText = (await page
    .locator("code", { hasText: "QSETU_SITE_KEY=" })
    .first()
    .textContent())!;
  const key = keyText.split("=")[1]!.trim();
  expect(key).toMatch(/^qsk_live_/);

  // Shield reports a honeypot hit and some connections.
  const r = await request.post("/api/shield/events", {
    headers: { authorization: `Bearer ${key}` },
    data: {
      events: [
        {
          type: "honeypot",
          at: Date.now(),
          ip: "198.51.100.7",
          path: "/.env",
          score: 100,
          reasons: ["honeypot"],
          monitorOnly: true,
        },
      ],
      stats: { pq: 3, classical: 1, requests: 10 },
    },
  });
  expect(r.status()).toBe(200);
  const bad = await request.post("/api/shield/events", {
    headers: { authorization: "Bearer qsk_live_wrong" },
    data: { events: [] },
  });
  expect(bad.status()).toBe(401);

  await page.reload();
  await expect(page.getByText("75.0%")).toBeVisible();
  await expect(page.getByText("/.env")).toBeVisible();

  // The mode switch reaches the site's config.
  await page.getByRole("radio", { name: /Protect/ }).click();
  await expect(page.getByRole("radio", { name: /Protect/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const cfg = await (
    await request.get("/api/shield/config", { headers: { authorization: `Bearer ${key}` } })
  ).json();
  expect(cfg.mode).toBe("protect");

  // The monthly report is a real PDF.
  const href = await page.getByRole("link", { name: /report \(PDF\)/ }).getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Another account can't see or touch this site.
  const siteId = href!.split("/")[4]!;
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await signUp(p2, `other-${tag}@example.com`);
  expect((await p2.request.get(`/api/app/sites/${siteId}/metrics`)).status()).toBe(404);
  // Without an Origin header the CSRF guard refuses it first (403); with one, the route itself says 404.
  expect(
    (
      await p2.request.post(`/api/app/sites/${siteId}/settings`, { data: { mode: "off" } })
    ).status(),
  ).toBe(403);
  const origin = new URL(page.url()).origin;
  expect(
    (
      await p2.request.post(`/api/app/sites/${siteId}/settings`, {
        data: { mode: "off" },
        headers: { origin },
      })
    ).status(),
  ).toBe(404);
  await other.close();

  // Signed out, nothing is visible.
  const anon = await browser.newContext();
  expect((await (await anon.newPage()).request.get("/api/app/sites")).status()).toBe(401);
  await anon.close();
});
