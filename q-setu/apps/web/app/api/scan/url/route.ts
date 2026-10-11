import { fail, parseBody } from "@/lib/server/api";
import { clientKey } from "@/lib/live/rate-limit";
import { live } from "@/lib/server/runtime";
import { scanHost } from "@/lib/server/scan-service";
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
  const wait = scanLimiter.take(clientKey(req));
  if (wait)
    return fail("rate_limited", `Too many scans. Try again in ${wait} s.`, 429, {
      retryAfter: wait,
    });
  const b = await parseBody(req, ScanUrlBody);
  if (!b.ok) return b.res;
  const t = performance.now();
  try {
    const r = await scanHost(b.data.url);
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
