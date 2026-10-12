import { post } from "../api";
import { feed } from "./feed";
import type { KemResult } from "../types";
import { scenario } from "./scenario";

// handshakes published by Paranoid_MLKEM_Agent drive the same HUD
feed.onKem((r) => scenario.set({ kem: { r, at: performance.now() } }));

/** Run one real ML-KEM handshake on the bridge (liboqs) and surface it on the canvas HUD. */
export async function runKemHandshake(level: 768 | 1024): Promise<void> {
  try {
    const r = await post<KemResult>("/api/kem/handshake", { level });
    scenario.set({ kem: { r, at: performance.now() } });
  } catch { /* bridge offline: nothing to show */ }
}
