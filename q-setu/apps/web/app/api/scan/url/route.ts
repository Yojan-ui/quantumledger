import { scan } from "@qsetu/core";
import { fail, parseBody } from "@/lib/server/api";
import { buildPlan, planToMarkdown } from "@/lib/live/plan";
import { clientKey } from "@/lib/live/rate-limit";
import { probeTls } from "@/lib/live/tls";
import { live } from "@/lib/server/runtime";
import { ScanUrlBody } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/scan/url { url }: connects to the host on 443 offering X25519MLKEM768 first, reports the
 * negotiated TLS version, cipher, key-exchange group and certificate, then scores it, builds a CBOM
 * and a migration plan. Public hostnames only; 6 scans per minute per client.
 */
export async function POST(req: Request) {
  const { scanLimiter, bus } = live();
  const wait = scanLimiter.take(clientKey(req));
  if (wait)
    return fail("rate_limited", `Too many scans. Try again in ${wait} s.`, 429, {
      retryAfter: wait,
    });
  const b = await parseBody(req, ScanUrlBody);
  if (!b.ok) return b.res;
  const t = performance.now();
  try {
    const probe = await probeTls(b.data.url);
    const result = scan(probe.report, probe.host);
    const plan = buildPlan({
      findings: result.findings,
      dataLifetimeYears: 10,
      source: "url",
      hybridPq: probe.hybridPq,
    });
    bus.publish({
      op: "SCAN",
      source: "scanner",
      alg: probe.group,
      ms: performance.now() - t,
      ok: probe.hybridPq,
      detail: `${probe.host} · ${probe.hybridPq ? "hybrid PQ" : "classical"} key exchange`,
    });
    return Response.json({
      probe,
      ...result,
      plan: { ...plan, markdown: planToMarkdown(plan, `Migration plan for ${probe.host}`) },
    });
  } catch (e) {
    return fail("unprocessable", (e as Error).message, 422);
  }
}
