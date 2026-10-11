/**
 * X25519 (RFC 7748) wrapped as a KEM: the "ciphertext" is an ephemeral public key and the
 * shared secret is HKDF-SHA256 over the DH output, bound to both public keys (DHKEM-style,
 * cf. RFC 9180 §4.1). Classical only: Shor's algorithm breaks it.
 */
import { x25519 as curve } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes, utf8ToBytes } from "../encoding";
import { expandSeed } from "../seed";
import type { Bytes, KemAlgorithm } from "../types";

const LABEL = utf8ToBytes("qsetu-x25519-kem");

function derive(dh: Bytes, ephemeralPk: Bytes, recipientPk: Bytes): Bytes {
  return hkdf(sha256, dh, undefined, concatBytes(LABEL, ephemeralPk, recipientPk), 32);
}

export const x25519Kem: KemAlgorithm = {
  kind: "kem",
  id: "x25519",
  name: "X25519",
  standard: "RFC 7748",
  nistLevel: 0,
  quantumSafe: false,
  sizes: { publicKey: 32, secretKey: 32, output: 32 },
  components: [{ id: "x25519", ciphertextBytes: 32 }],
  keygen: (seed) => curve.keygen(seed && expandSeed(seed, "x25519", 32)),
  encapsulate(publicKey) {
    const eph = curve.keygen();
    const dh = curve.getSharedSecret(eph.secretKey, publicKey);
    return { ciphertext: eph.publicKey, sharedSecret: derive(dh, eph.publicKey, publicKey) };
  },
  decapsulate(ciphertext, secretKey) {
    const dh = curve.getSharedSecret(secretKey, ciphertext);
    return derive(dh, ciphertext, curve.getPublicKey(secretKey));
  },
};
