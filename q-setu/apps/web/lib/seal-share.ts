/** The share link's two values, validated: a time (0.01–10,000 ms) and a coarse device class. */
export function parseSealShare(q: { ms?: string; on?: string }) {
  const n = Number(q.ms);
  const msOk = Number.isFinite(n) && n >= 0.01 && n <= 10_000 ? n : undefined;
  const on = q.on === "phone" || q.on === "tablet" || q.on === "computer" ? q.on : "device";
  return { ms: msOk, on };
}

export const sealLine = (ms: number, on: string) =>
  `My ${on} did a post-quantum handshake in ${ms < 1 ? ms.toFixed(2) : ms.toFixed(1)} ms.`;
