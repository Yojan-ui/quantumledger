#!/usr/bin/env node
/**
 * `node scripts/motion-check.mjs <path> <outDir> [step...]`: opens a page at 1440×900 (BASE, default
 * http://localhost:3001), runs the steps, and reports console errors (shader compile errors included).
 * Steps: `click:<button name>`, `link:<link name>`, `wait:<ms>`, `shot:<name>` (a screenshot),
 * `film:<name>:<ms>:<n>` (n screenshots over ms), `scroll:<y>`, `eval:<js>`.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [path, outDir = "/tmp/motion-check", ...steps] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3001";
const out = outDir.replace(/\/?$/, "/");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  args: process.env.GPU === "1" ? [] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" || /Shader Error|WebGLProgram|GL_INVALID/.test(m.text()))
    errors.push(`${m.type()}: ${m.text().slice(0, Number(process.env.ERRLEN ?? 600))}`);
});
await page.goto(BASE + path, { waitUntil: "load" });
await page.waitForTimeout(2500);
for (const s of steps) {
  const [kind, ...rest] = s.split(":");
  const arg = rest.join(":");
  if (kind === "click")
    await page.getByRole("button", { name: arg }).first().click({ timeout: 15000 });
  else if (kind === "link") await page.getByRole("link", { name: arg }).first().click();
  else if (kind === "wait") await page.waitForTimeout(Number(arg));
  else if (kind === "shot") await page.screenshot({ path: `${out}${arg}.png` });
  else if (kind === "scroll") await page.evaluate((y) => window.scrollTo(0, y), Number(arg));
  else if (kind === "eval") await page.evaluate(arg);
  else if (kind === "film") {
    const [name, ms, n] = arg.split(":");
    for (let i = 0; i < Number(n); i++) {
      await page.screenshot({ path: `${out}${name}-${String(i).padStart(2, "0")}.png` });
      await page.waitForTimeout(Number(ms) / Number(n));
    }
  }
}
console.log(errors.length ? errors.join("\n") : "no console errors");
await browser.close();
