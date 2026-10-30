/**
 * /atlas-api/*: same-origin proxy to the Q-Shield Atlas backend (qshield/atlas_web, `pnpm dev:atlas`).
 * /atlas-api/<path>?<query> -> ${ATLAS_URL}/api/<path>?<query>.
 *
 * - Origin: the browser's Origin must match this server's own host (403 bad_origin). Upstream we then send
 *   Atlas's own origin, so its check_origin() (Origin netloc == Host) passes without weakening it.
 * - Cookies and CSRF: Cookie, Content-Type and X-CSRF-Token go up; status, body and every Set-Cookie
 *   (atlas_session HttpOnly, atlas_csrf; both Path=/) come back unchanged.
 * - Bodies are buffered: Atlas reads request bodies by Content-Length (no chunked uploads).
 * - SSE (text/event-stream) is streamed through unbuffered; the upstream request is aborted when the
 *   browser disconnects (request.signal).
 * - Atlas down: 503 { error: { code: "atlas_down", message } }, the shape lib/client/api.ts errText() reads.
 */

const atlasUrl = () => (process.env.ATLAS_URL || "http://127.0.0.1:8100").replace(/\/+$/, "");

const UP = ["content-type", "cookie", "x-csrf-token", "accept", "if-none-match", "last-event-id"];
const DOWN = [
  "content-type",
  "cache-control",
  "etag",
  "content-security-policy",
  "content-disposition",
  "x-content-type-options",
  "retry-after",
];

export type Ctx = { params: Promise<{ path?: string[] }> };

function fail(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** The browser's Origin (when it sends one) must be this server's own origin. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function proxy(request: Request, ctx: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return fail(403, "bad_origin", "cross-origin request refused");
  const { path = [] } = await ctx.params;
  if (path.some((p) => p === ".." || p === "." || p.includes("/")))
    return fail(400, "bad_path", "invalid path");
  const base = atlasUrl();
  const target = `${base}/api/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;

  const headers = new Headers();
  for (const k of UP) {
    const v = request.headers.get(k);
    if (v) headers.set(k, v);
  }
  if (request.method !== "GET" && request.method !== "HEAD")
    headers.set("origin", new URL(base).origin);
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 }); // the browser went away
    return fail(503, "atlas_down", "Q-Shield backend isn't running on :8100");
  }

  const out = new Headers();
  for (const k of DOWN) {
    const v = upstream.headers.get(k);
    if (v) out.set(k, v);
  }
  for (const c of upstream.headers.getSetCookie()) out.append("set-cookie", c);
  if ((upstream.headers.get("content-type") || "").startsWith("text/event-stream")) {
    out.set("cache-control", "no-cache, no-transform"); // no-transform: no compression, no buffering
    out.set("x-accel-buffering", "no");
    return new Response(upstream.body, { status: upstream.status, headers: out });
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
