/**
 * What the home-page scan result says beyond the score, derived only from the recorded handshake
 * (ScanView.probe) and the scanner's findings. Shared by the result card and its tests.
 */
import type { ScanView } from "./scan-types";

/** The scanner's severity weights (@qsetu/core SEVERITY_WEIGHT; a unit test keeps them equal). */
export const SCORE_WEIGHTS = { critical: 40, high: 25, medium: 10, low: 3, info: 0 } as const;

export type Breaks = { part: string; text: string; safe: boolean };

/** "What a quantum computer breaks here": one line per part of the connection. */
export function quantumBreaks(p: ScanView["probe"]): Breaks[] {
  const out: Breaks[] = [];
  out.push(
    p.hybridPq
      ? {
          part: "Key exchange",
          text: `${p.group} adds ML-KEM-768 to X25519: recorded traffic stays sealed even if X25519 falls to Shor's algorithm.`,
          safe: true,
        }
      : {
          part: "Key exchange",
          text: `${p.group === "unknown" ? "The classical key exchange" : p.group} falls to Shor's algorithm: traffic recorded today can be decrypted later (harvest now, decrypt later).`,
          safe: false,
        },
  );
  if (/^(RSA|ECDSA|EC|Ed)/i.test(p.certKey))
    out.push({
      part: "Certificate",
      text: `The ${p.certKey} certificate key can be broken by Shor's algorithm, so a quantum attacker could forge this server's identity.`,
      safe: false,
    });
  if (p.protocol && p.protocol !== "TLSv1.3")
    out.push({
      part: "Protocol",
      text: `${p.protocol} cannot negotiate post-quantum key exchange at all.`,
      safe: false,
    });
  return out;
}

/** Recommended fixes, ML-KEM for key exchange and ML-DSA for signatures, only where needed. */
export function recommendedFixes(p: ScanView["probe"]): string[] {
  const out: string[] = [];
  if (p.protocol && p.protocol !== "TLSv1.3")
    out.push("Move to TLS 1.3, the only version that negotiates hybrid post-quantum groups.");
  if (!p.hybridPq)
    out.push(
      "Key exchange: enable X25519MLKEM768 (ML-KEM-768, NIST FIPS 203) alongside X25519 on the server or its load balancer.",
    );
  if (/^(RSA|ECDSA|EC|Ed)/i.test(p.certKey))
    out.push(
      "Certificates: plan ML-DSA-65 (NIST FIPS 204) signatures once your CA issues them; inventory where this key is used now.",
    );
  if (!out.length) out.push("Nothing urgent in this handshake. Keep monitoring the certificate.");
  return out;
}
