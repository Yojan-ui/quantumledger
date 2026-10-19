"use client";

import { workerRpc } from "./worker-rpc";

export interface DeviceRun {
  runs: number;
  /** Operations per timed batch (the browser's clock is too coarse to time one). */
  batch: number;
  keygenMs: number;
  encapsMs: number;
  decapsMs: number;
  /** ML-KEM-768 keygen + encapsulate + decapsulate (medians). */
  handshakeMs: number;
  sealMs: number;
  openMs: number;
  ciphertextBytes: number;
  envelopeBytes: number;
}

const call = workerRpc(
  () => new Worker(new URL("../../workers/device.worker.ts", import.meta.url)),
);

/** Real ML-KEM-768 and hybrid sealing in this browser (workers/device.worker.ts). */
export const runOnDevice = () => call<DeviceRun>("run");

/** A coarse device class for the share card (no model, no browser, nothing identifying). */
export function deviceKind(): "phone" | "tablet" | "computer" {
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (coarse && Math.min(screen.width, screen.height) < 600) return "phone";
  if (coarse) return "tablet";
  return "computer";
}
