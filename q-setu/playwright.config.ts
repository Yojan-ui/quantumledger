import { defineConfig } from "@playwright/test";

// Smoke tests against the production build: `pnpm build && pnpm test:e2e`.
// `pnpm test:e2e:offline` runs the @offline tests against a second server started with no network
// (QSETU_OFFLINE=1): URL scans must fall back to the pre-cached real scans.
// Uses the system Chrome (set PW_CHANNEL="" to use Playwright's bundled Chromium instead).
const offline = process.env.E2E_OFFLINE === "1";
/** Test-only values, never used outside the e2e server. */
export const E2E_ADMIN_PASSWORD = "e2e-admin-password-not-secret";
export const E2E_ADMIN_TOTP = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const port = offline ? 3100 : 3000;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  grep: offline ? /@offline/ : undefined,
  grepInvert: offline ? undefined : /@offline/,
  use: {
    baseURL: `http://localhost:${port}`,
    channel: process.env.PW_CHANNEL === "" ? undefined : (process.env.PW_CHANNEL ?? "chrome"),
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: offline
      ? `QSETU_OFFLINE=1 QSETU_DATA_DIR=.data-offline pnpm --filter @qsetu/web exec next start -p ${port}`
      : "pnpm --filter @qsetu/web start",
    // Test-only admin credentials (the presenter test signs in: resetting every demo is admin-only).
    env: {
      ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      ADMIN_TOTP_SECRET: E2E_ADMIN_TOTP,
    },
    url: `http://localhost:${port}/api/qsetu/key`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
