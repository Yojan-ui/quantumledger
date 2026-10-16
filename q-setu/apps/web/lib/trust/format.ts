/**
 * "Zero trust, made visible": the wire formats shared by the server and the browser's worker. Runs
 * anywhere with WebCrypto (Node ≥ 20, browsers, Web Workers).
 *
 * Sealed headlines (POST /api/trust/headlines). The browser sends its X25519 + ML-KEM-768 public key;
 * the server encapsulates to it once (the handshake), and seals each headline with AES-256-GCM:
 *   key_i = HKDF-SHA256(ikm = shared secret, salt = nonce_i, info = "qsetu-v1/headline/" || id_i)
 *   ct_i  = AES-256-GCM(key_i, nonce_i, aad = id_i).Encrypt(headline_i)
 *   sig   = ML-DSA-65.Sign(site key, "qsetu-headlines-v1\n" || parts(ts, recipient pk, kemCt, id_i, nonce_i, ct_i, …))
 * One signature covers the whole bundle; the browser verifies it before it decrypts any headline.
 *
 * Signed responses (any API route wrapped with lib/server/signed):
 *   x-qsetu-hash = "sha384-" || base64(SHA-384(body))
 *   x-qsetu-sig  = ML-DSA-65.Sign(site key, "qsetu-resp-v1\n" METHOD "\n" path "\n" ts "\n" hash)
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, encodeParts, utf8ToBytes } from "@qsetu/core";

export const HEADLINES_PATH = "/api/trust/headlines";
export const SIG_HEADER = "x-qsetu-sig";
export const HASH_HEADER = "x-qsetu-hash";
export const TS_HEADER = "x-qsetu-ts";
/** Signed responses older (or newer) than this are rejected as replays. */
export const MAX_SKEW_MS = 10 * 60_000;

/** A headline's id: the first 8 bytes of SHA-256(text), hex. */
export const headlineId = (text: string) => bytesToHex(sha256(utf8ToBytes(text)).subarray(0, 8));

export interface SealedItem {
  id: string;
  /** Base64. */
  nonce: string;
  ct: string;
}

export interface SealedBundle {
  v: 1;
  kem: "X25519MLKEM768";
  sig: "ML-DSA-65";
  aead: "AES-256-GCM";
  keyId: string;
  ts: number;
  /** Server's encapsulation time, ms (compute only). */
  encapsMs: number;
  kemCt: string;
  items: SealedItem[];
  signature: string;
}

export function headlinesSignedBytes(
  ts: number,
  recipient: Uint8Array,
  kemCt: Uint8Array,
  items: { id: string; nonce: Uint8Array; ct: Uint8Array }[],
): Uint8Array {
  return concatBytes(
    utf8ToBytes("qsetu-headlines-v1\n"),
    encodeParts(
      utf8ToBytes(String(ts)),
      recipient,
      kemCt,
      ...items.flatMap((i) => [utf8ToBytes(i.id), i.nonce, i.ct]),
    ),
  );
}

/** The AES-256-GCM key for one headline. */
export async function headlineKey(
  sharedSecret: Uint8Array,
  nonce: Uint8Array,
  id: string,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", sharedSecret as BufferSource, "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: nonce as BufferSource,
      info: utf8ToBytes(`qsetu-v1/headline/${id}`) as BufferSource,
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export const responseSignedBytes = (method: string, path: string, ts: number, hash: string) =>
  utf8ToBytes(`qsetu-resp-v1\n${method.toUpperCase()}\n${path}\n${ts}\n${hash}`);

export async function sha384(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-384", bytes as BufferSource));
  let bin = "";
  for (const b of d) bin += String.fromCharCode(b);
  return `sha384-${btoa(bin)}`;
}
