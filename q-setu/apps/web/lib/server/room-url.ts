import "server-only";
import { networkInterfaces } from "node:os";

/** First non-internal IPv4 address (the laptop's address on the room's Wi-Fi). */
export function lanAddress(): string | null {
  for (const list of Object.values(networkInterfaces()))
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) return a.address;
  return null;
}

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/;

/**
 * The URL phones should open. QSETU_JOIN_URL (or NEXT_PUBLIC_SITE_URL) wins in production; otherwise
 * the request's own host, swapped for the LAN address when it is localhost, so a phone on the same
 * Wi-Fi can reach a laptop running `pnpm dev` or `pnpm start`.
 */
export function joinUrl(req: Request): { url: string; lan: boolean } {
  const fixed = process.env.QSETU_JOIN_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return { url: `${fixed.replace(/\/$/, "")}/join`, lan: false };
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const [name, port] = host.split(/:(?=\d+$)/) as [string, string | undefined];
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  if (LOCAL.test(name)) {
    const ip = lanAddress();
    if (ip) return { url: `http://${ip}${port ? `:${port}` : ""}/join`, lan: true };
  }
  return { url: `${proto}://${host}/join`, lan: false };
}
