/**
 * Serves the main site's design tokens (apps/web/public/tokens.css) as they are, so the dashboard
 * uses the same colours, easing and durations without keeping a copy that could drift.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const css = await readFile(join(process.cwd(), "../web/public/tokens.css"), "utf8");
  return new Response(css, { headers: { "content-type": "text/css; charset=utf-8" } });
}
