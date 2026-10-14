/**
 * The shared front door for every request (Node runtime).
 *
 * Pages: a fresh Content Security Policy nonce (lib/server/csp), and the anonymous demo session
 * cookie if the visitor has none (lib/server/session).
 * /api/*:
 *  1. Rate limits by route class (lib/server/api-policy), per demo session where there is one, under
 *     a per-IP ceiling: reads 600/min, writes 90/min, CPU-heavy routes 40/min, routes that change the
 *     demo for everyone 12/min, streams 20/min (measured against what the demos really send).
 *  2. Every request that changes data (anything but GET/HEAD) must be same-origin: the Origin header
 *     must match this site (or, without one, Sec-Fetch-Site must say same-origin), which stops
 *     cross-site request forgery; and it must carry a valid demo session cookie, or a bearer
 *     API_TOKEN for scripted clients. Shield's server-to-server routes authenticate with a site key
 *     instead (SITE_KEY_ROUTES).
 *  3. Bodies over 300 KB are refused before any route reads them.
 * Every refusal is logged as one structured line (lib/server/log) with a hashed IP.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_EXEMPT, SITE_KEY_ROUTES, limitsFor } from "@/lib/server/api-policy";
import { contentSecurityPolicy, newNonce, NONCE_HEADER, STATIC_HTML } from "@/lib/server/csp";
import { take, tooMany } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import {
  newSession,
  SESSION_COOKIE,
  sessionCookie,
  sessionId,
  validApiToken,
  validSession,
} from "@/lib/server/session";

export const config = {
  runtime: "nodejs",
  // Everything except Next's static assets and plain files in public/ with an extension.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|svg|webm|woff2?|ico|txt|xml|json)$).*)",
  ],
};

const MAX_BODY = 300 * 1024;

function deny(req: NextRequest, code: string, message: string, status: number) {
  log(req, req.nextUrl.pathname, status, 0, { code, method: req.method });
  return Response.json({ error: { code, message } }, { status });
}

/** True if the request comes from this site's own pages. */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const allowed = new Set<string>([req.nextUrl.origin]);
  const host = req.headers.get("host");
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) allowed.add(new URL(site).origin);
  if (origin) return origin !== "null" && allowed.has(origin);
  // No Origin (some same-origin GET→POST form submissions in older browsers): fall back to the
  // Fetch Metadata header, which browsers always send and pages can't forge.
  const site2 = req.headers.get("sec-fetch-site");
  return site2 === "same-origin";
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Secure cookies only over HTTPS (a phone joining over the LAN uses http://, and would drop it).
  const secure =
    req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

  if (path.startsWith("/api/")) {
    const sid = sessionId(req.cookies.get(SESSION_COOKIE)?.value);
    const v = await take(req, limitsFor(path, req.method), sid);
    if (!v.ok) {
      log(req, path, 429, 0, { limit: v.limit.name });
      return tooMany(v);
    }
    const write = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
    if (write) {
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > MAX_BODY) return deny(req, "too_large", "That request is too large.", 413);
      const token = validApiToken(req.headers.get("authorization"));
      const siteKeyRoute = SITE_KEY_ROUTES.some((r) => r.test(path));
      if (!token && !siteKeyRoute) {
        if (!sameOrigin(req))
          return deny(req, "forbidden", "Requests must come from this site.", 403);
        if (!SESSION_EXEMPT.some((r) => r.test(path)) && !sid)
          return deny(
            req,
            "forbidden",
            "Your session expired. Reload the page and try again.",
            403,
          );
      }
    }
    return NextResponse.next();
  }

  // Pages: a fresh CSP nonce (Next reads it from the request's CSP header and puts it on its own
  // scripts; the root layout reads x-nonce), and a demo session if the visitor has none.
  const nonce = newNonce();
  const csp = contentSecurityPolicy(STATIC_HTML.some((r) => r.test(path)) ? undefined : nonce, {
    dev: process.env.NODE_ENV === "development",
    https: secure,
    ...(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
      ? { analytics: process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io" }
      : {}),
  });
  const forward = new Headers(req.headers);
  forward.set(NONCE_HEADER, nonce);
  forward.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: forward } });
  res.headers.set("content-security-policy", csp);
  if (!validSession(req.cookies.get(SESSION_COOKIE)?.value))
    res.headers.append("set-cookie", sessionCookie(newSession(), secure));
  return res;
}
