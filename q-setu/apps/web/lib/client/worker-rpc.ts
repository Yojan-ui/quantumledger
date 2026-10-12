"use client";

/**
 * A tiny promise RPC over a module worker: `call(op, args)` posts { rid, op, ...args } and resolves
 * with the worker's { rid, ok, result } (or rejects with its error). One worker per factory.
 */
export function workerRpc(make: () => Worker) {
  let worker: Worker | undefined;
  let rid = 0;
  const waiting = new Map<number, { ok: (v: unknown) => void; fail: (e: Error) => void }>();
  return function call<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    worker ??= (() => {
      const w = make();
      w.onmessage = (
        e: MessageEvent<{ rid: number; ok: boolean; result?: unknown; error?: string }>,
      ) => {
        const p = waiting.get(e.data.rid);
        waiting.delete(e.data.rid);
        if (e.data.ok) p?.ok(e.data.result);
        else p?.fail(new Error(e.data.error));
      };
      return w;
    })();
    const id = ++rid;
    return new Promise<T>((ok, fail) => {
      waiting.set(id, { ok: ok as (v: unknown) => void, fail });
      worker!.postMessage({ rid: id, op, ...args });
    });
  };
}
