"use client";

import type { EnvelopeJSON } from "@qsetu/core";

/** Promise wrapper around the phone's crypto worker (workers/room.worker.ts). */
let worker: Worker | undefined;
let rid = 0;
const waiting = new Map<number, (r: Record<string, unknown>) => void>();

function call<T>(msg: Record<string, unknown>): Promise<T> {
  worker ??= (() => {
    const w = new Worker(new URL("../../workers/room.worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<{ rid: number } & Record<string, unknown>>) => {
      waiting.get(e.data.rid)?.(e.data);
      waiting.delete(e.data.rid);
    };
    return w;
  })();
  const id = ++rid;
  return new Promise<T>((resolve, reject) => {
    waiting.set(id, (r) => (r.ok ? resolve(r as T) : reject(new Error(String(r.error)))));
    worker!.postMessage({ ...msg, rid: id });
  });
}

export const roomKeygen = () =>
  call<{ publicKey: string; kid: string; ms: number; publicBytes: number }>({ type: "keygen" });

export const roomSeal = (text: string, roomKey: string, visitorId: string, tamper: boolean) =>
  call<{ envelope: EnvelopeJSON; ms: number; bytes: number; preview: string; kemPreview: string }>({
    type: "seal",
    text,
    roomKey,
    visitorId,
    tamper,
  });

export const roomReceipt = (receipt: EnvelopeJSON, visitorId: string, text: string) =>
  call<{ matches: boolean; sha3: string; n: number; ms: number }>({
    type: "receipt",
    receipt,
    visitorId,
    text,
  });
