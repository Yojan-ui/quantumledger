// Builds the one-line Web shield bundle and serves it from /qsetu.js.
import { execSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "../../../packages/web-shield");
execSync("pnpm exec tsup --silent", { cwd: pkg, stdio: "inherit" });
copyFileSync(resolve(pkg, "dist/qsetu.js"), resolve(here, "../public/qsetu.js"));
// Static HTML pages (the one-line form demo, the server-rendered receipt) use the same tokens.
copyFileSync(resolve(here, "../styles/tokens.css"), resolve(here, "../public/tokens.css"));
console.log("[prepare-assets] public/qsetu.js ready");
