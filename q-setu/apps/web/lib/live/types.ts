/** Shapes shared by the live event bus (server) and everything that renders it (ticker, globe, consoles). */

export type Op =
  | "SEAL"
  | "OPEN"
  | "SIGN"
  | "VERIFY"
  | "REJECT"
  | "HANDSHAKE"
  | "ROTATE"
  | "KEYGEN"
  | "POLICY"
  | "LEDGER"
  | "SCAN";

/** Which part of Q-Setu produced the event. */
export type Source =
  | "mesh"
  | "sim"
  | "shield"
  | "web"
  | "sdk"
  | "edge"
  | "vault"
  | "certs"
  | "ledger"
  | "kms"
  | "policy"
  | "scanner"
  | "browser"
  | "room";

export interface OpEvent {
  /** Monotonic per process. */
  seq: number;
  /** Epoch milliseconds. */
  at: number;
  op: Op;
  source: Source;
  /** Algorithm ID(s), e.g. "ml-kem-768+x25519" or "ml-dsa-65". */
  alg: string;
  /** Measured wall time of the operation, in milliseconds. */
  ms: number;
  bytes?: number;
  ok: boolean;
  /** Route index (0–11) when the operation travelled a mesh route. */
  route?: number;
  from?: string;
  to?: string;
  sector?: string;
  /** Demo 2 site ID (e.g. "fintech-shield") when a deployed node did the work. */
  site?: string;
  detail?: string;
}

export interface OpStats {
  count: number;
  p50: number;
  p95: number;
}

export interface CityStats {
  sealed: number;
  rejected: number;
  avgMs: number;
}

export interface Metrics {
  /** Seconds covered by the rolling window. */
  windowSec: number;
  /** Operations per second over the last 5 s. */
  opsPerSec: number;
  /** Operations since the server started. */
  total: number;
  byOp: Partial<Record<Op, OpStats>>;
  byCity: Record<string, CityStats>;
  bySite: Record<string, number>;
  policy: PolicyState;
}

export type ProfileName = "standard" | "edge";
export type SigName = "ml-dsa-65" | "ml-dsa-44" | "slh-dsa-sha2-128f";

export interface PolicyState {
  profile: ProfileName;
  sig: SigName;
  generation: number;
  changedAt: number;
  /** How many mesh links have re-keyed onto the current generation. */
  linksOnCurrent?: number;
  links?: number;
}

/** Algorithm label for the KEM side of a profile, as the ticker prints it. */
export const KEM_LABEL: Record<ProfileName, string> = {
  standard: "ml-kem-768+x25519",
  edge: "ml-kem-512+x25519",
};
