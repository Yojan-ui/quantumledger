/**
 * INSECURE_DEMO_ONLY: "today's" message protection for the side-by-side demo.
 * RSA key transport (tiny 40-bit stand-in) wraps a random AES-256-GCM key, and the sender
 * signs with ECDSA P-256. This mirrors classic hybrid encryption (like TLS_RSA). Its only
 * weakness is the factorable RSA modulus, which is exactly what Q-Day exploits.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { p256 } from "@noble/curves/nist.js";
import { bytesToHex, hexToBytes } from "@qsetu/core";
import {
  tinyRsaDecrypt,
  tinyRsaEncrypt,
  type TinyRsaKeyPair,
  type TinyRsaPublicKey,
} from "./tiny-rsa";

export const CLASSICAL_ALG = "INSECURE_DEMO_ONLY tiny-RSA-40 + AES-256-GCM + ECDSA-P256";

export interface ClassicalWire {
  alg: typeof CLASSICAL_ALG;
  modulus: string;
  exponent: string;
  wrappedKey: string[];
  nonce: string;
  ciphertext: string;
  signature: string;
}

const AES_KEY_BYTES = 32;

function random(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

function signedBytes(w: Omit<ClassicalWire, "signature">): Uint8Array {
  return new TextEncoder().encode(
    [w.modulus, w.wrappedKey.join("."), w.nonce, w.ciphertext].join("|"),
  );
}

export function classicalSeal(
  payload: Uint8Array,
  recipient: TinyRsaPublicKey,
  senderEcdsaSecret: Uint8Array,
): ClassicalWire {
  const key = random(AES_KEY_BYTES);
  const nonce = random(12);
  const unsigned = {
    alg: CLASSICAL_ALG,
    modulus: recipient.n.toString(16),
    exponent: recipient.e.toString(16),
    wrappedKey: tinyRsaEncrypt(recipient, key).map((b) => b.toString(16)),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(gcm(key, nonce).encrypt(payload)),
  } as const;
  return {
    ...unsigned,
    signature: bytesToHex(p256.sign(signedBytes(unsigned), senderEcdsaSecret)),
  };
}

export function classicalVerify(wire: ClassicalWire, senderEcdsaPublic: Uint8Array): boolean {
  try {
    return p256.verify(hexToBytes(wire.signature), signedBytes(wire), senderEcdsaPublic);
  } catch {
    return false;
  }
}

/** Decrypts with a private exponent: the legitimate recipient's, or one recovered by factoring. */
export function classicalOpenWithD(wire: ClassicalWire, d: bigint): Uint8Array {
  const n = BigInt(`0x${wire.modulus}`);
  const key = tinyRsaDecrypt(
    n,
    d,
    wire.wrappedKey.map((h) => BigInt(`0x${h}`)),
    AES_KEY_BYTES,
  );
  return gcm(key, hexToBytes(wire.nonce)).decrypt(hexToBytes(wire.ciphertext));
}

export function classicalOpen(wire: ClassicalWire, recipient: TinyRsaKeyPair): Uint8Array {
  return classicalOpenWithD(wire, recipient.d);
}

export function classicalWireSize(w: ClassicalWire): number {
  // Each wrapped block is 5 bytes on the wire (40-bit modulus).
  return (
    w.wrappedKey.length * 5 + w.nonce.length / 2 + w.ciphertext.length / 2 + w.signature.length / 2
  );
}
