/**
 * The signed asset manifest's format, signing and verification: everything about it that runs
 * without Node (a browser or a Web Worker can import this file). Building one from disk and checking
 * a live site are in ./manifest.
 */
import { base64ToBytes, bytesToBase64, getSig, keyId, type Identity } from "@qsetu/core";

export const MANIFEST_PATH = "/.well-known/qsetu-manifest.json";
const DOMAIN_SEP = "qsetu-manifest-v1\n";

export interface Manifest {
  v: 1;
  alg: "ML-DSA-65";
  keyId: string;
  site: string;
  generated: string;
  /** URL path → "sha384-<base64>". */
  files: Record<string, string>;
  signature: string;
}

/** JSON with object keys sorted at every level: the exact bytes that get signed. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

const signedBytes = (m: Omit<Manifest, "signature">) =>
  new TextEncoder().encode(DOMAIN_SEP + canonical(m));

/** Signs a file list with ML-DSA-65. */
export function signManifest(o: {
  site: string;
  files: Record<string, string>;
  identity: Identity;
  now?: Date;
}): Manifest {
  if (o.identity.profile !== "standard")
    throw new Error("The manifest is signed with ML-DSA-65 (the standard profile)");
  const unsigned = {
    v: 1 as const,
    alg: "ML-DSA-65" as const,
    keyId: keyId(o.identity.publicKey),
    site: o.site,
    generated: (o.now ?? new Date()).toISOString(),
    files: o.files,
  };
  const signature = getSig("ml-dsa-65").sign(signedBytes(unsigned), o.identity.secretKey);
  return { ...unsigned, signature: bytesToBase64(signature) };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "format" | "key" | "signature" };

/** Checks the signature against the pinned public key (base64 or bytes). */
export function verifyManifest(m: unknown, publicKey: string | Uint8Array): VerifyResult {
  const pk = typeof publicKey === "string" ? base64ToBytes(publicKey) : publicKey;
  const x = m as Manifest;
  if (
    !x ||
    x.v !== 1 ||
    x.alg !== "ML-DSA-65" ||
    typeof x.signature !== "string" ||
    typeof x.files !== "object"
  )
    return { ok: false, reason: "format" };
  if (x.keyId !== keyId(pk)) return { ok: false, reason: "key" };
  const { signature, ...unsigned } = x;
  let sig: Uint8Array;
  try {
    sig = base64ToBytes(signature);
  } catch {
    return { ok: false, reason: "format" };
  }
  return getSig("ml-dsa-65").verify(sig, signedBytes(unsigned), pk)
    ? { ok: true }
    : { ok: false, reason: "signature" };
}
