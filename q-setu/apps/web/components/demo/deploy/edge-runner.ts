"use client";

import { bytesToBase64 } from "@qsetu/core";
import { EdgeGateway, type DeviceStats } from "@qsetu/edge";
import type { SectorId } from "@qsetu/sim";

const DEVICE: Record<SectorId, { id: string; unit: string; base: number }> = {
  fintech: { id: "pos-patna-07", unit: "INR", base: 240 },
};

export interface EdgeRun {
  deviceId: string;
  stats: DeviceStats;
  readings: number;
  batchesVerified: number;
  lastReading: { v: number; u: string };
  sampleCiphertext: string;
}

/** Runs one device through its handshake and `n` readings within a 64 KB / 20× slower budget. */
export function runEdge(sector: SectorId, n = 48): Promise<EdgeRun> {
  const d = DEVICE[sector];
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../../workers/edge-device.worker.ts", import.meta.url));
    let gateway: EdgeGateway;
    const gatewayIdentity = new EdgeGateway(new Map()).identity;
    let sample = "";
    let last = { v: 0, u: d.unit };
    const done = (f: () => void) => {
      worker.terminate();
      f();
    };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "error") return done(() => reject(new Error(m.message)));
      if (m.type === "ready") {
        gateway = new EdgeGateway(
          new Map([[d.id, Uint8Array.from(atob(m.devicePublicKey), (c) => c.charCodeAt(0))]]),
          gatewayIdentity,
        );
        worker.postMessage({ type: "hello" });
      } else if (m.type === "hello") {
        worker.postMessage({ type: "finish", serverHello: gateway.hello(m.hello) });
      } else if (m.type === "finish") {
        gateway.finish(m.finish);
        worker.postMessage({ type: "readings", n, unit: d.unit, base: d.base });
      } else if (m.type === "reading") {
        const r = gateway.reading(m.message);
        last = { v: r.v, u: r.u };
        sample ||= m.message.ciphertext;
        if (m.proof && !gateway.verifyBatch(m.proof))
          done(() => reject(new Error("Batch signature failed")));
      } else if (m.type === "stats") {
        done(() =>
          resolve({
            deviceId: d.id,
            stats: m.stats,
            readings: gateway.accepted.length,
            batchesVerified: gateway.verifiedBatches.length,
            lastReading: last,
            sampleCiphertext: sample,
          }),
        );
      }
    };
    worker.onerror = (e) => done(() => reject(new Error(e.message)));
    worker.postMessage({
      type: "init",
      deviceId: d.id,
      gatewayKey: bytesToBase64(gatewayIdentity.publicKey),
      budget: { ramBytes: 64 * 1024, cpuSlowdown: 20 },
      batchSize: 16,
    });
  });
}
