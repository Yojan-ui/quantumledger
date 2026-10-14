/**
 * The site's Content Security Policy, built per request with a fresh nonce (the middleware does it).
 *
 * Scripts run only if they carry the nonce, or were loaded by one that did ('strict-dynamic'): Next's
 * own chunks, the two inline scripts in the root layout, and the analytics script. No 'unsafe-eval'
 * (only `next dev` gets it, which its hot reload needs) and no 'unsafe-inline' for scripts. Styles keep
 * 'unsafe-inline' because React style attributes can't carry a nonce; styles can't run code.
 *
 * A nonce has to change on every response, so pages are rendered per request rather than prerendered
 * (the root layout reads the nonce). That is Next.js's documented requirement for nonce-based CSP.
 */
export const NONCE_HEADER = "x-nonce";

export function newNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString("base64");
}

/** Static HTML from public/ (no React, no inline script): scripts from this origin only, no nonce. */
export const STATIC_HTML = [/^\/web-shield-demo(\/|$)/];

export function contentSecurityPolicy(
  nonce: string | undefined,
  o: { dev: boolean; https: boolean; analytics?: string },
): string {
  const analytics = o.analytics ? new URL(o.analytics).origin : "";
  const d: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
      ...(o.dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(analytics ? [analytics] : []), ...(o.dev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'self'"],
  };
  const parts = Object.entries(d).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (o.https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
