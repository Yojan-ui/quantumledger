import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/og/card";

export const runtime = "nodejs";

/** GET /og?title=&label=: the OG image for any page, in the site's style. */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = (q.get("title") ?? "Make anything in India quantum-safe. In one line.").slice(
    0,
    120,
  );
  const label = (q.get("label") ?? "Post-quantum security for India").slice(0, 60);
  return new ImageResponse(<OgCard label={label} title={title} />, {
    width: 1200,
    height: 630,
    headers: { "cache-control": "public, max-age=86400, immutable" },
  });
}
