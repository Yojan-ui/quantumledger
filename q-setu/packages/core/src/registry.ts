/**
 * Crypto-agile algorithm registry and profiles (FIPS 203 / 204 / 205 plus classical baselines).
 * Call sites look algorithms up by ID or profile, so migrating is a config change, not a rewrite.
 */
import { ed25519Sig } from "./algorithms/ed25519";
import { mlDsa44, mlDsa65 } from "./algorithms/ml-dsa";
import { mlKem512, mlKem768 } from "./algorithms/ml-kem";
import { slhDsa128f } from "./algorithms/slh-dsa";
import { x25519Kem } from "./algorithms/x25519";
import { hybridX25519MlKem512, hybridX25519MlKem768 } from "./hybrid-kem";
import type { KemAlgorithm, SignatureAlgorithm } from "./types";

export const registry = {
  kem: {
    x25519: x25519Kem,
    "ml-kem-512": mlKem512,
    "ml-kem-768": mlKem768,
    "hybrid-x25519-mlkem512": hybridX25519MlKem512,
    "hybrid-x25519-mlkem768": hybridX25519MlKem768,
  },
  sig: {
    "ml-dsa-44": mlDsa44,
    "ml-dsa-65": mlDsa65,
    "slh-dsa-sha2-128f": slhDsa128f,
    ed25519: ed25519Sig,
  },
} as const satisfies { kem: Record<string, KemAlgorithm>; sig: Record<string, SignatureAlgorithm> };

export type KemId = keyof typeof registry.kem;
export type SigId = keyof typeof registry.sig;

export interface Profile {
  id: ProfileId;
  label: string;
  kem: KemId;
  sig: SigId;
  /** The plain ML-KEM inside the hybrid, used by the session handshake. */
  pqKem: "ml-kem-512" | "ml-kem-768";
  description: string;
}

/** `standard`: NIST category 3 everywhere. `edge`: smaller keys for constrained devices (categories 1–2). */
export const PROFILES = {
  standard: {
    id: "standard",
    label: "Standard",
    kem: "hybrid-x25519-mlkem768",
    sig: "ml-dsa-65",
    pqKem: "ml-kem-768",
    description: "X25519 + ML-KEM-768 with ML-DSA-65 (NIST category 3)",
  },
  edge: {
    id: "edge",
    label: "Edge",
    kem: "hybrid-x25519-mlkem512",
    sig: "ml-dsa-44",
    pqKem: "ml-kem-512",
    description: "X25519 + ML-KEM-512 with ML-DSA-44 for IoT (NIST categories 1–2)",
  },
} as const satisfies Record<string, Omit<Profile, "id"> & { id: string }>;

export type ProfileId = keyof typeof PROFILES;

export const isKemId = (id: string): id is KemId => Object.hasOwn(registry.kem, id);
export const isSigId = (id: string): id is SigId => Object.hasOwn(registry.sig, id);
export const isProfileId = (id: string): id is ProfileId => Object.hasOwn(PROFILES, id);

export function getKem(id: string): KemAlgorithm {
  if (!isKemId(id)) throw new Error(`Unknown KEM algorithm: ${id}`);
  return registry.kem[id];
}

export function getSig(id: string): SignatureAlgorithm {
  if (!isSigId(id)) throw new Error(`Unknown signature algorithm: ${id}`);
  return registry.sig[id];
}

export function getProfile(id: string = "standard"): Profile {
  if (!isProfileId(id)) throw new Error(`Unknown profile: ${id}`);
  return PROFILES[id];
}

export function listAlgorithms(): (KemAlgorithm | SignatureAlgorithm)[] {
  return [...Object.values(registry.kem), ...Object.values(registry.sig)];
}
