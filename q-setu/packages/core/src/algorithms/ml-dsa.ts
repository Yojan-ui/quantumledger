/**
 * ML-DSA-44 / 65 / 87 (NIST FIPS 204): Module-Lattice signatures, NIST categories 2, 3 and 5.
 * Thin adapters over @noble/post-quantum (pure, hedged signing).
 */
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { expandSeed } from "../seed";
import type { SignatureAlgorithm } from "../types";

type Noble = typeof ml_dsa65;

function adapt(
  id: string,
  name: string,
  level: 2 | 3 | 5,
  impl: Noble,
  sizes: SignatureAlgorithm["sizes"],
): SignatureAlgorithm {
  return {
    kind: "sig",
    id,
    name,
    standard: "FIPS 204",
    nistLevel: level,
    quantumSafe: true,
    sizes,
    keygen: (seed) => impl.keygen(seed && expandSeed(seed, id, 32)),
    sign: (message, secretKey) => impl.sign(message, secretKey),
    verify: (signature, message, publicKey) => {
      try {
        return impl.verify(signature, message, publicKey);
      } catch {
        return false;
      }
    },
  };
}

export const mlDsa44 = adapt("ml-dsa-44", "ML-DSA-44", 2, ml_dsa44, {
  publicKey: 1312,
  secretKey: 2560,
  output: 2420,
});
export const mlDsa65 = adapt("ml-dsa-65", "ML-DSA-65", 3, ml_dsa65, {
  publicKey: 1952,
  secretKey: 4032,
  output: 3309,
});
export const mlDsa87 = adapt("ml-dsa-87", "ML-DSA-87", 5, ml_dsa87, {
  publicKey: 2592,
  secretKey: 4896,
  output: 4627,
});
