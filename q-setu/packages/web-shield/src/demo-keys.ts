/**
 * DEMO ONLY: Web-shield server keys derived from a *public* seed, so the static demo page can pin a
 * stable key ID. Anyone can recompute these keys. In production, generate random keys or load
 * them from an HSM / secret store, and set QSETU_WEB_SHIELD_SEED to a secret.
 */
import { getKem, getProfile, getSig, utf8ToBytes } from "@qsetu/core";
import { sha256 } from "@noble/hashes/sha2.js";
import type { WebShieldKeys } from "./server";

export const PUBLIC_DEMO_SEED_LABEL =
  "qsetu web-shield PUBLIC DEMO SEED - do not use in production";

export function webShieldKeysFromSeed(
  seed: Uint8Array,
  profile: "standard" | "edge" = "standard",
): WebShieldKeys {
  const p = getProfile(profile);
  return { profile, kem: getKem(p.kem).keygen(seed), sig: getSig(p.sig).keygen(seed) };
}

export function demoWebShieldKeys(): WebShieldKeys {
  return webShieldKeysFromSeed(sha256(utf8ToBytes(PUBLIC_DEMO_SEED_LABEL)));
}
