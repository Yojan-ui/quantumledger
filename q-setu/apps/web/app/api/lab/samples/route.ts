import { SCAN_SAMPLES } from "@qsetu/core";
import { countLines, sha256 } from "@/lib/lab/inputs";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /api/lab/samples: the scanner's sample inputs, labelled "Sample data" in the UI. */
export function GET() {
  return Response.json({
    label: "Sample data",
    samples: SCAN_SAMPLES.map((s) => ({
      ...s,
      bytes: Buffer.byteLength(s.text),
      lines: countLines(s.text),
      sha256: sha256(s.text),
    })),
  });
}
