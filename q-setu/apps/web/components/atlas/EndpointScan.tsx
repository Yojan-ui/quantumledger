"use client";

import Link from "next/link";
import type { AtlasResults } from "@/lib/client/atlas";

type Live = {
  handshake_ok?: boolean;
  protocol?: string;
  group?: string;
  kex_family?: string;
  error?: string;
  chain?: { key: string; signature_algorithm: string; not_after: string }[];
};

/** One line per host from the run's Detect probes (recorded handshake fields only). */
function ScanResult({ results }: { results: AtlasResults }) {
  const probes = (
    (results.detect as { probes?: { endpoint: string; live: Live }[] } | null)?.probes ?? []
  ).filter((p) => p.live.chain || p.live.error);
  if (!probes.length) return null;
  return (
    <ul aria-label="Handshake per host" className="space-y-1 text-small text-fg-2">
      {probes.map(({ endpoint, live }) => (
        <li key={endpoint} className="break-words">
          <strong className="font-medium text-fg">{endpoint}</strong>:{" "}
          {live.handshake_ok
            ? `${live.protocol} · ${live.group ?? "RSA key transport"} (${live.kex_family === "PQC" ? "hybrid post-quantum" : "classical"}) · cert ${live.chain?.[0]?.key ?? "–"}, ${live.chain?.[0]?.signature_algorithm ?? "–"}, expires ${live.chain?.[0]?.not_after.slice(0, 10) ?? "–"}`
            : `no handshake (${live.error ?? "timed out or refused"})`}
        </li>
      ))}
    </ul>
  );
}

/**
 * The pipeline's link to the one scanner (the home page's live TLS scan, whose "Send to pipeline" creates
 * a workspace here), plus each host's recorded handshake when this workspace came from a live scan.
 */
export function EndpointScan({ results }: { results?: AtlasResults | null }) {
  return (
    <section id="endpoint" className="scroll-mt-16 space-y-3 rounded-lg border border-line p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-h3 font-medium text-fg">Live scan</h2>
        <Link
          prefetch={false}
          href="/#scan"
          className="text-small text-fg-2 underline underline-offset-4 hover:text-fg"
        >
          Scan a public site, then send it to the pipeline →
        </Link>
      </div>
      {results && <ScanResult results={results} />}
    </section>
  );
}
