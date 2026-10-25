import "server-only";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

/** Adapters a phone on the room's Wi-Fi can't reach: VPN tunnels, Docker, VM and bridge networks. */
const VIRTUAL =
  /^(utun|tun|tap|ppp|ipsec|wg|docker|br-|veth|vboxnet|vmnet|virbr|bridge|awdl|llw|zt)/i;
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * The laptop's address on the room's Wi-Fi: a private IPv4 address on a physical adapter first
 * (Wi-Fi and Ethernet, e.g. en0, wlan0, eth0), then any other non-internal one. Link-local
 * addresses (169.254.x.x, no DHCP) never qualify: nothing else on the network can reach them.
 */
export function pickLanAddress(
  ifaces: Record<string, NetworkInterfaceInfo[] | undefined>,
): string | null {
  const all = Object.entries(ifaces).flatMap(([name, list]) =>
    (list ?? [])
      .filter((a) => a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254."))
      .map((a) => ({ name, address: a.address })),
  );
  const rank = (a: { name: string; address: string }) =>
    (VIRTUAL.test(a.name) ? 2 : 0) + (PRIVATE.test(a.address) ? 0 : 1);
  return all.sort((a, b) => rank(a) - rank(b))[0]?.address ?? null;
}

export const lanAddress = () => pickLanAddress(networkInterfaces());

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
