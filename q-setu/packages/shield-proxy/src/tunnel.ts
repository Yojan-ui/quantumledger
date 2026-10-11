/** The HTTP request/response shape carried inside the encrypted tunnel. */
export interface TunnelRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string; // base64
}

export interface TunnelResponse {
  status: number;
  headers: Record<string, string>;
  body: string; // base64
}

/** Hop-by-hop headers must not be forwarded (RFC 9110 §7.6.1). */
const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "host",
  "content-length",
]);

export function cleanHeaders(
  h: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined || HOP.has(k.toLowerCase())) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
  }
  return out;
}

export const b64 = (buf: Uint8Array) => Buffer.from(buf).toString("base64");
export const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
