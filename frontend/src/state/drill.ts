// Quantum-breach drill.
//
// Classical posture: runs the real harvest-now-decrypt-later simulation over
// the tap's captured frames. Q-day is simulated (a labelled oracle stands in
// for Shor's algorithm); the AES-GCM decryption that follows is real, so the
// counterparty IDs streamed into the feed are genuinely recovered from traffic.
//
// PQC posture: three real adversarial frames go through the engine gate and
// the same harvest runs against the ML-KEM channel. Verdicts are the engine's.

import { post } from "../api";
import type { HarvestResult } from "../types";
import { MODE_ALG, scenario, type CryptoMode } from "./scenario";

const PQC_PROBES = ["CLASSICAL", "FORGE", "SPOOF"] as const;
const STAGGER_MS = 140;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runBreachDrill(mode: CryptoMode): Promise<void> {
  scenario.set({ attack: { mode, startedAt: performance.now(), phase: "running", harvest: null } });
  const vuln = mode === "CLASSICAL";
  scenario.log("warn", "Q-DAY SIM", `harvest-now-decrypt-later vs ${vuln ? "ECDSA / X25519" : `${MODE_ALG[mode]} / ML-KEM`} · oracle stands in for Shor`);

  let harvest: HarvestResult | { error: string };
  try { harvest = await post<HarvestResult>("/api/threat/harvest-sim", { frames: 64 }); }
  catch (e) { harvest = { error: (e as Error).message }; }

  const still = () => scenario.state.attack?.mode === mode && scenario.state.attack.phase === "running";
  if (!still()) return;

  if ("error" in harvest || !harvest.ok) {
    scenario.log("warn", "Q-DAY SIM", "error" in harvest ? harvest.error : harvest.reason ?? "harvest failed");
    scenario.set({ attack: { ...scenario.state.attack!, phase: "done", harvest } });
    return;
  }

  if (vuln) {
    const ch = harvest.channels.find((c) => c.channel.startsWith("X25519"));
    scenario.set({ attack: { ...scenario.state.attack!, phase: "done", harvest }, breached: true });
    scenario.log("crit", "HARVESTED", "ECDLP SOLVED · X25519 session key recovered · AES-256-GCM order stream decrypted");
    for (const o of ch?.qday.sample ?? []) {
      await sleep(STAGGER_MS);
      if (!scenario.state.breached) return;
      scenario.log("crit", "HARVESTED", `${o.desk} ${o.side} ${o.qty} @ ${o.px} · order #${o.id} · signer ${o.desk} exposed`);
    }
    await sleep(STAGGER_MS);
    if (ch && scenario.state.breached) {
      scenario.log("crit", "EXPOSED", `${ch.qday.orders_recovered} orders · notional ${ch.qday.notional} · ECDSA-P256 signing keys recoverable`);
    }
    return;
  }

  for (const kind of PQC_PROBES) {
    try {
      const r = await post<any>("/api/trade/inject", { mode: "attack", attack: kind });
      const gate = r.engine?.gate_ns ? ` gate ${(r.engine.gate_ns / 1000).toFixed(1)} µs` : "";
      if (r.verdict === "ACK") scenario.log("crit", "BREACH", `${kind} #${r.id} accepted by engine`);
      else scenario.log("ok", "DROP", `ML-DSA LATTICE HARDNESS INTACT · ${kind} → ${r.skipped ? "skipped" : r.verdict}${gate}`);
    } catch (e) {
      scenario.log("warn", "DROP", `${kind}: ${(e as Error).message}`);
    }
    await sleep(STAGGER_MS);
  }
  const ml = harvest.channels.find((c) => c.channel.startsWith("ML-KEM"));
  if (ml) scenario.log("ok", "SEALED", `${ml.channel} · ${ml.qday.method}`);
  scenario.set({ attack: { ...scenario.state.attack!, phase: "done", harvest } });
}

export function resetBreach(): void {
  scenario.set({ breached: false, attack: null });
  scenario.log("info", "RESTORE", "breach drill cleared");
}
