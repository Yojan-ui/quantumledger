/**
 * The site's long-term ML-DSA-65 signing key, from a 32-byte seed: QSETU_SITE_SEED (64 hex chars)
 * when set (production: set it, so every instance and every build agrees), else .qsetu/site-seed,
 * created on first use (local development; .qsetu/ is git-ignored).
 *
 * next.config.mjs inlines the public key into the client bundle as NEXT_PUBLIC_QSETU_SITE_KEY, so
 * the browser checks signatures against a key it already holds rather than one the server sends.
 * The derivation matches @qsetu/core's createIdentity("standard", seed).
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

const FILE = join(process.cwd(), ".qsetu", "site-seed");

/** @returns {Uint8Array} */
export function siteSeed() {
  const env = process.env.QSETU_SITE_SEED?.trim();
  if (env) {
    if (!/^[0-9a-f]{64}$/i.test(env)) throw new Error("QSETU_SITE_SEED must be 64 hex characters");
    return Uint8Array.from(Buffer.from(env, "hex"));
  }
  if (!existsSync(FILE)) {
    mkdirSync(join(process.cwd(), ".qsetu"), { recursive: true });
    writeFileSync(FILE, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  }
  return Uint8Array.from(Buffer.from(readFileSync(FILE, "utf8").trim(), "hex"));
}

/** Base64 of the ML-DSA-65 public key for siteSeed(). */
export function sitePublicKey() {
  const seed = hkdf(
    sha256,
    siteSeed(),
    undefined,
    new TextEncoder().encode("qsetu-v1/seed/ml-dsa-65"),
    32,
  );
  return Buffer.from(ml_dsa65.keygen(seed).publicKey).toString("base64");
}
