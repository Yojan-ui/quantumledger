import { defineConfig } from "@playwright/test";

// Smoke tests against the production build: `pnpm build && pnpm test:e2e`.
// Uses the system Chrome (set PW_CHANNEL="" to use Playwright's bundled Chromium instead).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.PW_CHANNEL === "" ? undefined : (process.env.PW_CHANNEL ?? "chrome"),
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "pnpm --filter @qsetu/web start",
    url: "http://localhost:3000/api/qsetu/key",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
