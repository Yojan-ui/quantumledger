/**
 * QuantumLedger Web wire protocol: a request body sealed into a FIPS 203 hybrid envelope, and an
 * ML-DSA (FIPS 204) signature on the response that binds it to that request.
 */
import { concatBytes, utf8ToBytes } from "@qsetu/core";
import { sha256 } from "@noble/hashes/sha2.js";
import type { EnvelopeJSON } from "@qsetu/core";

export const SEALED_CONTENT_TYPE = "application/qsetu+json";
export const HEADER_SEALED = "x-qsetu";
export const HEADER_SIGNATURE = "x-qsetu-signature";

export interface SealedBody {
  qsetu: 1;
  /** The original Content-Type (e.g. multipart boundary included), restored after opening. */
  contentType: string;
  envelope: EnvelopeJSON;
}

export interface ServerPublicKeys {
  profile: "standard" | "edge";
  kid: string;
  kem: string;
  sig: string;
}

/** Bytes the server signs for a response: domain label, the request nonce, and the body hash. */
export const responseSigned = (requestNonce: Uint8Array, body: Uint8Array) =>
  concatBytes(utf8ToBytes("qsetu-v1/web-response"), requestNonce, sha256(body));
