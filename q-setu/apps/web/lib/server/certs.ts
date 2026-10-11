import "server-only";
import { bytesToBase64, createIdentity, getSig, utf8ToBytes } from "@qsetu/core";
import { canonicalCert, certDigest, type Certificate, type SignedCertificate } from "@/lib/certs";

const g = globalThis as unknown as {
  __qsetuCerts?: {
    issuer: ReturnType<typeof createIdentity>;
    registry: Map<string, SignedCertificate>;
  };
};
const s = (g.__qsetuCerts ??= { issuer: createIdentity("standard"), registry: new Map() });

export const issuerPublicKey = () => bytesToBase64(s.issuer.publicKey);

/** Deccan University signs the certificate with ML-DSA-65 (FIPS 204) and publishes it in the registry. */
export function issue(cert: Certificate): SignedCertificate {
  const t = performance.now();
  const signature = bytesToBase64(
    getSig("ml-dsa-65").sign(utf8ToBytes(canonicalCert(cert)), s.issuer.secretKey),
  );
  const signed: SignedCertificate = {
    cert,
    signature,
    alg: "ml-dsa-65",
    digest: certDigest(cert),
    signMs: performance.now() - t,
  };
  s.registry.set(cert.certificateId, signed);
  return signed;
}

export const lookup = (id: string) => s.registry.get(id);
