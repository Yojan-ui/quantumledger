import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let html: string | undefined;

/**
 * SPA fallback for the Lab: every /lab/* URL that is not a static file in public/lab returns the shell, so
 * deep links (e.g. /lab/runs/<id>/findings/0/3) survive a refresh. Static assets are served from public/ first.
 */
export function GET() {
  html ??= readFileSync(join(process.cwd(), "public", "lab", "index.html"), "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });
}
