import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/og/card";
import { parseSealShare, sealLine } from "@/lib/seal-share";

export const runtime = "nodejs";

/** GET /og/seal?ms=&on=: the share card for "Seal something on this device". */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const { ms, on } = parseSealShare({ ms: q.get("ms") ?? undefined, on: q.get("on") ?? undefined });
  const title = ms ? sealLine(ms, on) : "Run a post-quantum handshake on your device.";
  return new ImageResponse(
    <OgCard label="Post-quantum, on my device · ML-KEM-768" title={title} />,
    {
      width: 1200,
      height: 630,
      headers: { "cache-control": "public, max-age=86400, immutable" },
    },
  );
}
