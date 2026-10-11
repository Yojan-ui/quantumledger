import { SECTORS } from "@qsetu/sim";
import { parseBody, SectorBody } from "@/lib/server/api";
import { getBus } from "@/lib/server/runtime";
import { ensureShieldStack, LEGACY, SHIELD_CLIENT, SHIELD_SERVER } from "@/lib/server/shield-stack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = {
  fintech: "/api/transfer",
  healthcare: "/api/lab-reports",
  education: "/api/certificates",
} as const;

/**
 * POST /api/shield/run { sector }: sends one real request to the legacy app twice, once directly
 * (before) and once through Shield client → Shield server (after), and returns what the wire carried.
 */
export async function POST(req: Request) {
  const b = await parseBody(req, SectorBody);
  if (!b.ok) return b.res;
  const sector = b.data.sector;
  const mode = await ensureShieldStack();
  const record = SECTORS[sector].generate();
  const payload = JSON.stringify(record);
  const send = (base: string) =>
    fetch(base + ROUTE[sector], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

  const t0 = performance.now();
  const direct = await send(LEGACY);
  const directMs = performance.now() - t0;
  const before = await direct.json();

  const t1 = performance.now();
  const shielded = await send(SHIELD_CLIENT);
  const shieldMs = performance.now() - t1;
  const after = await shielded.json();

  const [{ frames }, health] = await Promise.all([
    fetch(`${SHIELD_SERVER}/qsetu/wire`).then((r) => r.json()),
    fetch(`${SHIELD_CLIENT}/healthz`).then((r) => r.json()),
  ]);
  getBus().publish({
    op: "SEAL",
    source: "shield",
    alg: "ml-kem-768+x25519",
    ms: shieldMs,
    ok: shielded.ok,
    sector,
    bytes: payload.length + 44,
    detail: `request tunnelled to legacy ${ROUTE[sector]}`,
  });
  return Response.json({
    stack: mode,
    record,
    before: { response: before, ms: directMs, wire: payload },
    after: {
      response: after,
      ms: shieldMs,
      session: shielded.headers.get("x-qsetu-session"),
      epoch: shielded.headers.get("x-qsetu-epoch"),
    },
    frames: frames.slice(-6),
    stats: health.stats,
  });
}
