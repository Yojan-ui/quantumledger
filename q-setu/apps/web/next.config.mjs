/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  transpilePackages: [
    "@qsetu/core",
    "@qsetu/sdk",
    "@qsetu/sim",
    "@qsetu/vault",
    "@qsetu/edge",
    "@qsetu/web-shield",
    "@qsetu/shield-proxy",
    "@qsetu/legacy-bank",
  ],
  serverExternalPackages: ["fastify", "express", "better-sqlite3"],
  async redirects() {
    return [{ source: "/demo", destination: "/demos", permanent: true }];
  },
  async rewrites() {
    // The plain-HTML Web shield demo lives in public/; serve its folder URL too.
    return [{ source: "/web-shield-demo", destination: "/web-shield-demo/index.html" }];
  },
  async headers() {
    // qsetu.js doubles as the Web shield's Service Worker; let it control the whole origin.
    return [
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

export default nextConfig;
