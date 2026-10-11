/**
 * Key generation and one-shot sealing/signing (FIPS 203 hybrid KEM, FIPS 204 ML-DSA).
 */
import {
  base64ToBytes,
  bytesToBase64,
  envelopeFromJSON,
  envelopeToJSON,
  getKem,
  getProfile,
  getSig,
  keyId,
  open as coreOpen,
  seal as coreSeal,
  type EnvelopeJSON,
  type KeyPair,
  type ProfileId,
} from "@qsetu/core";
import { asJSON, toBytes, type Data } from "./data";

export interface Keys {
  profile: ProfileId;
  /** Hybrid X25519 + ML-KEM key pair: others seal to `kem.publicKey`. */
  kem: KeyPair;
  /** ML-DSA key pair: you sign with `sig.secretKey`. */
  sig: KeyPair;
}

export interface PublicKeys {
  profile: ProfileId;
  kem: string;
  sig: string;
  kid: string;
}

/** Pass a secret seed (≥ 32 bytes) to derive the same keys every time, e.g. from an HSM backup. */
export function generateKeys(profile: ProfileId = "standard", seed?: Uint8Array): Keys {
  const p = getProfile(profile);
  return { profile, kem: getKem(p.kem).keygen(seed), sig: getSig(p.sig).keygen(seed) };
}

/** The shareable half of `Keys`, base64-encoded. Never includes secret keys. */
export function publicKeys(keys: Keys): PublicKeys {
  return {
    profile: keys.profile,
    kem: bytesToBase64(keys.kem.publicKey),
    sig: bytesToBase64(keys.sig.publicKey),
    kid: keyId(keys.kem.publicKey),
  };
}

const bytesOf = (k: string | Uint8Array) => (typeof k === "string" ? base64ToBytes(k) : k);

/** Encrypt `data` so only the holder of `to` can read it. Pass `from` to also sign it. */
export function seal(data: Data, to: PublicKeys | Uint8Array, from?: Keys): EnvelopeJSON {
  const recipient = to instanceof Uint8Array ? to : bytesOf(to.kem);
  const profile = to instanceof Uint8Array ? (from?.profile ?? "standard") : to.profile;
  return envelopeToJSON(coreSeal(toBytes(data), recipient, { profile, signer: from?.sig }));
}

/** Decrypt an envelope. Pass `from` to require a valid signature from that sender. */
export function open(envelope: EnvelopeJSON, keys: Keys, from?: PublicKeys): Uint8Array {
  return coreOpen(envelopeFromJSON(envelope), keys.kem, {
    senderPublicKey: from ? bytesOf(from.sig) : undefined,
  });
}

export const openJSON = <T = unknown>(envelope: EnvelopeJSON, keys: Keys, from?: PublicKeys): T =>
  asJSON<T>(open(envelope, keys, from));

/** Detached ML-DSA signature, base64. */
export function sign(data: Data, keys: Keys): string {
  return bytesToBase64(
    getSig(getProfile(keys.profile).sig).sign(toBytes(data), keys.sig.secretKey),
  );
}

export function verify(data: Data, signature: string, signer: PublicKeys): boolean {
  return getSig(getProfile(signer.profile).sig).verify(
    base64ToBytes(signature),
    toBytes(data),
    bytesOf(signer.sig),
  );
}
