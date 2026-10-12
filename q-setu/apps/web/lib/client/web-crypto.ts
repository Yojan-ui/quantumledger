"use client";

import type { SealResult, ServerPublicKeys } from "@qsetu/web-shield";
import { workerRpc } from "./worker-rpc";

const call = workerRpc(
  () => new Worker(new URL("../../workers/web-crypto.worker.ts", import.meta.url)),
);

/** Web shield sealing and reply verification, run in workers/web-crypto.worker.ts. */
export const sealInWorker = (plain: Uint8Array, contentType: string, keys: ServerPublicKeys) =>
  call<SealResult>("seal", { plain, contentType, keys });

export const verifyInWorker = (
  body: Uint8Array,
  signature: string | null,
  nonce: Uint8Array,
  keys: ServerPublicKeys,
) => call<{ ok: boolean; ms: number }>("verify", { body, signature, nonce, keys });

/** Demo 2's forger: signs `message` with a fresh ML-DSA-65 key of their own (base64 signature). */
export const forgeSignature = (message: string) => call<string>("forge", { message });

/** Demo 2's SDK adapter run (session handshake, one request, 200 timed seals) in the worker. */
export const sdkInWorker = (sample: unknown) =>
  call<{
    id: string;
    reply: { status: string; epoch: number };
    handshake: { ms: number; bytesSent: number; bytesReceived: number };
    perMsg: number;
    plainBytes: number;
    wire: { epoch: number; seq: number; head: Uint8Array };
  }>("sdk", { sample });
