"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui";
import { Odometer } from "@/components/ui/Odometer";
import { generateVisitorKeys } from "@/components/home/visitor";
import { onLive, useMetrics } from "@/lib/client/live";
import { opColumns } from "@/lib/client/oplines";
import type { OpEvent } from "@/lib/live/types";

/** Operations worth a ticker line (the mesh also emits OPEN/SIGN; they add nothing a reader needs). */
const SHOWN = new Set([
  "SEAL",
  "VERIFY",
  "REJECT",
  "HANDSHAKE",
  "ROTATE",
  "POLICY",
  "LEDGER",
  "KEYGEN",
  "SCAN",
]);
const EVERY_MS = 450;

/**
 * The live system strip: a thin mono ticker of real operations from the bus, one new line every
 * ~450 ms (rejections are never skipped), plus a live ops/sec count. Colours: --text-3, with the
 * accent only on ✓ and saffron only on ✗. Reduced motion: lines swap without sliding.
 */
export function LiveStrip() {
  const [line, setLine] = useState<OpEvent>();
  const metrics = useMetrics();
  const queue = useRef<OpEvent | undefined>(undefined);
  const streamingRef = useRef(false);
  // The preloader is real work: this browser generates its own ML-KEM-768 key pair, timed.
  const [key, setKey] = useState<{ ms?: number; kid?: string }>({});
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    void generateVisitorKeys()
      .then((k) => {
        setKey({ ms: k.timings.mlkem, kid: k.kid });
        t = setTimeout(() => {
          streamingRef.current = true;
          setStreaming(true);
        }, 2200);
      })
      .catch(() => {
        streamingRef.current = true;
        setStreaming(true);
      });
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const off = onLive((e) => {
      if (!SHOWN.has(e.op)) return;
      // Keep the most interesting pending line: a rejection beats anything else.
      if (!queue.current || e.op === "REJECT" || queue.current.op !== "REJECT") queue.current = e;
    });
    const t = setInterval(() => {
      if (queue.current && streamingRef.current) {
        setLine(queue.current);
        queue.current = undefined;
      }
    }, EVERY_MS);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);

  const c = streaming ? line && opColumns(line) : undefined;
  const rate = metrics ? metrics.opsPerSec.toFixed(1) : "0.0";
  return (
    <div className="border-b border-line" aria-label="Live operations">
      <Container className="flex h-8 items-center gap-6 font-mono text-label uppercase text-fg-3">
        <div className="relative h-4 min-w-0 flex-1 overflow-hidden">
          {!streaming && (
            <p className="absolute inset-0 flex animate-tick-in gap-4 whitespace-nowrap normal-case">
              {key.ms === undefined ? (
                <span>Generating your ML-KEM-768 key…</span>
              ) : (
                <>
                  <span>
                    Your ML-KEM-768 key <span className="text-fg-2">{key.kid}</span> · generated in
                    this browser in{" "}
                    <span className="tabular text-fg-2">{key.ms.toFixed(2)} ms</span>
                  </span>
                  <span className="text-ok">✓</span>
                </>
              )}
            </p>
          )}
          {c && line && (
            <p
              key={line.seq}
              className="absolute inset-0 flex animate-tick-in gap-4 whitespace-nowrap"
            >
              <span>{c.time}</span>
              <span className="w-16 shrink-0">{c.op}</span>
              <span className="hidden normal-case md:inline">{c.alg}</span>
              <span className="hidden md:inline">{c.bytes}</span>
              <span className="hidden md:inline">{c.ms}</span>
              <span className={c.failed ? "text-danger" : "text-ok"}>{c.mark}</span>
              <span className="hidden truncate normal-case lg:inline">{c.detail}</span>
            </p>
          )}
        </div>
        {process.env.NEXT_PUBLIC_OFFLINE === "1" && (
          <span className="hidden shrink-0 text-fg-3 md:inline">
            Offline mode · scans from cache
          </span>
        )}
        <p className="flex shrink-0 items-center gap-2 text-fg-2">
          <span className="block h-dot w-dot animate-live rounded-full bg-accent" aria-hidden />
          Live · <Odometer value={rate} /> ops/sec
        </p>
      </Container>
    </div>
  );
}
