/** The visitor's freshly generated keys (public halves only) and how long they took. */
import { notify, world } from "@/components/world/store";
import { workerRpc } from "@/lib/client/worker-rpc";

export interface VisitorKeys {
  kid: string;
  hybridPublicKey: Uint8Array;
  timings: { mlkem: number; hybrid: number; mldsa: number };
  signatureBytes: number;
}

export const visitor: { keys?: VisitorKeys; pending?: Promise<VisitorKeys> } = {};

/**
 * The keys worker stays alive for the page view: it holds the secret keys, and does every
 * verification the page makes (lib/client/trust).
 */
export const keysCall = workerRpc(
  () => new Worker(new URL("../world/keys.worker.ts", import.meta.url)),
);

export function generateVisitorKeys(): Promise<VisitorKeys> {
  visitor.pending ??= keysCall<VisitorKeys & { kemPublicKey: Uint8Array }>("keys").then((d) => {
    world.key = d.kemPublicKey;
    visitor.keys = {
      kid: d.kid,
      hybridPublicKey: d.hybridPublicKey,
      timings: d.timings,
      signatureBytes: d.signatureBytes,
    };
    notify();
    return visitor.keys;
  });
  return visitor.pending;
}
