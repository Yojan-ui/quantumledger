/**
 * SLH-DSA-SHA2-128f (NIST FIPS 205): stateless hash-based signature, NIST category 1.
 * Large, slow signatures, but security rests only on hash functions. Good for long-lived roots.
 */
import { slh_dsa_sha2_128f } from "@noble/post-quantum/slh-dsa.js";
import { expandSeed } from "../seed";
import type { SignatureAlgorithm } from "../types";

export const slhDsa128f: SignatureAlgorithm = {
  kind: "sig",
  id: "slh-dsa-sha2-128f",
  name: "SLH-DSA-SHA2-128f",
  standard: "FIPS 205",
  nistLevel: 1,
  quantumSafe: true,
  sizes: { publicKey: 32, secretKey: 64, output: 17088 },
  keygen: (seed) => slh_dsa_sha2_128f.keygen(seed && expandSeed(seed, "slh-dsa-sha2-128f", 48)),
  sign: (message, secretKey) => slh_dsa_sha2_128f.sign(message, secretKey),
  verify: (signature, message, publicKey) => {
    try {
      return slh_dsa_sha2_128f.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  },
};
