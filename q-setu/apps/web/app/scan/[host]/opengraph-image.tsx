import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/og/card";
import { serverToken } from "@/lib/brand/tokens-server";
import { storedScan } from "@/lib/server/scan-lookup";
import { safeDecode } from "@/lib/format";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "QuantumLedger quantum-readiness score";

/** The share card for a scan: host, 0–100 score and the one-line verdict. */
export default async function Image({ params }: { params: Promise<{ host: string }> }) {
  const host = safeDecode((await params).host).slice(0, 80);
  const r = await storedScan(host);
  const fg = serverToken("--text");
  const fg2 = serverToken("--text-2");
  const mark = r?.probe.hybridPq ? serverToken("--accent") : serverToken("--warn");
  return new ImageResponse(
    <OgCard label="Quantum-readiness scan" title={`Is ${host} quantum-safe?`}>
      {r ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div style={{ color: fg, fontSize: 96, letterSpacing: -3 }}>{r.score}</div>
          <div style={{ color: fg2, fontSize: 32 }}>/ 100</div>
          <div style={{ color: mark, fontSize: 30, marginLeft: 24 }}>●</div>
          <div style={{ color: fg2, fontSize: 30 }}>
            {r.probe.hybridPq ? "Hybrid post-quantum key exchange" : "Harvestable today"}
          </div>
        </div>
      ) : (
        <div style={{ color: fg2, fontSize: 32 }}>Scan it at QuantumLedger</div>
      )}
    </OgCard>,
    size,
  );
}
