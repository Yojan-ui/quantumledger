/**
 * A signed list of a site's static files: every file's SHA-384 (the same "sha384-…" form as
 * Subresource Integrity), signed with ML-DSA-65 (FIPS 204). Published at
 * /.well-known/qsetu-manifest.json. Anyone holding the site's public key can check that the scripts
 * and styles being served are the ones that were built and signed, and a tampered CDN file or an
 * injected script shows up as a mismatch.
 *
 * The public key must reach the checker another way (configuration, or a DNS TXT record): a key
 * fetched from the same server as the manifest proves nothing about that server.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { base64ToBytes, bytesToBase64, getSig, keyId, type Identity } from "@qsetu/core";

export const MANIFEST_PATH = "/.well-known/qsetu-manifest.json";
const DOMAIN_SEP = "qsetu-manifest-v1\n";

export interface Manifest {
  v: 1;
  alg: "ML-DSA-65";
  keyId: string;
  site: string;
  generated: string;
  /** URL path → "sha384-<base64>". */
  files: Record<string, string>;
  signature: string;
}

/** JSON with object keys sorted at every level: the exact bytes that get signed. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

const signedBytes = (m: Omit<Manifest, "signature">) =>
  new TextEncoder().encode(DOMAIN_SEP + canonical(m));
export const sri = (data: Uint8Array) =>
  `sha384-${createHash("sha384").update(data).digest("base64")}`;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export interface BuildOptions {
  /** Directories and the URL prefix each is served under, e.g. [".next/static", "/_next/static"]. */
  roots: [dir: string, urlPrefix: string][];
  site: string;
  identity: Identity;
  include?: RegExp;
  now?: Date;
}

export function buildManifest(o: BuildOptions): Manifest {
  if (o.identity.profile !== "standard")
    throw new Error("The manifest is signed with ML-DSA-65 (the standard profile)");
  const include = o.include ?? /\.(js|mjs|css|wasm|json|html|svg|woff2?)$/;
  const files: Record<string, string> = {};
  for (const [dir, prefix] of o.roots)
    for (const f of walk(dir)) {
      if (!include.test(f)) continue;
      const url = `${prefix.replace(/\/$/, "")}/${relative(dir, f).split(sep).join("/")}`;
      files[url] = sri(readFileSync(f));
    }
  const unsigned = {
    v: 1 as const,
    alg: "ML-DSA-65" as const,
    keyId: keyId(o.identity.publicKey),
    site: o.site,
    generated: (o.now ?? new Date()).toISOString(),
    files,
  };
  const signature = getSig("ml-dsa-65").sign(signedBytes(unsigned), o.identity.secretKey);
  return { ...unsigned, signature: bytesToBase64(signature) };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "format" | "key" | "signature" };

/** Checks the signature against the pinned public key (base64 or bytes). */
export function verifyManifest(m: unknown, publicKey: string | Uint8Array): VerifyResult {
  const pk = typeof publicKey === "string" ? base64ToBytes(publicKey) : publicKey;
  const x = m as Manifest;
  if (
    !x ||
    x.v !== 1 ||
    x.alg !== "ML-DSA-65" ||
    typeof x.signature !== "string" ||
    typeof x.files !== "object"
  )
    return { ok: false, reason: "format" };
  if (x.keyId !== keyId(pk)) return { ok: false, reason: "key" };
  const { signature, ...unsigned } = x;
  let sig: Uint8Array;
  try {
    sig = base64ToBytes(signature);
  } catch {
    return { ok: false, reason: "format" };
  }
  return getSig("ml-dsa-65").verify(sig, signedBytes(unsigned), pk)
    ? { ok: true }
    : { ok: false, reason: "signature" };
}

export interface CheckReport {
  signature: VerifyResult;
  checked: number;
  mismatched: string[];
  missing: string[];
}

/** Fetches the live manifest, verifies it, then fetches up to `limit` files and compares hashes. */
export async function checkSite(
  origin: string,
  publicKey: string,
  limit = 200,
  f: typeof fetch = fetch,
): Promise<CheckReport> {
  const base = origin.replace(/\/$/, "");
  const m = (await (await f(base + MANIFEST_PATH)).json()) as Manifest;
  const signature = verifyManifest(m, publicKey);
  const report: CheckReport = { signature, checked: 0, mismatched: [], missing: [] };
  if (!signature.ok) return report;
  for (const [path, want] of Object.entries(m.files).slice(0, limit)) {
    const r = await f(base + path);
    if (!r.ok) {
      report.missing.push(path);
      continue;
    }
    report.checked++;
    if (sri(new Uint8Array(await r.arrayBuffer())) !== want) report.mismatched.push(path);
  }
  return report;
}
