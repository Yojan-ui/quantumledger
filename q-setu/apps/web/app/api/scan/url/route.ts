import { fail, parseBody } from "@/lib/server/api";
import { live } from "@/lib/server/runtime";
import { cachedScan, scanHost } from "@/lib/server/scan-service";
import { hostFromInput, ScanError } from "@/lib/live/tls";
import { SCAN_LIMITS, take, tooMany } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { ScanUrlBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cachedOnlyScan(url: string) {
  const r = cachedScan(hostFromInput(url));
  if (!r) throw new ScanError("unreachable", "no cached scan");
  return r;
}

/**
 * POST /api/scan/url { url }: a TLS handshake with the host on 443 offering X25519MLKEM768 first,
 * then the readiness findings, CBOM, migration plan and approximate location. Locked down:
 *  - https only (http accepted only as a way of naming a host; nothing is fetched over HTTP), ports
 *    443/80 only; no request is sent, no body read, no redirect followed;
 *  - DNS resolved here, every address must be public, and the checked IP is the one connected to;
 *  - 5 s for the whole probe, 1 MB read at most;
 *  - 10 scans a minute and 100 a day per client (cached answers are free: no network);
 *  - errors are a fixed code and message; the detail goes to the server log only.
 */
export async function POST(req: Request) {
  const b = await parseBody(req, ScanUrlBody);
  if (!b.ok) return b.res;
  if (!b.data.cachedOnly) {
    const v = await take(req, SCAN_LIMITS);
    if (!v.ok) return tooMany(v, "scans");
  }
  const { bus } = await live();
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
    log(req, "scan", 200, performance.now() - t, { cached: !!r.cached });
    return Response.json(r);
  } catch (e) {
    const se = e instanceof ScanError ? e : new ScanError("unreachable", String(e));
    log(req, "scan", 422, performance.now() - t, { code: se.code, detail: se.detail });
    return fail(se.code, se.message, se.code === "blocked_target" ? 403 : 422);
  }
}
