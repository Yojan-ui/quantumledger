import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Reads a colour from styles/tokens.css on the server (icons, OG images, theme colour). */
export function serverToken(name: string): string {
  const css = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");
  return new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? "";
}
