/**
 * The replay host guard. Replays and test traffic go only to this machine: the local sandbox or the
 * apps/legacy-bank demo, both on loopback. Anything else is refused before a single byte is sent.
 * This tool tests our own defences; it never points at anyone else's systems.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export class HostRefused extends Error {
  constructor(target: string) {
    super(
      `Refused: ${target} is not a local sandbox. Attack Lab only replays against localhost (the sandbox or the legacy-bank demo).`,
    );
    this.name = "HostRefused";
  }
}

/** Throws HostRefused unless `url` is http(s) on a loopback host. Returns the parsed URL. */
export function assertSandbox(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new HostRefused(String(url).slice(0, 200));
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || !LOOPBACK.has(u.hostname))
    throw new HostRefused(u.host || url);
  if (u.username || u.password) throw new HostRefused(u.host);
  return u;
}

/** A request URL for `route` on a sandbox origin, checked again after joining. */
export function sandboxUrl(base: string, route: string): string {
  const origin = assertSandbox(base).origin;
  const path = route.startsWith("/") ? route : `/${route}`;
  // Concatenate, never resolve: "//elsewhere.example" must stay a path on the sandbox.
  return assertSandbox(origin + path).href;
}
