/**
 * Pins every dependency in every package.json to the exact version the lockfile installed (no ^ or
 * ~), so a build installs exactly what was tested. Dependabot proposes updates as pull requests.
 *
 *   node scripts/pin-exact.mjs && pnpm install
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dirs = [
  ".",
  ...["apps", "packages"].flatMap((d) => readdirSync(join(root, d)).map((x) => join(d, x))),
].filter((d) => existsSync(join(root, d, "package.json")));
let changed = 0;
for (const d of dirs) {
  const file = join(root, d, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      if (typeof spec !== "string" || !/^[\^~]/.test(spec)) continue;
      const installed = join(root, d, "node_modules", name, "package.json");
      if (!existsSync(installed)) {
        console.warn(`skip ${d} ${name}: not installed`);
        continue;
      }
      const v = JSON.parse(readFileSync(installed, "utf8")).version;
      pkg[field][name] = v;
      changed++;
    }
  }
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}
console.log(`pinned ${changed} ranges to exact versions across ${dirs.length} packages`);
