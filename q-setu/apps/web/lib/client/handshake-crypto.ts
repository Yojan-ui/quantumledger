"use client";

import type { ProfileId } from "@qsetu/core";
import { workerRpc } from "./worker-rpc";

/** Demo 1's handshake, one step per call, run in workers/handshake.worker.ts. */
const call = workerRpc(
  () => new Worker(new URL("../../workers/handshake.worker.ts", import.meta.url)),
);

export const hs = {
  identity: (profile: ProfileId) => call<{ publicKeyBytes: number }>("identity", { profile }),
  hello: (profile: ProfileId) =>
    call<{ x25519: Uint8Array; bytes: number; ms: number }>("hello", { profile }),
  respond: () =>
    call<{
      kemPublicKey: Uint8Array;
      kemPkBytes: number;
      sigBytes: number;
      bytes: number;
      ms: number;
    }>("respond"),
  finish: () =>
    call<{
      kemCiphertext: Uint8Array;
      bytes: number;
      sessionId: string;
      tc: number;
      ts: number;
      transcriptSha3: string;
      sharedSecretBytes: number;
    }>("finish"),
  sha3: (text: string) => call<string>("sha3", { text }),
  messages: (n: number) =>
    call<{
      per: number;
      opened: number;
      plainBytes: number;
      sealed: { seq: number; ctBytes: number; head: Uint8Array }[];
    }>("messages", { n }),
  attack: (profile: ProfileId) =>
    call<{ rejected: boolean; error?: string; ms: number; bytes: number; tail: Uint8Array }>(
      "attack",
      { profile },
    ),
};
