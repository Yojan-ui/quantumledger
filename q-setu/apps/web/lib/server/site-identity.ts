import "server-only";
import { bytesToBase64, createIdentity, type Identity } from "@qsetu/core";
import { siteSeed } from "@/lib/site-key.mjs";

const g = globalThis as unknown as { __qsetuSite?: Identity };

/**
 * The site's ML-DSA-65 identity (lib/site-key.mjs). It signs the asset manifest, the sealed
 * headlines and the API responses the homepage verifies. The browser checks every one of those
 * against NEXT_PUBLIC_QSETU_SITE_KEY, the public key pinned into its bundle at build time.
 */
export function siteIdentity(): Identity {
  if (g.__qsetuSite) return g.__qsetuSite;
  const id = createIdentity("standard", siteSeed());
  const pinned = process.env.NEXT_PUBLIC_QSETU_SITE_KEY;
  if (pinned && pinned !== bytesToBase64(id.publicKey))
    console.error(
      "[site-identity] the site key differs from the one pinned in the bundle: every signature will fail to verify. Rebuild, or set QSETU_SITE_SEED to the build's seed.",
    );
  return (g.__qsetuSite = id);
}
