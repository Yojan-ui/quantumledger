/** Server side of QuantumLedger Web: open sealed request bodies (FIPS 203) and sign responses (FIPS 204). */
import { sha256 } from "@noble/hashes/sha2.js";
import {
  bytesToBase64,
  bytesToHex,
  envelopeFromJSON,
  getProfile,
  getSig,
  keyId,
  open,
  type KeyPair,
  type ProfileId,
} from "@qsetu/core";
import {
  responseSigned,
  SEALED_CONTENT_TYPE,
  type SealedBody,
  type ServerPublicKeys,
} from "./protocol";

export interface WebShieldKeys {
  profile: ProfileId;
  kem: KeyPair;
  sig: KeyPair;
}

export function publicKeysOf(k: WebShieldKeys): ServerPublicKeys {
  return {
    profile: k.profile,
    kid: keyId(k.kem.publicKey),
    kem: bytesToBase64(k.kem.publicKey),
    sig: bytesToBase64(k.sig.publicKey),
  };
}

export const isSealed = (contentType: string | null | undefined) =>
  (contentType ?? "").startsWith(SEALED_CONTENT_TYPE);

export interface OpenedRequest {
  bytes: Uint8Array;
  contentType: string;
  nonce: Uint8Array;
  algIds: SealedBody["envelope"]["algIds"];
  sealedBytes: number;
  ciphertextSha256: string;
}

export function openSealedBody(raw: string, keys: WebShieldKeys): OpenedRequest {
  const sealed = JSON.parse(raw) as SealedBody;
  if (sealed.qsetu !== 1) throw new Error("Not a QuantumLedger sealed body");
  const env = envelopeFromJSON(sealed.envelope);
  return {
    bytes: open(env, keys.kem),
    contentType: sealed.contentType,
    nonce: env.nonce,
    algIds: env.algIds,
    sealedBytes: raw.length,
    ciphertextSha256: bytesToHex(sha256(env.ct)),
  };
}

export function signResponse(
  body: Uint8Array,
  requestNonce: Uint8Array,
  keys: WebShieldKeys,
): string {
  return bytesToBase64(
    getSig(getProfile(keys.profile).sig).sign(
      responseSigned(requestNonce, body),
      keys.sig.secretKey,
    ),
  );
}
