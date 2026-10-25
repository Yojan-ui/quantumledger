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
import type { Identity } from "@qsetu/core";
import {
  MANIFEST_PATH,
  signManifest,
  verifyManifest,
  type Manifest,
  type VerifyResult,
} from "./manifest-format";

export * from "./manifest-format";

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
  const include = o.include ?? /\.(js|mjs|css|wasm|json|html|svg|woff2?)$/;
  const files: Record<string, string> = {};
  for (const [dir, prefix] of o.roots)
    for (const f of walk(dir)) {
      if (!include.test(f)) continue;
      const url = `${prefix.replace(/\/$/, "")}/${relative(dir, f).split(sep).join("/")}`;
      files[url] = sri(readFileSync(f));
    }
  return signManifest({ site: o.site, files, identity: o.identity, now: o.now });
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
