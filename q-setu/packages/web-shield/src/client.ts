/** Browser side of Q-Setu Web: seal request bodies (FIPS 203 hybrid KEM) and verify signed responses (FIPS 204). */
import { base64ToBytes, envelopeToJSON, getProfile, getSig, seal } from "@qsetu/core";
import { responseSigned, type SealedBody, type ServerPublicKeys } from "./protocol";

export interface SealResult {
  body: string;
  nonce: Uint8Array;
  plainBytes: number;
  sealedBytes: number;
  ms: number;
}

export function sealBody(
  bytes: Uint8Array,
  contentType: string,
  server: ServerPublicKeys,
): SealResult {
  const t = performance.now();
  const env = seal(bytes, base64ToBytes(server.kem), { profile: server.profile });
  const sealed: SealedBody = { qsetu: 1, contentType, envelope: envelopeToJSON(env) };
  const body = JSON.stringify(sealed);
  return {
    body,
    nonce: env.nonce,
    plainBytes: bytes.length,
    sealedBytes: body.length,
    ms: performance.now() - t,
  };
}

export function verifyResponse(
  body: Uint8Array,
  signatureB64: string | null,
  requestNonce: Uint8Array,
  server: ServerPublicKeys,
): boolean {
  if (!signatureB64) return false;
  return getSig(getProfile(server.profile).sig).verify(
    base64ToBytes(signatureB64),
    responseSigned(requestNonce, body),
    base64ToBytes(server.sig),
  );
}
