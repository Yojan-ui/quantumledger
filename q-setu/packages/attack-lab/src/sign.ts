/**
 * Signing evidence. The same scheme as Shield's signed asset manifest (packages/shield's
 * manifest-format): canonical JSON (keys sorted at every level), a domain-separation prefix, and an
 * ML-DSA-65 (FIPS 204) signature from a Shield identity. The identity is the same key file the
 * Shield proxy uses (`qsetu-shield --identity`), loaded by its own loader.
 *
 * ML-DSA is a post-quantum signature: a record signed today can't be forged later by someone with a
 * large quantum computer, which is what makes old evidence still worth something years from now.
 */
import { createHash } from "node:crypto";
import { base64ToBytes, bytesToBase64, getSig, keyId, type Identity } from "@qsetu/core";
import { canonical } from "@qsetu/shield/manifest-format";
import { loadOrCreateIdentity } from "@qsetu/shield-proxy";
import type { SignedRecord } from "./types";

const DOMAIN_SEP = "qsetu-attack-lab-v1\n";

export type Unsigned<T> = Omit<SignedRecord<T>, "hash" | "sig">;

const bytesOf = (r: Unsigned<unknown>) => new TextEncoder().encode(DOMAIN_SEP + canonical(r));

export interface Signer {
  keyId: string;
  publicKey: string;
  sign<T>(r: Omit<Unsigned<T>, "alg" | "keyId">): SignedRecord<T>;
}

export function createSigner(identity: Identity): Signer {
  if (identity.profile !== "standard")
    throw new Error("Attack Lab signs with ML-DSA-65: use a standard-profile identity");
  const id = keyId(identity.publicKey);
  const mldsa = getSig("ml-dsa-65");
  return {
    keyId: id,
    publicKey: bytesToBase64(identity.publicKey),
    sign<T>(r: Omit<Unsigned<T>, "alg" | "keyId">): SignedRecord<T> {
      const unsigned: Unsigned<T> = { ...r, alg: "ML-DSA-65", keyId: id };
      const bytes = bytesOf(unsigned);
      return {
        ...unsigned,
        hash: createHash("sha256").update(bytes).digest("hex"),
        sig: bytesToBase64(mldsa.sign(bytes, identity.secretKey)),
      };
    },
  };
}

/** Loads the Shield identity file at `path`, creating it (0600) on first use. */
export const loadSigner = (path: string) => createSigner(loadOrCreateIdentity(path, "standard"));

export type RecordCheck =
  { ok: true } | { ok: false; reason: "format" | "key" | "hash" | "signature" };

/** Checks one record's hash and signature against a public key (base64). */
export function verifyRecord(r: SignedRecord, publicKey: string): RecordCheck {
  if (!r || r.v !== 1 || r.alg !== "ML-DSA-65" || typeof r.sig !== "string")
    return { ok: false, reason: "format" };
  const pk = base64ToBytes(publicKey);
  if (r.keyId !== keyId(pk)) return { ok: false, reason: "key" };
  const { hash, sig, ...unsigned } = r;
  const bytes = bytesOf(unsigned);
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    return { ok: false, reason: "hash" };
  let s: Uint8Array;
  try {
    s = base64ToBytes(sig);
  } catch {
    return { ok: false, reason: "format" };
  }
  return getSig("ml-dsa-65").verify(s, bytes, pk)
    ? { ok: true }
    : { ok: false, reason: "signature" };
}
