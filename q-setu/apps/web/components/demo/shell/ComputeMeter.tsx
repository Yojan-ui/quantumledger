"use client";

import type { ProfileId } from "@qsetu/core";
import { Container, Label, MiniStat } from "@/components/ui";
import { useMetrics } from "@/lib/client/live";
import { useBench } from "@/lib/client/useBench";
import { bytes, ms, us } from "@/lib/format";

/** Assumed duration of a typical web/API request. Used only to express crypto cost as a percentage. */
export const TYPICAL_REQUEST_MS = 100;

export interface MeterReading {
  label: string;
  /** Measured CPU time for the crypto in this operation (or added latency, see `cpuLabel`). */
  cpuMs?: number;
  cpuLabel?: string;
  /** Cost attributable to one request/message, for the percentage (defaults to cpuMs). */
  perRequestMs?: number;
  perRequestHint?: string;
  bytesAdded?: number;
  plainBytes?: number;
  extra?: { label: string; value: string }[];
}

/** The Compute Meter: what the last step actually cost, measured, beside one handshake vs 1,000 messages. */
export function ComputeMeter({
  reading,
  profile = "standard",
}: {
  reading?: MeterReading;
  profile?: ProfileId;
}) {
  const bench = useBench();
  const live = useMetrics();
  const s = bench?.sessions.find((x) => x.profile === profile);
  const seal = live?.byOp.SEAL;
  const per = reading?.perRequestMs ?? reading?.cpuMs;
  const pct = per !== undefined ? (per / TYPICAL_REQUEST_MS) * 100 : undefined;
  const items: [string, string][] = [
    [reading?.cpuMs !== undefined ? ms(reading.cpuMs) : "–", reading?.cpuLabel ?? "Crypto CPU"],
    [reading?.bytesAdded !== undefined ? bytes(reading.bytesAdded) : "–", "Bytes added"],
    // Before a step runs, the third cell shows the live bus instead of an empty percentage.
    pct !== undefined
      ? [`${pct < 0.1 ? pct.toFixed(3) : pct.toFixed(1)}%`, `Of a ${TYPICAL_REQUEST_MS} ms request`]
      : [seal ? `${ms(seal.p50)} / ${ms(seal.p95)}` : "…", "Live seal p50 / p95"],
    [
      reading?.extra?.[0]?.value ?? (s ? us(s.perMessageUs) : "–"),
      reading?.extra?.[0]?.label ?? "Per message",
    ],
    [
      s ? `${ms(s.handshakeMs)} / ${ms((s.perMessageUs * 1000) / 1000)}` : "…",
      "1 handshake / 1,000 messages",
    ],
  ];
  return (
    <section aria-label="Compute Meter">
      <Container className="flex flex-wrap items-center gap-y-3 py-4">
        <div className="mr-8 w-full md:w-auto">
          <Label as="p" tone="strong">
            Compute meter
          </Label>
          <p className="mt-1 text-small text-fg-3">{reading?.label ?? "Run a step to measure"}</p>
        </div>
        {items.map(([v, l], i) => (
          <div key={i} className={`pr-6 ${i > 0 ? "md:border-l md:border-line md:pl-6" : ""}`}>
            <MiniStat value={v} label={l} />
          </div>
        ))}
      </Container>
    </section>
  );
}
