/** Demo systems on the India map: one per adapter per sector. Institutions are fictional; cities are real. */
import type { SectorId } from "@qsetu/sim";

export type AdapterId = "web" | "shield" | "sdk" | "edge" | "vault";

export interface Site {
  id: string;
  label: string;
  city: string;
  lon: number;
  lat: number;
  sector: SectorId;
  adapter: AdapterId;
}

const s = (
  sector: SectorId,
  adapter: AdapterId,
  label: string,
  city: string,
  lon: number,
  lat: number,
): Site => ({
  id: `${sector}-${adapter}`,
  sector,
  adapter,
  label,
  city,
  lon,
  lat,
});

// Listed west → east, so "Deploy all" sweeps across the map like a wave.
export const SITES: Site[] = [
  s("fintech", "shield", "Bharat Bank core banking", "Mumbai", 72.88, 19.08),
  s("fintech", "web", "Net-banking portal", "New Delhi", 77.21, 28.61),
  s("fintech", "sdk", "Mobile banking app", "Bengaluru", 77.59, 12.97),
  s("fintech", "vault", "Transaction ledger archive", "Chennai", 80.27, 13.08),
  s("fintech", "edge", "Kirana POS terminal", "Patna", 85.14, 25.6),
];

export const ADAPTERS: Record<AdapterId, { label: string; product: string; target: string }> = {
  web: { label: "Website", product: "QuantumLedger Web", target: "one <script> tag" },
  shield: {
    label: "API server",
    product: "QuantumLedger Shield",
    target: "sidecar, zero code change",
  },
  sdk: { label: "Mobile app", product: "QuantumLedger SDK", target: "npm i @qsetu/sdk" },
  edge: { label: "IoT device", product: "QuantumLedger Edge", target: "edge profile, 64 KB RAM" },
  vault: { label: "Database", product: "QuantumLedger Vault", target: "vault.put / vault.get" },
};

export const ADAPTER_ORDER: AdapterId[] = ["web", "shield", "sdk", "edge", "vault"];
