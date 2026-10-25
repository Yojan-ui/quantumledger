"use client";

import type { EnvelopeJSON } from "@qsetu/core";

/**
 * Promise wrapper around the phone's crypto worker (workers/room.worker.ts). Every call settles:
 * a worker that fails to load or crashes rejects everything in flight (and the next call starts a
 * fresh one), and a call that gets no answer within CALL_MS rejects instead of hanging the page.
 */
const CALL_MS = 20_000;

/** The phone's crypto stopped (worker failed to load, crashed or timed out). */
export class RoomCryptoError extends Error {}

type Pending = { done: (r: Record<string, unknown>) => void; fail: (e: Error) => void };
let worker: Worker | undefined;
let rid = 0;
const waiting = new Map<number, Pending>();

function drop(reason: string) {
  worker?.terminate();
  worker = undefined;
  const err = new RoomCryptoError(reason);
  for (const p of waiting.values()) p.fail(err);
  waiting.clear();
}

function start(): Worker {
  const w = new Worker(new URL("../../workers/room.worker.ts", import.meta.url));
  w.onmessage = (e: MessageEvent<{ rid: number } & Record<string, unknown>>) => {
    waiting.get(e.data.rid)?.done(e.data);
    waiting.delete(e.data.rid);
  };
  w.onerror = (e) => {
    e.preventDefault();
    drop("This browser couldn't run the encryption.");
  };
  w.onmessageerror = () => drop("This browser couldn't run the encryption.");
  return w;
}

function call<T>(msg: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      worker ??= start();
    } catch {
      return reject(
        new RoomCryptoError("This browser can't run the encryption in the background."),
      );
    }
    const id = ++rid;
    const timer = setTimeout(() => {
      waiting.delete(id);
      drop("The encryption took too long.");
      reject(new RoomCryptoError("The encryption took too long."));
    }, CALL_MS);
    waiting.set(id, {
      done: (r) => {
        clearTimeout(timer);
        if (r.ok) resolve(r as T);
        else reject(new Error(String(r.error)));
      },
      fail: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    worker.postMessage({ ...msg, rid: id });
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
