/**
 * Ed25519 (RFC 8032), the classical baseline signature. Shor's algorithm breaks it;
 * kept in the registry so deployments can migrate gradually.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { expandSeed } from "../seed";
import type { SignatureAlgorithm } from "../types";

export const ed25519Sig: SignatureAlgorithm = {
  kind: "sig",
  id: "ed25519",
  name: "Ed25519",
  standard: "RFC 8032",
  nistLevel: 0,
  quantumSafe: false,
  sizes: { publicKey: 32, secretKey: 32, output: 64 },
  keygen: (seed) => ed25519.keygen(seed && expandSeed(seed, "ed25519", 32)),
  sign: (message, secretKey) => ed25519.sign(message, secretKey),
  verify: (signature, message, publicKey) => {
    try {
      return ed25519.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  },
};
