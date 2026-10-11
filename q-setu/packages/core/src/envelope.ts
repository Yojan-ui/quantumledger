/**
 * Q-Setu envelope v1: one-shot hybrid public-key encryption (FIPS 203 KEM + AES-256-GCM, SP 800-38D)
 * with an optional ML-DSA signature (FIPS 204). Used by Web shield and Vault.
 *
 *   header = canonical JSON { v, profile, algIds, rid, sid }
 *   (kemCt, ss) = KEM.Encapsulate(recipientPk)
 *   key  = HKDF-SHA256(ss, salt = nonce, info = "qsetu-v1/aead" || header)
 *   ct   = AES-256-GCM(key, nonce, aad = header || aad).Encrypt(payload)
 *   sig  = SIG.Sign("qsetu-v1/sig" || header || kemCt || nonce || ct || aad)   (optional)
 *
 * When a signature is present, `open` verifies it before decrypting.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { base64ToBytes, bytesToBase64, concatBytes, encodeParts, utf8ToBytes } from "./encoding";
import { getKem, getProfile, getSig, type KemId, type ProfileId, type SigId } from "./registry";
import { keyId } from "./session";
import type { Bytes, KeyPair } from "./types";

export const ENVELOPE_VERSION = 1;

export interface AlgIds {
  kem: KemId;
  sig: SigId | null;
  kdf: "hkdf-sha256";
  aead: "aes-256-gcm";
}

export interface Envelope {
  v: typeof ENVELOPE_VERSION;
  profile: ProfileId;
  algIds: AlgIds;
  /** Recipient KEM key ID and sender signing key ID (null when unsigned). */
  rid: string;
  sid: string | null;
  kemCt: Bytes;
  nonce: Bytes;
  ct: Bytes;
  sig: Bytes | null;
}

export class EnvelopeError extends Error {
  constructor(
    readonly reason: "version" | "algorithm" | "recipient" | "signature" | "decrypt",
    message: string,
  ) {
    super(message);
    this.name = "EnvelopeError";
  }
}

export { keyId };

function headerBytes(e: Pick<Envelope, "v" | "profile" | "algIds" | "rid" | "sid">): Bytes {
  const { kem, sig, kdf, aead } = e.algIds;
  return utf8ToBytes(
    JSON.stringify({
      v: e.v,
      profile: e.profile,
      algIds: { kem, sig, kdf, aead },
      rid: e.rid,
      sid: e.sid,
    }),
  );
}

const aeadKey = (ss: Bytes, nonce: Bytes, header: Bytes) =>
  hkdf(sha256, ss, nonce, concatBytes(utf8ToBytes("qsetu-v1/aead"), header), 32);

const signedBytes = (header: Bytes, kemCt: Bytes, nonce: Bytes, ct: Bytes, aad: Bytes) =>
  concatBytes(utf8ToBytes("qsetu-v1/sig"), encodeParts(header, kemCt, nonce, ct, aad));

export interface SealOptions {
  profile?: ProfileId;
  /** Sign with this ML-DSA key (or whatever the profile's sig is). Omit for anonymous senders. */
  signer?: KeyPair;
  /** Extra bytes bound into the ciphertext and signature, e.g. a database record ID. */
  aad?: Bytes;
}

export function seal(payload: Bytes, recipientPublicKey: Bytes, opts: SealOptions = {}): Envelope {
  const profile = getProfile(opts.profile ?? "standard");
  const aad = opts.aad ?? new Uint8Array(0);
  const meta = {
    v: ENVELOPE_VERSION,
    profile: profile.id,
    algIds: {
      kem: profile.kem,
      sig: opts.signer ? profile.sig : null,
      kdf: "hkdf-sha256",
      aead: "aes-256-gcm",
    } as AlgIds,
    rid: keyId(recipientPublicKey),
    sid: opts.signer ? keyId(opts.signer.publicKey) : null,
  } as const;
  const header = headerBytes(meta);
  const { ciphertext: kemCt, sharedSecret } = getKem(profile.kem).encapsulate(recipientPublicKey);
  const nonce = randomBytes(12);
  const ct = gcm(aeadKey(sharedSecret, nonce, header), nonce, concatBytes(header, aad)).encrypt(
    payload,
  );
  const sig = opts.signer
    ? getSig(profile.sig).sign(signedBytes(header, kemCt, nonce, ct, aad), opts.signer.secretKey)
    : null;
  return { ...meta, kemCt, nonce, ct, sig };
}

function checkHeader(env: Envelope): void {
  if (env.v !== ENVELOPE_VERSION)
    throw new EnvelopeError("version", `Unsupported envelope version ${String(env.v)}`);
  const profile = getProfile(env.profile);
  // A profile pins its algorithms, so a downgraded header is rejected outright.
  if (
    env.algIds.kem !== profile.kem ||
    (env.algIds.sig !== null && env.algIds.sig !== profile.sig)
  ) {
    throw new EnvelopeError("algorithm", "Algorithm IDs don't match the profile");
  }
  if (env.algIds.kdf !== "hkdf-sha256" || env.algIds.aead !== "aes-256-gcm")
    throw new EnvelopeError("algorithm", "Unsupported KDF/AEAD");
  if (env.kemCt.length !== getKem(env.algIds.kem).sizes.output)
    throw new EnvelopeError("algorithm", "Bad KEM ciphertext length");
}

/** Verifies the signature only, so an intermediary can authenticate without decrypting. */
export function verifyEnvelope(
  env: Envelope,
  senderPublicKey: Bytes,
  aad: Bytes = new Uint8Array(0),
): boolean {
  checkHeader(env);
  if (!env.sig || !env.algIds.sig || env.sid !== keyId(senderPublicKey)) return false;
  return getSig(env.algIds.sig).verify(
    env.sig,
    signedBytes(headerBytes(env), env.kemCt, env.nonce, env.ct, aad),
    senderPublicKey,
  );
}

export interface OpenOptions {
  /** Required if the envelope is signed. Pass it to insist on a signature from this key. */
  senderPublicKey?: Bytes;
  aad?: Bytes;
}

export function open(env: Envelope, recipient: KeyPair, opts: OpenOptions = {}): Bytes {
  checkHeader(env);
  const aad = opts.aad ?? new Uint8Array(0);
  if (env.rid !== keyId(recipient.publicKey))
    throw new EnvelopeError("recipient", "Envelope is addressed to a different key");
  if (env.sig || opts.senderPublicKey) {
    if (!opts.senderPublicKey || !verifyEnvelope(env, opts.senderPublicKey, aad)) {
      throw new EnvelopeError(
        "signature",
        `${env.algIds.sig ?? "ML-DSA"} verification failed: envelope rejected`,
      );
    }
  }
  const header = headerBytes(env);
  try {
    const ss = getKem(env.algIds.kem).decapsulate(env.kemCt, recipient.secretKey);
    return gcm(aeadKey(ss, env.nonce, header), env.nonce, concatBytes(header, aad)).decrypt(env.ct);
  } catch (err) {
    throw new EnvelopeError("decrypt", `Decryption failed: ${(err as Error).message}`);
  }
}

export interface EnvelopeJSON {
  v: number;
  profile: ProfileId;
  algIds: AlgIds;
  rid: string;
  sid: string | null;
  kemCt: string;
  nonce: string;
  ct: string;
  sig: string | null;
}

export function envelopeToJSON(e: Envelope): EnvelopeJSON {
  return {
    ...e,
    kemCt: bytesToBase64(e.kemCt),
    nonce: bytesToBase64(e.nonce),
    ct: bytesToBase64(e.ct),
    sig: e.sig && bytesToBase64(e.sig),
  };
}

export function envelopeFromJSON(j: EnvelopeJSON): Envelope {
  return {
    v: j.v as typeof ENVELOPE_VERSION,
    profile: j.profile,
    algIds: j.algIds,
    rid: j.rid,
    sid: j.sid,
    kemCt: base64ToBytes(j.kemCt),
    nonce: base64ToBytes(j.nonce),
    ct: base64ToBytes(j.ct),
    sig: j.sig ? base64ToBytes(j.sig) : null,
  };
}

/** Bytes on the wire for the binary fields: the KEM ciphertext, nonce, ciphertext and signature. */
export function envelopeSize(e: Envelope): number {
  return e.kemCt.length + e.nonce.length + e.ct.length + (e.sig?.length ?? 0);
}

/** Splits a hybrid kemCt into per-component pieces for display. */
export function kemComponents(e: Envelope): { alg: string; bytes: Bytes }[] {
  let off = 0;
  return getKem(e.algIds.kem).components.map((c) => {
    const bytes = e.kemCt.subarray(off, off + c.ciphertextBytes);
    off += c.ciphertextBytes;
    return { alg: c.id, bytes };
  });
}
