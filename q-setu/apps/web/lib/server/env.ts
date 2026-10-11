import "server-only";

/** Offline demo mode: no outbound network (URL scans use the pre-cached results, GeoIP is skipped). */
export const isOffline = () =>
  process.env.NEXT_PUBLIC_OFFLINE === "1" || process.env.QSETU_OFFLINE === "1";

/** Canonical site URL for metadata, sitemaps and share links. */
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
