/** The visitor's freshly generated keys (public halves only) and how long they took. */
import { notify, world } from "@/components/world/store";

export interface VisitorKeys {
  kid: string;
  hybridPublicKey: Uint8Array;
  timings: { mlkem: number; hybrid: number; mldsa: number };
  signatureBytes: number;
}

export const visitor: { keys?: VisitorKeys; pending?: Promise<VisitorKeys> } = {};

export function generateVisitorKeys(): Promise<VisitorKeys> {
  visitor.pending ??= new Promise((resolve, reject) => {
    const w = new Worker(new URL("../world/keys.worker.ts", import.meta.url));
    w.onmessage = (e) => {
      const d = e.data as {
        kemPublicKey: Uint8Array;
        kid: string;
        hybridPublicKey: Uint8Array;
        timings: VisitorKeys["timings"];
        signatureBytes: number;
      };
      world.key = d.kemPublicKey;
      visitor.keys = {
        kid: d.kid,
        hybridPublicKey: d.hybridPublicKey,
        timings: d.timings,
        signatureBytes: d.signatureBytes,
      };
      w.terminate();
      notify();
      resolve(visitor.keys);
    };
    w.onerror = (e) => reject(new Error(e.message));
    w.postMessage(null);
  });
  return visitor.pending;
}
