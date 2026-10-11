import type { OpEvent } from "@/lib/live/types";

const pad = (n: number) => String(n).padStart(2, "0");

export const clock = (at: number) => {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const opMs = (v: number) => (v < 10 ? `${v.toFixed(2)} ms` : `${v.toFixed(1)} ms`);

export const opBytes = (n?: number) => (n === undefined ? "" : `${n.toLocaleString("en-IN")} B`);

/** One ticker/console line, as columns: time, OP, alg, bytes, ms, mark, detail. */
export function opColumns(e: OpEvent) {
  const failed = !e.ok && e.op !== "SCAN";
  return {
    time: clock(e.at),
    op: e.op,
    alg: e.alg,
    bytes: opBytes(e.bytes),
    ms: opMs(e.ms),
    mark: e.op === "SCAN" ? (e.ok ? "✓" : "!") : failed ? "✗" : "✓",
    failed,
    detail: e.detail ?? "",
  };
}
