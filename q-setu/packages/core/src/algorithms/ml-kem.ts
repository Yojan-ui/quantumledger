/**
 * ML-KEM-512 / ML-KEM-768 (NIST FIPS 203): Module-Lattice KEMs, NIST categories 1 and 3.
 * Thin adapters over @noble/post-quantum.
 */
import { ml_kem512, ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { expandSeed } from "../seed";
import type { KemAlgorithm } from "../types";

type Noble = typeof ml_kem768;

function adapt(
  id: string,
  name: string,
  level: 1 | 3,
  impl: Noble,
  sizes: KemAlgorithm["sizes"],
): KemAlgorithm {
  return {
    kind: "kem",
    id,
    name,
    standard: "FIPS 203",
    nistLevel: level,
    quantumSafe: true,
    sizes,
    components: [{ id, ciphertextBytes: sizes.output }],
    keygen: (seed) => impl.keygen(seed && expandSeed(seed, id, 64)),
    encapsulate(publicKey) {
      const { cipherText, sharedSecret } = impl.encapsulate(publicKey);
      return { ciphertext: cipherText, sharedSecret };
    },
    decapsulate: (ciphertext, secretKey) => impl.decapsulate(ciphertext, secretKey),
  };
}

export const mlKem512 = adapt("ml-kem-512", "ML-KEM-512", 1, ml_kem512, {
  publicKey: 800,
  secretKey: 1632,
  output: 768,
});
export const mlKem768 = adapt("ml-kem-768", "ML-KEM-768", 3, ml_kem768, {
  publicKey: 1184,
  secretKey: 2400,
  output: 1088,
});
