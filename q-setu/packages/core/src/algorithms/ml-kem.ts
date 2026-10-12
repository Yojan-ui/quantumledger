/**
 * ML-KEM-512 / 768 / 1024 (NIST FIPS 203): Module-Lattice KEMs, NIST categories 1, 3 and 5.
 * Thin adapters over @noble/post-quantum.
 */
import { ml_kem1024, ml_kem512, ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { expandSeed } from "../seed";
import type { KemAlgorithm } from "../types";

type Noble = typeof ml_kem768;

function adapt(
  id: string,
  name: string,
  level: 1 | 3 | 5,
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
export const mlKem1024 = adapt("ml-kem-1024", "ML-KEM-1024", 5, ml_kem1024, {
  publicKey: 1568,
  secretKey: 3168,
  output: 1568,
});
