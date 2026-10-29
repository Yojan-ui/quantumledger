import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../../public/lab/css/tokens.css", import.meta.url), "utf8");
const block = (sel) => css.slice(css.indexOf(sel)).split("}")[0];
const tok = (src, name) => src.match(new RegExp(`--${name}:\\s*([^;]+);`))[1].trim();
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const [r, g, b] = channels(hex).map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const [theme, src] of [
  ["dark", block(":root {")],
  ["light", block(':root[data-theme="light"]')],
]) {
  test(`${theme}: body text pairs reach 4.5:1`, () => {
    for (const bg of ["base", "base-2", "surface", "surface-2"]) {
      for (const fg of ["text", "text-2"]) {
        const r = ratio(tok(src, fg), tok(src, bg));
        assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}`);
      }
      // --text-3 is reserved for large text (>= 3:1)
      const r3 = ratio(tok(src, "text-3"), tok(src, bg));
      assert.ok(r3 >= 3, `text-3 on ${bg}: ${r3.toFixed(2)}`);
    }
    assert.ok(ratio(tok(src, "invert-text"), tok(src, "invert-bg")) >= 4.5);
  });
}

test("palette is strictly greyscale", () => {
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g)) {
    const [r, g, b] = channels(hex);
    assert.ok(r === g && g === b, hex);
  }
  for (const m of css.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+)/g))
    assert.ok(m[1] === m[2] && m[2] === m[3], m[0]);
});
