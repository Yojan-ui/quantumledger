/* global process */
/** The dashboard is a view: all data comes from the lab's local API (packages/attack-lab). */
const LAB = process.env.ATTACK_LAB_API ?? "http://127.0.0.1:4100";

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${LAB}/api/:path*` }];
  },
};
