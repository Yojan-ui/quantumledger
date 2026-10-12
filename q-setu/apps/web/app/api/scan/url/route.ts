import { fail, parseBody } from "@/lib/server/api";
import { clientKey } from "@/lib/live/rate-limit";
import { live } from "@/lib/server/runtime";
import { cachedScan, scanHost } from "@/lib/server/scan-service";
import { hostFromInput } from "@/lib/live/tls";

function cachedOnlyScan(url: string) {
  const r = cachedScan(hostFromInput(url));
  if (!r) throw new Error("No cached scan for that host");
  return r;
}
import { ScanUrlBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/scan/url { url }: connects to the host on 443 offering X25519MLKEM768 first, reports the
 * negotiated TLS version, cipher, key-exchange group and certificate, then scores it, builds a CBOM, a
 * migration plan, three plain-language findings and the server's approximate location. Public
 * hostnames only; 6 scans per minute per client. Offline, it answers from pre-cached real scans.
 */
export async function POST(req: Request) {
  const { scanLimiter, bus } = await live();
  const peek = (await req
    .clone()
    .json()
    .catch(() => ({}))) as { cachedOnly?: boolean };
  // A cached answer costs nothing and touches no network, so it isn't rate-limited.
  const wait = peek.cachedOnly ? 0 : scanLimiter.take(clientKey(req));
  if (wait)
    return fail("rate_limited", `Too many scans. Try again in ${wait} s.`, 429, {
      retryAfter: wait,
    });
  const b = await parseBody(req, ScanUrlBody);
  if (!b.ok) return b.res;
  const t = performance.now();
  try {
    const r = b.data.cachedOnly ? cachedOnlyScan(b.data.url) : await scanHost(b.data.url);
    bus.publish({
      op: "SCAN",
      source: "scanner",
      alg: r.probe.group,
      ms: performance.now() - t,
      ok: r.probe.hybridPq,
      detail: `${r.probe.host} · ${r.probe.hybridPq ? "hybrid PQ" : "classical"} key exchange${r.cached ? " · cached" : ""}`,
    });
    return Response.json(r);
  } catch (e) {
    return fail("unprocessable", (e as Error).message, 422);
  }
}
