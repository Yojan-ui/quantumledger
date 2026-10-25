import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { signManifest, sri, type Manifest } from "@qsetu/shield/manifest";
import { siteUrl } from "@/lib/server/env";
import { siteIdentity } from "@/lib/server/site-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Served directory → URL prefix. */
const ROOTS: [string, string][] = [
  [join(process.cwd(), "public"), ""],
  [join(process.cwd(), ".next", "static"), "/_next/static"],
];
const INCLUDE = /\.(js|mjs|css|json|svg|woff2?|png|jpe?g|webp|avif|gif|ico|glb|ktx2|html)$/;

interface Cache {
  hashes: Map<string, { stamp: string; sri: string }>;
  fingerprint: string;
  manifest?: Manifest;
}
const g = globalThis as unknown as { __qsetuManifest?: Cache };
const cache: Cache = (g.__qsetuManifest ??= { hashes: new Map(), fingerprint: "" });

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    const p = join(dir, n);
    const s = statSync(p, { throwIfNoEntry: false });
    if (s?.isDirectory()) walk(p, out);
    else if (s && INCLUDE.test(n)) out.push(p);
  }
  return out;
}

/**
 * GET /.well-known/qsetu-manifest.json: every static file this server serves (public/ and the
 * built /_next/static), each with its SHA-384, signed with the site's ML-DSA-65 key
 * (@qsetu/shield's manifest format). Files are re-hashed only when their size or mtime changes, and
 * the manifest is re-signed only when the set changes (in development, after a rebuild).
 */
export async function GET(req: Request) {
  const files: Record<string, string> = {};
  const stamps: string[] = [];
  for (const [dir, prefix] of ROOTS)
    for (const f of walk(dir)) {
      const s = statSync(f, { throwIfNoEntry: false });
      if (!s) continue;
      const stamp = `${s.size}:${s.mtimeMs}`;
      let h = cache.hashes.get(f);
      if (h?.stamp !== stamp) {
        try {
          h = { stamp, sri: sri(readFileSync(f)) };
        } catch {
          continue; // removed by a rebuild between the walk and the read
        }
        cache.hashes.set(f, h);
      }
      const url = `${prefix}/${relative(dir, f).split(sep).join("/")}`;
      files[url] = h.sri;
      stamps.push(`${url}|${stamp}`);
    }
  // The site the manifest vouches for: the configured URL. The request's own origin only stands in
  // where none is configured (local runs), and then it's signed for that request alone: a Host
  // header is the sender's to choose, and must not decide what every other visitor is served.
  const configured = process.env.NEXT_PUBLIC_SITE_URL ? siteUrl() : undefined;
  if (!configured)
    return Response.json(
      signManifest({ site: new URL(req.url).origin, files, identity: siteIdentity() }),
      { headers: { "cache-control": "no-store" } },
    );
  const fingerprint = stamps.sort().join("\n");
  if (!cache.manifest || fingerprint !== cache.fingerprint) {
    cache.manifest = signManifest({ site: configured, files, identity: siteIdentity() });
    cache.fingerprint = fingerprint;
  }
  return Response.json(cache.manifest, { headers: { "cache-control": "no-cache" } });
}
