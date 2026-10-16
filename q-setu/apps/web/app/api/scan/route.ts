import { scan } from "@qsetu/core";
import { parseBody } from "@/lib/server/api";
import { getBus } from "@/lib/server/runtime";
import { ScanBody } from "@/lib/server/schemas";
import { signed } from "@/lib/server/signed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/scan { text, filename? } → findings, 0–100 score, CycloneDX CBOM. */
export const POST = signed(async function POST(req: Request) {
  const b = await parseBody(req, ScanBody);
  if (!b.ok) return b.res;
  const t = performance.now();
  const r = scan(b.data.text, b.data.filename ?? "pasted-input");
  getBus().publish({
    op: "SCAN",
    source: "scanner",
    alg: "cbom",
    ms: performance.now() - t,
    ok: r.grade === "Quantum-ready",
    bytes: b.data.text.length,
    detail: `${r.findings.length} findings · ${r.grade}`,
  });
  return Response.json(r);
});
