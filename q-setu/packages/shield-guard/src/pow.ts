/**
 * The challenge step: a small proof of work a real browser solves in well under a second, and a pass
 * cookie afterwards. Everything is signed with the site's secret (HMAC-SHA256), bound to the client's
 * IP (hashed) and short-lived, so a solved challenge can't be replayed from elsewhere or reused for
 * long. Clients that can't run JavaScript can't pass, which is also the engine's "runs JS" signal.
 *
 * Proof: SHA-256(challenge + "." + counter) must start with `bits` zero bits. 16 bits is ~65,000
 * hashes on average: a few hundred ms in a phone browser, real cost for a scraper doing it per IP.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const POW_PATH = "/.well-known/qsetu/pow";
export const PASS_COOKIE = "qs_pass";
const CHALLENGE_TTL_MS = 2 * 60_000;
export const PASS_TTL_MS = 60 * 60_000;

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (secret: string, s: string) =>
  createHmac("sha256", secret).update(s).digest("base64url");
const ipTag = (secret: string, ip: string) => mac(secret, `ip:${ip}`).slice(0, 16);
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function leadingZeroBits(hash: Buffer): number {
  let n = 0;
  for (const byte of hash) {
    if (byte === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(byte) - 24;
  }
  return n;
}

export function issueChallenge(secret: string, ip: string, bits: number, now = Date.now()): string {
  const body = b64u(
    JSON.stringify({
      n: b64u(randomBytes(12)),
      e: now + CHALLENGE_TTL_MS,
      i: ipTag(secret, ip),
      b: bits,
    }),
  );
  return `${body}.${mac(secret, `pow:${body}`)}`;
}

/** Checks a solution; returns a pass cookie value if it's good. */
export function verifySolution(
  secret: string,
  ip: string,
  challenge: string,
  counter: string,
  now = Date.now(),
): string | undefined {
  if (challenge.length > 512 || !/^\d{1,12}$/.test(counter)) return undefined;
  const [body, sig] = challenge.split(".");
  if (!body || !sig || !safeEq(sig, mac(secret, `pow:${body}`))) return undefined;
  let c: { e: number; i: string; b: number };
  try {
    c = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return undefined;
  }
  if (c.e < now || c.i !== ipTag(secret, ip)) return undefined;
  const h = createHash("sha256").update(`${challenge}.${counter}`).digest();
  if (leadingZeroBits(h) < c.b) return undefined;
  const pass = b64u(JSON.stringify({ e: now + PASS_TTL_MS, i: ipTag(secret, ip) }));
  return `${pass}.${mac(secret, `pass:${pass}`)}`;
}

export function validPass(
  secret: string,
  ip: string,
  cookie: string | undefined,
  now = Date.now(),
): boolean {
  if (!cookie || cookie.length > 256) return false;
  const [body, sig] = cookie.split(".");
  if (!body || !sig || !safeEq(sig, mac(secret, `pass:${body}`))) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { e: number; i: string };
    return p.e >= now && p.i === ipTag(secret, ip);
  } catch {
    return false;
  }
}

/** The challenge page. Plain, no third-party script; one inline script allowed by its own nonce. */
export function challengePage(challenge: string, returnTo: string): { html: string; csp: string } {
  const nonce = randomBytes(16).toString("base64");
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Checking your browser</title>
<style>body{font:16px system-ui,sans-serif;background:#0b0c0e;color:#e8e9eb;display:grid;place-items:center;min-height:100vh;margin:0}p{max-width:28rem;text-align:center;line-height:1.5}</style></head>
<body><p id="m">Checking your browser before continuing. This takes a moment.</p>
<noscript><p>This check needs JavaScript.</p></noscript>
<script nonce="${nonce}">
(async () => {
  const c = ${JSON.stringify(challenge)}, bits = JSON.parse(atob(c.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).b;
  const enc = new TextEncoder();
  for (let i = 0; ; i++) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(c + "." + i)));
    let z = 0; for (const b of h) { if (b === 0) { z += 8; continue; } z += Math.clz32(b) - 24; break; }
    if (z >= bits) {
      const r = await fetch(${JSON.stringify(POW_PATH)}, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ c, n: String(i) }) });
      if (r.ok) location.replace(${JSON.stringify(safeReturn)}); else document.getElementById("m").textContent = "That didn't work. Reload to try again.";
      return;
    }
  }
})();
</script></body></html>`;
  return {
    html,
    csp: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  };
}
