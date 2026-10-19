/** The Shield pages: the product page, and the live attack side-by-side with its real numbers. */
import { expect, test } from "@playwright/test";

test("Shield product page: the three installs and the honest scope", async ({ page }) => {
  await page.goto("/shield");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Quantum-safe encryption and AI-agent defence",
  );
  // Code blocks render their text twice (a screen-reader copy and the visible one): check the page text.
  const text = await page.locator("main").innerText();
  expect(text).toContain("_qsetu-challenge.www.example.com");
  expect(text).toContain("docker run");
  expect(text).toContain("app.use(shield");
  await expect(page.getByText("Does not", { exact: true })).toBeVisible();
});

test("Shield live: the same attacks stopped behind Shield Edge, answered without it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/shield/live");
  const done = page.waitForResponse((r) => r.url().endsWith("/api/shield/live"), {
    timeout: 150_000,
  });
  await page.getByRole("button", { name: "Run the attack suite" }).click();
  const res = await done;
  expect(res.status()).toBe(200);
  const run = (await res.json()) as {
    bare: { attack: string; answered: number; refused: number }[];
    edge: { attack: string; answered: number; refused: number }[];
    tls: { bare: { encrypted: boolean }; edge: { group?: string } };
  };
  const row = (list: typeof run.bare, name: string) => list.find((r) => r.attack.startsWith(name))!;
  // The burst: the bare app answers it all; the edge stops most of it.
  expect(row(run.bare, "Burst").answered).toBe(1000);
  expect(row(run.edge, "Burst").refused).toBeGreaterThan(500);
  // Honeypots then a normal request: behind Shield the last one is refused too.
  expect(row(run.bare, "Honeypots").refused).toBe(0);
  expect(row(run.edge, "Honeypots").refused).toBeGreaterThan(0);
  // The crawler gets everything from the bare app, much less through the edge.
  expect(row(run.edge, "AI crawler").answered).toBeLessThan(row(run.bare, "AI crawler").answered);
  expect(run.tls.bare.encrypted).toBe(false);
  expect(run.tls.edge.group).toBe("X25519MLKEM768");
  await expect(page.getByText("X25519MLKEM768", { exact: false })).toBeVisible();
});
