import { createMDX } from "fumadocs-mdx/next";
import { STATIC_SECURITY_HEADERS } from "./lib/server/security-headers.mjs";
import { sitePublicKey } from "./lib/site-key.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // Metadata goes in <head> for every visitor, not streamed into <body> for non-bots (Lighthouse and
  // some crawlers only read <head>). Our metadata is static, so nothing waits on it.
  htmlLimitedBots: /.*/,
  // The site's ML-DSA-65 public key, pinned into the bundle: the browser verifies against it.
  env: { NEXT_PUBLIC_QSETU_SITE_KEY: sitePublicKey() },
  transpilePackages: [
    "@qsetu/core",
    "@qsetu/sdk",
    "@qsetu/sim",
    "@qsetu/vault",
    "@qsetu/edge",
    "@qsetu/web-shield",
    "@qsetu/shield-proxy",
    "@qsetu/legacy-bank",
    "@qsetu/shield-edge",
    "@qsetu/shield",
    "@qsetu/shield-guard",
  ],
  serverExternalPackages: [
    "fastify",
    "express",
    "better-sqlite3",
    "postgres",
    "@electric-sql/pglite",
  ],
  async redirects() {
    return [
      { source: "/demo", destination: "/demos", permanent: true },
      // Q-Setu is now QuantumLedger: old brand URLs keep working.
      {
        source: "/brand/q-setu-:asset.svg",
        destination: "/brand/quantumledger-:asset.svg",
        permanent: true,
      },
      { source: "/q-setu", destination: "/", permanent: true },
      { source: "/q-setu/:path*", destination: "/:path*", permanent: true },
      // The audit log was "Q-Ledger"; it is now the Proof Chain.
      { source: "/q-ledger", destination: "/demo/ledger", permanent: true },
      { source: "/proof-chain", destination: "/demo/ledger", permanent: false },
      // "Scan" in the nav is the scanner; /scan/<host> stays each host's result page.
      { source: "/scan", destination: "/demo/scanner", permanent: false },
    ];
  },
  async rewrites() {
    // The plain-HTML Web shield demo lives in public/; serve its folder URL too.
    return [
      { source: "/web-shield-demo", destination: "/web-shield-demo/index.html" },
      // Next.js reserves an app route named "index"; the Readiness Index lives at /index anyway.
      { source: "/index", destination: "/readiness-index" },
    ];
  },
  async headers() {
    return [
      // Every response, static files included. The CSP itself is per request (middleware.ts).
      { source: "/:path*", headers: STATIC_SECURITY_HEADERS },
      // qsetu.js doubles as the Web shield's Service Worker; let it control the whole origin.
      {
        source: "/qsetu.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

// Fumadocs compiles content/docs/*.mdx into the typed `.source` module.
export default createMDX()(nextConfig);
