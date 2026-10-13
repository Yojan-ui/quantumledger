#!/usr/bin/env node
/**
 * `pnpm lint:design`: fails if apps/web uses anything outside the design system.
 *  - hex / rgb() / hsl() colours outside styles/tokens.css
 *  - banned Tailwind classes (gradient utilities, shadows, backdrop blur, bold weights,
 *    pulse/bounce, clip-text)
 *  - CSS gradients, except the allowed ones in app/globals.css: the panel spotlight (.spotlight),
 *    hairlines between role colours (.hairline-accent, .hairline-roles) and the ambient role tint
 *    behind a 3D object (.ambient, 12% of a role token); the globe atmosphere is a shader
 *  - arbitrary Tailwind values like p-[13px] or text-[#fff], and arbitrary properties like [mask:...],
 *    in className strings and in any other string literal that looks like a class list
 *  - emoji in JSX/HTML
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../apps/web/", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", ".next", "data"]);
const SKIP_FILES = new Set([
  "public/qsetu.js",
  "next-env.d.ts",
  "tsconfig.tsbuildinfo",
  "styles/tokens.css",
  "public/tokens.css",
]);
const EXT = /\.(tsx?|mjs|js|css|html|svg)$/;

const RULES = [
  {
    name: "raw colour (use tokens.css)",
    re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?(?![\w-])|\b(?:rgba?|hsla?)\(/g,
  },
  {
    name: "banned class",
    re: /(?<![\w-])(?:bg-gradient-\w+|(?:from|via|to)-(?:[a-z]+(?:-\d+)?|\[)|shadow-[\w[]|drop-shadow|font-bold|font-semibold|animate-bounce|animate-pulse|bg-clip-text|text-transparent)/g,
  },
  {
    name: "blur (repaints every frame over moving content)",
    re: /(?<![\w-])(?:backdrop-)?blur(?:-[\w[]+)?(?![\w-])/g,
    classOnly: true,
  },
  {
    name: "arbitrary Tailwind value",
    re: /(?<![\w$.])[a-z][\w:-]*-\[[^\]\s]+\]|(?<=^|["'`\s])\[[a-z-]+:[^\]\s]+\]|(?<=^|["'`\s])\[&[^\]\s]*\]:/g,
    classOnly: true,
  },
  { name: "emoji", re: /\p{Extended_Pictographic}/gu, only: /\.(tsx|html)$/ },
  {
    name: "gradient outside the allowed set",
    re: /(?:linear|radial|conic)-gradient\(/g,
    allowIn: {
      file: /^app\/globals\.css$/,
      // spotlight, the two hairlines, the globe's glow, and the hero's legibility scrim.
    selector: /^\s*\.(?:spotlight(?:::before)?|hairline-accent|hairline-roles|ambient|hero-scrim)\s*\{/,
    },
  },
];

/** For an index in a CSS file, the selector line of the rule block it sits in. */
function selectorAt(src, index) {
  const open = src.lastIndexOf("{", index);
  const lineStart = src.lastIndexOf("\n", open) + 1;
  return src.slice(lineStart, open + 1);
}

/** Only scan class strings for class-only rules: className="…", class="…", and cx()/template literals in TSX. */
function classStrings(src) {
  const out = [];
  // className="…", class='…', className={`…`}, any template literal, and any "…" string with a space
  // or a Tailwind-looking token (so class lists kept in constants are checked too).
  const re =
    /class(?:Name)?=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})|`([^`]*)`|"((?:-?[a-z][\w:/.#%,()[\]-]*(?:\s+|(?=")))+)"/g;
  for (const m of src.matchAll(re))
    out.push({ text: m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "", index: m.index });
  return out;
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, files);
    } else if (EXT.test(name)) files.push(p);
  }
  return files;
}

const problems = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (SKIP_FILES.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  const lineOf = (i) => src.slice(0, i).split("\n").length;
  for (const rule of RULES) {
    if (rule.only && !rule.only.test(rel)) continue;
    if (rule.except && rule.except.test(rel)) continue;
    const chunks = rule.classOnly ? classStrings(src) : [{ text: src, index: 0 }];
    for (const c of chunks) {
      for (const m of c.text.matchAll(rule.re)) {
        if (
          rule.allowIn &&
          rule.allowIn.file.test(rel) &&
          rule.allowIn.selector.test(selectorAt(src, c.index + m.index))
        )
          continue;
        problems.push(`${rel}:${lineOf(c.index + m.index)}  ${rule.name}: ${m[0]}`);
      }
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n✗ lint:design found ${problems.length} problem(s).`);
  process.exit(1);
}
console.log("✓ lint:design: apps/web uses only design tokens.");
