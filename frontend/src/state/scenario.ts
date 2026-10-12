// Terminal posture, quantum-breach drill state, drill log and wire-inspector target.
//
// "CLASSICAL" is a counterfactual view: the engine gate only verifies ML-DSA,
// so selecting it leaves the engine on its current PQC level and switches the
// HUD to the engine's measured ECDSA-P256 benchmark. The 3D scene reads
// `scenario.state` inside useFrame; React components use useScenario().

import { useSyncExternalStore } from "react";
import type { HarvestResult, KemResult, LogLine } from "../types";

export type CryptoMode = "CLASSICAL" | "L3" | "L5";

export const MODE_ALG: Record<CryptoMode, string> = { CLASSICAL: "ECDSA-P256", L3: "ML-DSA-65", L5: "ML-DSA-87" };

export interface AttackRun {
  mode: CryptoMode;
  startedAt: number;            // performance.now() ms
  phase: "running" | "done";
  harvest: HarvestResult | { error: string } | null;
}

/** What the wire inspector should open: a captured order frame by id. */
export interface InspectTarget { oid: number; title: string; representative?: boolean }

export interface DrillLine extends LogLine { drill: true }

/** Audit-log line that can open the packet inspector. */
export interface InspectableLine extends LogLine { oid?: number }

interface ScenarioState {
  classical: boolean;           // counterfactual classical view selected
  attack: AttackRun | null;
  breached: boolean;            // classical harvest succeeded; cleared on reset / posture change
  drill: DrillLine[];           // drill output merged into the threat feed
  inspect: InspectTarget | null;
  mtu: 1500 | 9000;             // link MTU modelled by the network profiler
  kem: { r: KemResult; at: number } | null;   // last real ML-KEM handshake, shown as a transient HUD
}

type Listener = () => void;

class Scenario {
  state: ScenarioState = { classical: true, attack: null, breached: false, drill: [], inspect: null, mtu: 1500, kem: null };
  private listeners = new Set<Listener>();

  set(patch: Partial<ScenarioState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  log(level: LogLine["level"], tag: string, msg: string): void {
    const line: DrillLine = { ts: Date.now() * 1e6, level, tag, msg, drill: true };
    this.set({ drill: this.state.drill.concat(line).slice(-120) });
  }
  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const scenario = new Scenario();

export function useScenario<T>(select: (s: ScenarioState) => T): T {
  return useSyncExternalStore(scenario.subscribe, () => select(scenario.state));
}

export function modeOf(classical: boolean, nistLevel: 3 | 5 | undefined): CryptoMode {
  return classical ? "CLASSICAL" : nistLevel === 5 ? "L5" : "L3";
}

/** Seconds since the current drill started, or Infinity when none. */
export function attackAge(now = performance.now()): number {
  const a = scenario.state.attack;
  return a ? (now - a.startedAt) / 1000 : Infinity;
}
