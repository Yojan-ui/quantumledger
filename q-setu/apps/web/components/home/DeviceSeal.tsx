"use client";

/**
 * Your device, quantum-safe: one button runs a real ML-KEM-768 handshake and a hybrid seal in this
 * browser (a worker), shows the timings next to the server's live numbers, and makes a share card.
 * Nothing about the device or the visitor is collected; the share link carries only the time.
 */
import { useState } from "react";
import { Button, Container, SectionLabel } from "@/components/ui";
import { CopyHeading } from "@/components/ui/Copy";
import { deviceKind, runOnDevice, type DeviceRun } from "@/lib/client/device-crypto";
import { useMetrics } from "@/lib/client/live";
import { ms } from "@/lib/format";

export function DeviceSeal() {
  const [run, setRun] = useState<DeviceRun>();
  const [kind, setKind] = useState<ReturnType<typeof deviceKind>>("computer");
  const [copied, setCopied] = useState(false);
  const metrics = useMetrics();
  const server = (op: "SEAL" | "OPEN" | "HANDSHAKE") => metrics?.byOp[op]?.p50;
  const share =
    run && typeof window !== "undefined"
      ? `${location.origin}/seal?ms=${run.handshakeMs.toFixed(2)}&on=${kind}`
      : "";
  // Before a run the same table is drawn with empty readings, so the column is never a blank box.
  const rows: [string, number | undefined, number | undefined][] = run
    ? [
        ["ML-KEM-768 key pair", run.keygenMs, undefined],
        ["Encapsulate", run.encapsMs, undefined],
        ["Decapsulate", run.decapsMs, undefined],
        ["Handshake (all three)", run.handshakeMs, server("HANDSHAKE")],
        ["Seal (hybrid + AES-GCM)", run.sealMs, server("SEAL")],
        ["Open", run.openMs, server("OPEN")],
      ]
    : [
        ["ML-KEM-768 key pair", undefined, undefined],
        ["Encapsulate", undefined, undefined],
        ["Decapsulate", undefined, undefined],
        ["Handshake (all three)", undefined, server("HANDSHAKE")],
        ["Seal (hybrid + AES-GCM)", undefined, server("SEAL")],
        ["Open", undefined, server("OPEN")],
      ];
  return (
    <section
      id="device"
      className="crosshairs relative scroll-mt-14 py-10 md:py-15 lg:py-20"
      aria-label="Your device"
    >
      <Container className="grid grid-cols-12 gap-x-6 gap-y-10">
        <div className="col-span-12 md:col-span-5">
          <SectionLabel label="Your device" role="kem" />
          <CopyHeading
            simple="Seal something on this device."
            technical="ML-KEM-768 in your browser, timed."
          />
          <p className="mt-4 max-w-text text-body text-fg-2">
            Your browser generates real ML-KEM-768 key pairs, seals a message to one and opens it
            again, a hundred times each. Nothing leaves this tab except the time, and only if you
            share it.
          </p>
          <div className="mt-8">
            <Button
              variant="primary"
              onClick={async () => {
                setKind(deviceKind());
                setRun(await runOnDevice());
              }}
            >
              {run ? "Run it again" : "Seal something on this device"}
            </Button>
          </div>
        </div>
        <div className="col-span-12 md:col-span-7" aria-live="polite">
          {run ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <table className="w-full font-mono text-label">
                <caption className="sr-only">Timings in this browser and on the server</caption>
                <thead>
                  <tr className="text-left uppercase text-fg-3">
                    <th className="pb-2 font-normal">
                      Median of {run.runs} × {run.batch}
                    </th>
                    <th className="pb-2 text-right font-normal">This browser</th>
                    <th className="pb-2 text-right font-normal">Server, live</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([k, mine, theirs]) => (
                    <tr key={k} className="border-t border-line">
                      <td className="py-2 text-fg-2">{k}</td>
                      <td className="py-2 text-right tabular text-fg">
                        {mine !== undefined ? ms(mine) : "–"}
                      </td>
                      <td className="py-2 text-right tabular text-fg-3">
                        {theirs !== undefined ? ms(theirs) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* The share card (the same words as its OG image). */}
              <figure
                data-sealed
                className="flex flex-col justify-between border border-line-strong bg-raised p-6"
              >
                <p className="font-mono text-label uppercase text-kem">
                  Post-quantum, on my device
                </p>
                <p className="mt-6 text-h3 font-medium text-fg">
                  My {kind} did a post-quantum handshake in {ms(run.handshakeMs)}.
                </p>
                <p className="mt-2 font-mono text-label text-fg-3">
                  ML-KEM-768 · FIPS 203 · median of {run.runs} × {run.batch} · ciphertext{" "}
                  {run.ciphertextBytes} B
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button
                    onClick={async () => {
                      const text = `My ${kind} did a post-quantum handshake in ${ms(run.handshakeMs)}.`;
                      if (navigator.share)
                        await navigator.share({ title: "QuantumLedger", text, url: share });
                      else {
                        await navigator.clipboard.writeText(share);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }
                    }}
                  >
                    {copied ? "Link copied" : "Share"}
                  </Button>
                </div>
              </figure>
            </div>
          ) : (
            <figure className="border border-line p-6">
              <table className="w-full font-mono text-label">
                <caption className="sr-only">Timings in this browser and on the server</caption>
                <thead>
                  <tr className="text-left uppercase text-fg-3">
                    <th className="pb-2 font-normal">Operation</th>
                    <th className="pb-2 text-right font-normal">This browser</th>
                    <th className="pb-2 text-right font-normal">Server, live</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([k, , theirs]) => (
                    <tr key={k} className="border-t border-line">
                      <td className="py-3 text-fg-2">{k}</td>
                      <td className="py-3 text-right text-fg-3">– ms</td>
                      <td className="py-3 text-right text-fg-3">
                        {theirs !== undefined ? ms(theirs) : "– ms"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <figcaption className="mt-4 text-small text-fg-3">
                Results appear here: key generation, encapsulation, decapsulation, sealing and
                opening, each measured in this browser, beside the same operations on the server
                right now.
              </figcaption>
            </figure>
          )}
        </div>
      </Container>
    </section>
  );
}
