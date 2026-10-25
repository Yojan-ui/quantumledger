import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { hostFromInput, isPrivateAddress } from "@/lib/live/tls";

/**
 * Customer webhooks (a site's alert URL) without server-side request forgery. The URL is the
 * customer's to choose, so it is held to what the URL scanner allows (lib/live/tls):
 *  - https on the default port only, no credentials, no local names or private literal addresses;
 *  - every address the name resolves to must be public, and the request goes to the address that
 *    was checked (a second DNS answer can't swap in an internal one);
 *  - no redirects are followed, and the whole request has a 3 s deadline.
 * The response is never read back to anyone.
 */
const DEADLINE_MS = 3_000;

/** The webhook's host, or a reason it's refused (checks that need no DNS: used when it's saved). */
export function webhookHost(raw: string): { host: string } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "Not a valid URL." };
  }
  if (url.protocol !== "https:") return { error: "The webhook must use https." };
  if (url.port && url.port !== "443") return { error: "The webhook must use the default port." };
  if (url.username || url.password) return { error: "No credentials in the webhook URL." };
  try {
    return { host: hostFromInput(url.origin) };
  } catch {
    return { error: "The webhook must be a public internet address." };
  }
}

/** POSTs JSON to a customer webhook, or does nothing if the URL isn't allowed. Never throws. */
export async function postWebhook(raw: string, body: unknown): Promise<boolean> {
  const h = webhookHost(raw);
  if ("error" in h) return false;
  const url = new URL(raw);
  let address: string;
  let family: number;
  try {
    const all = await lookup(h.host, { all: true, verbatim: true });
    if (!all.length || all.some((a) => isPrivateAddress(a.address))) return false;
    ({ address, family } = all[0]!);
  } catch {
    return false;
  }
  const data = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = request(
      {
        host: h.host,
        servername: h.host,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) },
        // The checked address, not a fresh lookup.
        lookup: (_name, _opts, cb) => cb(null, address, family),
        timeout: DEADLINE_MS,
      },
      (res) => {
        res.resume(); // the body is never read; a redirect is an answer, not followed
        resolve((res.statusCode ?? 0) < 300);
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
    req.end(data);
  });
}
