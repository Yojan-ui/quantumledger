import { AtlasError, atlas } from "./atlas";

export const MAX_HOSTS = 10;

/** IPv4 literals Atlas would refuse anyway (private, loopback, link-local, CGNAT, multicast, reserved). */
function privateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * "example.com, api.example.com:8443" -> ["example.com", "api.example.com:8443"]. A first check only: Atlas
 * resolves every host and refuses private or internal addresses before any handshake.
 */
export function endpointHosts(input: string): string[] {
  const items = input
    .split(/[\s,]+/)
    .map((x) => x.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  if (!items.length) throw new Error("Enter at least one public hostname, e.g. example.com");
  const ports = new Map<string, string>();
  for (const item of items) {
    if (/[/@?#]/.test(item) || item.includes("://"))
      throw new Error(`${item}: enter a hostname only, optionally with :port (no scheme or path).`);
    const [host = "", port = "443", extra] = item.split(":");
    if (extra !== undefined || !/^\d{1,5}$/.test(port) || +port < 1 || +port > 65535)
      throw new Error(`${item}: use host or host:port.`);
    if (
      host === "localhost" ||
      /\.(localhost|local|internal|lan)$/.test(host) ||
      privateIPv4(host) ||
      !/^[a-z0-9.-]+$/.test(host)
    )
      throw new Error(`${host}: only public hosts can be scanned.`);
    if (ports.has(host) && ports.get(host) !== port)
      throw new Error(`${host}: one port per host (no port scanning).`);
    ports.set(host, port);
  }
  if (ports.size > MAX_HOSTS) throw new Error(`At most ${MAX_HOSTS} hosts per scan.`);
  return [...ports].map(([h, p]) => (p === "443" ? h : `${h}:${p}`));
}

export function endpointError(error: unknown): string {
  if (error instanceof AtlasError) {
    if (error.code === "atlas_down")
      return "Atlas is unavailable. Start the backend on port 8100, then retry.";
    if (error.status === 401 || error.status === 403)
      return "Sign in with an Atlas operator account to scan an endpoint.";
    if (error.code === "rate_limited") return "One scan at a time: wait a few seconds and retry.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Could not reach Atlas. Try again.";
}

/** New workspace "Live TLS scan, <UTC time>", the host list (checked by Atlas), then the pipeline run. */
export async function scanEndpoints(input: string, onProgress: (message: string) => void) {
  const hosts = endpointHosts(input);
  const id = `tls-${crypto.randomUUID().slice(0, 20)}`;
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  onProgress("Creating a workspace for this scan…");
  await atlas.createWorkspace(id, `Live TLS scan, ${ts} UTC`, "empty");
  onProgress("Checking the hosts are public…");
  const res = await atlas.endpoints(id, hosts);
  onProgress(`Starting one TLS handshake per host (${res.endpoints.length})…`);
  const { run_id } = await atlas.startRun(id);
  return { id, run_id, endpoints: res.endpoints };
}
