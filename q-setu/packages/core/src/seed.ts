/**
 * Deterministic key derivation for reproducible identities (HKDF-SHA256, RFC 5869).
 * A seed must be secret and high-entropy; it's only used for demo keys and HSM-style backups.
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "./encoding";
import type { Bytes } from "./types";

export function expandSeed(seed: Bytes, label: string, length: number): Bytes {
  if (seed.length < 32) throw new Error("Seed must be at least 32 bytes");
  return hkdf(sha256, seed, undefined, utf8ToBytes(`qsetu-v1/seed/${label}`), length);
}
