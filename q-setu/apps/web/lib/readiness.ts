/**
 * India Quantum Readiness Index: the sector aggregates written by `pnpm index:build`
 * (data/readiness-index.json) and the three measures the site shows. Counts only, never sites.
 */
import INDEX from "@/data/readiness-index.json";

export interface SectorAggregate {
  targets: number;
  reachable: number;
  hybridPq: number;
  tls13: number;
  tls12OrOlder: number;
  rsa2048: number;
  rsaAny: number;
  ecdsa: number;
  groups: Record<string, number>;
}

export interface ReadinessIndex {
  name: string;
  startedAt: string;
  finishedAt: string;
  method: string;
  client: string;
  sectors: Record<string, SectorAggregate>;
  all: SectorAggregate;
}

export const READINESS = INDEX as ReadinessIndex;

export const SECTORS = [
  { id: "banking", short: "Banks", label: "Banking", simple: "Banks", at: [19.08, 72.88] },
] as const;

export type MetricId = "hybridPq" | "tls13" | "rsa2048";

export const METRICS: {
  id: MetricId;
  label: string;
  simple: string;
  /** True if a higher share is better (taller bar = more ready). */
  good: boolean;
}[] = [
  {
    id: "hybridPq",
    label: "negotiate hybrid post-quantum key exchange (X25519MLKEM768)",
    simple: "already use a quantum-safe lock when you connect",
    good: true,
  },
  {
    id: "tls13",
    label: "negotiate TLS 1.3",
    simple: "use the newest connection standard",
    good: true,
  },
  {
    id: "rsa2048",
    label: "still present an RSA-2048 certificate",
    simple: "still prove who they are with a key a quantum computer could forge",
    good: false,
  },
];

/** Share of reachable sites (0..1) for a measure. */
export const share = (a: SectorAggregate, m: MetricId) => (a.reachable ? a[m] / a.reachable : 0);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
