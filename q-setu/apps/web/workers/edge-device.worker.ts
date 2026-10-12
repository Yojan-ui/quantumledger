/// <reference lib="webworker" />
/**
 * A simulated IoT device (QuantumLedger Edge profile: ML-KEM-512 + ML-DSA-44) inside a Web Worker,
 * with an accounted RAM budget and a throttled CPU. The gateway runs on the page.
 */
import { base64ToBytes, bytesToBase64, getSig } from "@qsetu/core";
import { EdgeDevice, type Budget } from "@qsetu/edge";

let device: EdgeDevice | undefined;

type In =
  | { type: "init"; deviceId: string; gatewayKey: string; budget: Budget; batchSize: number }
  | { type: "hello" }
  | { type: "finish"; serverHello: Parameters<EdgeDevice["finish"]>[0] }
  | { type: "readings"; n: number; unit: string; base: number };

self.onmessage = (e: MessageEvent<In>) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      const key = getSig("ml-dsa-44").keygen(); // provisioned at the factory, in real life
      device = new EdgeDevice(m.deviceId, key, base64ToBytes(m.gatewayKey), m.budget, m.batchSize);
      postMessage({
        type: "ready",
        devicePublicKey: bytesToBase64(key.publicKey),
        stats: device.stats(),
      });
    } else if (m.type === "hello") {
      postMessage({ type: "hello", hello: device!.hello() });
    } else if (m.type === "finish") {
      postMessage({
        type: "finish",
        finish: device!.finish(m.serverHello),
        stats: device!.stats(),
      });
    } else if (m.type === "readings") {
      for (let i = 0; i < m.n; i++) {
        const v = Math.round((m.base + Math.sin(i / 3) * m.base * 0.04 + Math.random()) * 10) / 10;
        const out = device!.reading({ t: Date.now(), v, u: m.unit });
        postMessage({ type: "reading", ...out });
      }
      postMessage({ type: "stats", stats: device!.stats() });
    }
  } catch (err) {
    postMessage({ type: "error", message: (err as Error).message });
  }
};
