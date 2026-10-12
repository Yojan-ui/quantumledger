// Wire types for the bridge WebSocket (see backend/main.py).

export interface Level { px: number; qty: number; n: number; cum: number }
export type L3Row = [id: number, qty: number, participant: number, sigFp: string];

export interface L2Depth {
  type: "L2_DEPTH";
  seq: number;
  ts: number;
  scale: number;
  tick: number;
  bids: Level[];
  asks: Level[];
  l3b: L3Row[];
  l3a: L3Row[];
  mid: number | null;
  spread: number | null;
}

export interface Trade {
  seq: number;
  px: number;
  qty: number;
  aggr: "B" | "S";
  maker: number;
  taker: number;
  mp: number;
  tp: number;
  ts: number;
  verify_ns: number;
  e2e_ns: number;
  wire: number;
  alg: string;
}

/** Inbound order flow as sent to the engine (bridge ORDER_FLOW stream). */
export type FlowMsg =
  | { k: "N"; id: number; p: number; side: 0 | 1; px: number; qty: number; ts: number; alg: string; wire: number; agent?: string }
  | { k: "C"; id: number; p: number; ts: number; alg: string; wire: number; agent?: string };

export interface TelIn {
  window_ns: number; frames: number; bytes: number; accepted: number; rejected: number;
  verify_n: number; verify_p50_ns: number; verify_p99_ns: number; verify_max_ns: number; verify_mean_ns: number;
  verify_ticks_p50: number; verify_est_cycles_p50: number; gate_p50_ns: number;
  ring_depth: number; ring_hwm: number; wire_avg: number; keys: number; policy: string;
}

export interface TelMatch {
  window_ns: number; cmds: number; fills: number; match_p50_ns: number; match_p99_ns: number;
  e2e_p50_ns: number; e2e_p99_ns: number; e2e_max_ns: number; resting: number; pool_cap: number;
  book_bytes: number; total_fills: number; rss: number;
}

export interface SigRow {
  name: string; backend: string; pqc: boolean; sign_ns: number; verify_ns: number; verify_p99_ns: number;
  keygen_ns: number; pk_bytes: number; sk_bytes: number; sig_bytes: number; order_wire_bytes: number;
  verify_per_core_s: number | null; verify_est_cycles: number | null;
}

export interface KemRow {
  name: string; backend: string; available: boolean; keygen_ns: number; encaps_ns: number; decaps_ns: number;
  pk_bytes: number; sk_bytes: number; ct_bytes: number; ss_bytes: number;
}

export interface Handshake {
  kem: string; sig: string; kem_pk: number; kem_ct: number; sig_bytes: number; sig_pk: number; total: number;
  kem_ns: number; sig_verify_ns: number;
}

export interface Comparison {
  sig: SigRow[]; kem: KemRow[]; handshakes: Handshake[]; order_fixed_bytes: number; est_core_ghz: number;
  cpu: string; counter: string; counter_hz: number; liboqs: string;
}

export interface Telemetry {
  type: "CRYPTO_TELEMETRY";
  tel_in: TelIn | null;
  tel_match: TelMatch | null;
  comparison: Comparison | null;
  client_sign_us: number | null;
}

export interface Controls {
  playback: boolean; rate: number; threat_level: number; threat_name: string; nist_level: 3 | 5;
}

export interface Status {
  type: "ENGINE_STATUS";
  connected: boolean;
  hb_age_ms: number | null;
  hb_seq: number | null;
  uptime_ns: number | null;
  evt_drops: number | null;
  policy: string;
  keys: number;
  desks: number;
  controls: Controls;
  generator: { achieved_rate: number; frames_out: number };
  adversary: { harvested_bytes: number; harvested_frames: number; sent_by_kind: Record<string, number> };
  rejects: Record<string, number>;
  breaches: number;
  open_orders: number;
  agents?: Record<string, number>;
}

export interface LogLine {
  ts: number;
  level: "info" | "warn" | "drop" | "crit" | "ok";
  tag: string;
  msg: string;
  attack?: string;
  wire?: number;
}

export interface Hello {
  liboqs: string; scale: number; tick: number; cpu: string; counter: string; counter_hz: number;
  est_core_ghz: number; order_fixed_bytes: number; levels: number; max_orders: number;
}

export interface HarvestChannel {
  channel: string;
  kex: string;
  handshake_bytes: number;
  harvested_bytes: number;
  seal_us?: number;
  ciphertext_head: string;
  ct_dump?: string;
  pt_dump?: string;
  qday: {
    status: "EXPOSED" | "SEALED";
    method: string;
    orders_recovered: number | null;
    notional?: string;
    nist_category?: number;
    sample?: { id: number; desk: string; side: string; px: string; qty: string; alg: string }[];
  };
}

/** One real ML-KEM session establishment (POST /api/kem/handshake). */
export interface KemResult {
  level: 768 | 1024; pk_bytes: number; ct_bytes: number; ss_bytes: number;
  keygen_ns: number; encaps_ns: number; decaps_ns: number; match: boolean;
  pk_head: string; ct_head: string; k_fp: string;
  agent?: string; session?: number;     // set when published by Paranoid_MLKEM_Agent
}

/** QuantumLedger proof-log entry (bridge quantumledger.py). */
export interface QlSig { bytes: number; sign_ns: number; ok: boolean; head: string }
export interface QlEntry {
  index: number; ts: string; kind: string; leaf: string; root: string; size: number;
  ed25519: QlSig; mldsa65: QlSig; inclusion_ok: boolean; summary: string;
}
export interface QlMetrics {
  kex_ns: number; sign_verify_ns: number; runs: number; sig_bytes: number; pk_bytes: number;
  client_share: number; server_share: number; kex_ok: boolean; sig_ok: boolean;
}

export interface HarvestResult {
  ok: boolean;
  reason?: string;
  frames: number;
  plaintext_bytes: number;
  channels: HarvestChannel[];
}
