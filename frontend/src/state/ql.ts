// QuantumLedger client state: the proof log (mirrors the bridge, live via
// QL_LEDGER), the FR-4 remediation phase and its measured metrics.

import { useSyncExternalStore } from "react";
import { post } from "../api";
import type { QlEntry, QlMetrics } from "../types";
import { feed } from "./feed";
import { scenario } from "./scenario";

export type PatchPhase = "legacy" | "patching" | "patched";
export interface PatchLine { t: string; cls?: string }

interface QlState {
  entries: QlEntry[];            // newest last
  root: string | null;
  size: number;
  phase: PatchPhase;
  lines: PatchLine[];
  metrics: QlMetrics | null;
}

type Listener = () => void;
class QlStore {
  state: QlState = { entries: [], root: null, size: 0, phase: "legacy", lines: [], metrics: null };
  private ls = new Set<Listener>();
  set(p: Partial<QlState>) { this.state = { ...this.state, ...p }; this.ls.forEach((l) => l()); }
  subscribe = (l: Listener) => { this.ls.add(l); return () => this.ls.delete(l); };
}
export const ql = new QlStore();
export const useQl = <T,>(sel: (s: QlState) => T): T => useSyncExternalStore(ql.subscribe, () => sel(ql.state));

const addEntry = (e: QlEntry) => {
  if (ql.state.entries.some((x) => x.index === e.index)) return;
  ql.set({ entries: ql.state.entries.concat(e).slice(-200), root: e.root, size: e.size });
};
feed.onQl(addEntry);

export async function loadLedger(): Promise<void> {
  try {
    const r = await fetch("/api/ql/ledger").then((x) => x.json());
    ql.set({ entries: r.entries, root: r.root, size: r.size });
  } catch { /* bridge offline */ }
}

const LINE_MS = 140;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Target starts on the legacy terminator (classical what-if posture). */
export function setLegacy(): void {
  scenario.set({ classical: true, breached: false, attack: null });
  ql.set({ phase: "legacy", lines: [], metrics: null });
}

/** FR-4: model the hybrid terminator deployment; the measured operations run on the bridge. */
export async function deployHybrid(): Promise<void> {
  if (ql.state.phase === "patching") return;
  const push = (l: PatchLine) => ql.set({ lines: ql.state.lines.concat(l) });
  ql.set({ phase: "patching", lines: [], metrics: null });
  push({ t: "> FR-4 remediation · target aetherpool-order-entry", cls: "cmd" });
  push({ t: "Injecting OpenSSL 3.5 hybrid terminator... (modelled deployment)" });
  let res: { metrics: QlMetrics; entry: QlEntry };
  try { res = await post("/api/ql/remediate"); }
  catch (e) { push({ t: `FAILED: ${(e as Error).message}`, cls: "bad" }); ql.set({ phase: "legacy" }); return; }
  const m = res.metrics, ms = (ns: number) => `${(ns / 1e6).toFixed(2)} ms`;
  await sleep(LINE_MS);
  push({ t: `Negotiating X25519MLKEM768... ${ms(m.kex_ns)} ${m.kex_ok ? "OK" : "MISMATCH"} · shares ${m.client_share.toLocaleString("en-US")} B / ${m.server_share.toLocaleString("en-US")} B`, cls: m.kex_ok ? "ok" : "bad" });
  await sleep(LINE_MS);
  push({ t: `Verifying ML-DSA-65... ${ms(m.sign_verify_ns)} ${m.sig_ok ? "OK" : "FAIL"} · sig ${m.sig_bytes.toLocaleString("en-US")} B`, cls: m.sig_ok ? "ok" : "bad" });
  await sleep(LINE_MS);
  const e = res.entry;
  push({ t: `Evidence leaf #${e.index} → root ${e.root.slice(0, 16)}… · Ed25519 ${e.ed25519.ok ? "OK" : "FAIL"} + ML-DSA-65 ${e.mldsa65.ok ? "OK" : "FAIL"}`, cls: e.ed25519.ok && e.mldsa65.ok ? "ok" : "bad" });
  addEntry(e);
  ql.set({ phase: "patched", metrics: m });
  scenario.set({ classical: false, breached: false, attack: null });
}
