/**
 * `pnpm tsx scripts/capture-bank.ts`: captures the bundled legacy bank's homepage to
 * apps/web/public/scenes/legacy-bank.jpg, the page the Shield scene shows on its browser window.
 * Re-run it whenever the bank's page changes; the scene loads the file as a texture.
 */
import { chromium } from "@playwright/test";
import { createLegacyApp } from "../apps/legacy-bank/src/app";

const server = createLegacyApp(() => {}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const { port } = server.address() as { port: number };
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "" ? undefined : "chrome",
});
const page = await browser.newPage({
  viewport: { width: 1024, height: 600 },
  deviceScaleFactor: 1,
});
await page.goto(`http://127.0.0.1:${port}/`);
const out = new URL("../apps/web/public/scenes/legacy-bank.jpg", import.meta.url).pathname;
await page.screenshot({ path: out, type: "jpeg", quality: 82 });
await browser.close();
server.close();
console.log(`wrote ${out}`);
