/// <reference lib="webworker" />
/**
 * Q-Day in the browser, off the main thread: factor every recorded classical (tiny-RSA stand-in)
 * modulus and decrypt what was recorded, with the simulator's own breakClassical. The page keeps
 * staging the result while this works.
 */
import { breakClassical, type HarvestRecord } from "@qsetu/sim";

self.onmessage = (e: MessageEvent<{ rid: number; op: "break"; records: HarvestRecord[] }>) => {
  try {
    const t = performance.now();
    const outcomes = breakClassical(e.data.records);
    postMessage({ rid: e.data.rid, ok: true, result: { outcomes, ms: performance.now() - t } });
  } catch (err) {
    postMessage({ rid: e.data.rid, ok: false, error: (err as Error).message });
  }
};
