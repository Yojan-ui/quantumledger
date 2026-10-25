import "server-only";
import { createHash } from "node:crypto";
import { bytesToBase64, getSig } from "@qsetu/core";
import { siteIdentity } from "@/lib/server/site-identity";
import { HASH_HEADER, responseSignedBytes, SIG_HEADER, TS_HEADER } from "@/lib/trust/format";

/**
 * Wraps a route handler so every response it returns carries the site's ML-DSA-65 signature over
 * its method, path, time and SHA-384 body hash (lib/trust/format). The homepage verifies these in
 * the browser before it uses the data, and lists each check on the zero-trust rail.
 */
export function signed<A extends unknown[]>(
  handler: (req: Request, ...rest: A) => Response | Promise<Response>,
) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const res = await handler(req, ...rest);
    const body = new Uint8Array(await res.arrayBuffer());
    const hash = `sha384-${createHash("sha384").update(body).digest("base64")}`;
    const ts = Date.now();
    const msg = responseSignedBytes(req.method, new URL(req.url).pathname, ts, hash);
    const sig = getSig("ml-dsa-65").sign(msg, siteIdentity().secretKey);
    const headers = new Headers(res.headers);
    headers.set(HASH_HEADER, hash);
    headers.set(TS_HEADER, String(ts));
    headers.set(SIG_HEADER, bytesToBase64(sig));
    return new Response(body, { status: res.status, statusText: res.statusText, headers });
  };
}
