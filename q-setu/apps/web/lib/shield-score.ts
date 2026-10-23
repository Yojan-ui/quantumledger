/**
 * The edge readiness score used by the Shield scene and the Quantum-Ready report: one number for
 * "how ready is this site's front door", built only from what a scan measures.
 *
 *   score = 70% transport + 30% hardening
 *   transport  = the readiness scanner's score (0–100) for the TLS it negotiated (@qsetu/core scan)
 *   hardening  = the share of the seven checks below that pass, as measured on a real response
 *
 * The certificate stays classical (ECDSA) after Shield goes in, and the transport score says so; the
 * score can't reach 100 until CAs issue post-quantum certificates.
 */

export type CheckId = "tls13" | "hsts" | "nosniff" | "frame" | "referrer" | "csp" | "stack";

export interface Check {
  id: CheckId;
  /** The finding before it's fixed (a tag on the website window). */
  finding: string;
  /** The fix, engraved on a plate. */
  plate: string;
}

export const CHECKS: Check[] = [
  { id: "tls13", finding: "TLS 1.2 still accepted", plate: "TLS 1.3 only" },
  { id: "hsts", finding: "No HSTS", plate: "HSTS" },
  { id: "nosniff", finding: "No nosniff", plate: "nosniff" },
  { id: "frame", finding: "Can be framed", plate: "frame-ancestors" },
  { id: "referrer", finding: "No Referrer-Policy", plate: "Referrer-Policy" },
  { id: "csp", finding: "No content policy", plate: "CSP" },
  { id: "stack", finding: "Server header exposed", plate: "Server header stripped" },
];

/** One measured check: `partial` is a content policy in Report-Only mode (counts half). */
export interface CheckResult {
  ok: boolean;
  partial?: boolean;
  /** What was seen, e.g. the header value or "Express". */
  seen?: string;
}

export type Checks = Record<CheckId, CheckResult>;

/** Reads the hardening checks off a response's headers (lower-case names) and a TLS 1.2 probe. */
export function checkHeaders(h: Record<string, string | undefined>, accepts12: boolean): Checks {
  const csp = h["content-security-policy"];
  const cspRo = h["content-security-policy-report-only"];
  const xfo = h["x-frame-options"];
  const stack = h["server"] ?? h["x-powered-by"];
  return {
    tls13: { ok: !accepts12, seen: accepts12 ? "TLS 1.2 accepted" : "TLS 1.2 refused" },
    hsts: { ok: !!h["strict-transport-security"], seen: h["strict-transport-security"] },
    nosniff: { ok: h["x-content-type-options"]?.toLowerCase() === "nosniff" },
    frame: {
      ok: /frame-ancestors/i.test(csp ?? "") || /^(deny|sameorigin)$/i.test(xfo ?? ""),
      seen:
        /frame-ancestors[^;]*/i.exec(csp ?? "")?.[0] ??
        (xfo ? `X-Frame-Options: ${xfo}` : undefined),
    },
    referrer: { ok: !!h["referrer-policy"], seen: h["referrer-policy"] },
    // A policy that only sets frame-ancestors isn't a content policy; Report-Only counts half.
    csp:
      csp && /default-src|script-src/i.test(csp)
        ? { ok: true, seen: "enforced" }
        : cspRo
          ? { ok: false, partial: true, seen: "Report-Only" }
          : { ok: false },
    stack: { ok: !stack, seen: stack },
  };
}

export function hardening(c: Checks): number {
  const pts = CHECKS.reduce((n, k) => n + (c[k.id].ok ? 1 : c[k.id].partial ? 0.5 : 0), 0);
  return pts / CHECKS.length;
}

export function edgeScore(transport: number, c: Checks): number {
  return Math.round(0.7 * transport + 30 * hardening(c));
}
