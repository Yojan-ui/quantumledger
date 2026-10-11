/** Shared by the university (server) and the employer's verifier (browser). Signatures are ML-DSA-65 (FIPS 204). */
import { base64ToBytes, bytesToBase64, getSig, utf8ToBytes } from "@qsetu/core";
import { sha256 } from "@noble/hashes/sha2.js";

export interface Certificate {
  certificateId: string;
  studentName: string;
  studentId: string;
  degree: string;
  grade: string;
  year: string;
  university: string;
}

export interface SignedCertificate {
  cert: Certificate;
  signature: string;
  alg: "ml-dsa-65";
  digest: string;
  signMs: number;
}

const FIELDS: (keyof Certificate)[] = [
  "certificateId",
  "studentName",
  "studentId",
  "degree",
  "grade",
  "year",
  "university",
];

export const canonicalCert = (c: Certificate) => JSON.stringify(FIELDS.map((f) => [f, c[f]]));
export const certDigest = (c: Certificate) =>
  bytesToBase64(sha256(utf8ToBytes(canonicalCert(c)))).replace(/=+$/, "");

/** The QR code on a printed certificate: its ID and a digest of exactly what's printed. */
export const qrPayload = (c: Certificate) =>
  JSON.stringify({ q: "qsetu-cert-v1", id: c.certificateId, d: certDigest(c) });

export type VerifyResult = { ok: true; ms: number } | { ok: false; ms: number; reason: string };

/** Employer-side check: the printed data must match the QR, and the registry copy must carry a valid university signature. */
export function verifyCertificate(
  presented: Certificate,
  qr: { id: string; d: string },
  registry: SignedCertificate,
  issuerKey: string,
): VerifyResult {
  const t = performance.now();
  const done = (r: { ok: true } | { ok: false; reason: string }): VerifyResult => ({
    ...r,
    ms: performance.now() - t,
  });
  if (qr.id !== presented.certificateId)
    return done({ ok: false, reason: "QR code belongs to a different certificate" });
  if (certDigest(presented) !== qr.d)
    return done({
      ok: false,
      reason: "Printed details don't match the QR digest: certificate was altered",
    });
  const sigOk = getSig("ml-dsa-65").verify(
    base64ToBytes(registry.signature),
    utf8ToBytes(canonicalCert(registry.cert)),
    base64ToBytes(issuerKey),
  );
  if (!sigOk)
    return done({
      ok: false,
      reason: "ML-DSA-65 verification failed: not signed by the university",
    });
  if (certDigest(registry.cert) !== qr.d)
    return done({ ok: false, reason: "Registry record doesn't match this certificate" });
  return done({ ok: true });
}
