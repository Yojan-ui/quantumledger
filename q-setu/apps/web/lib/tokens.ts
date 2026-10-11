/**
 * Read design tokens from styles/tokens.css at runtime (for three.js materials and canvas text),
 * so colours exist in exactly one place.
 */
const cache = new Map<string, string>();

export function token(
  name: "--bg" | "--bg-raised" | "--text" | "--text-2" | "--text-3" | "--accent" | "--warn",
): string {
  if (typeof window === "undefined") return "";
  let v = cache.get(name);
  if (!v) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) cache.set(name, v);
  }
  return v;
}
