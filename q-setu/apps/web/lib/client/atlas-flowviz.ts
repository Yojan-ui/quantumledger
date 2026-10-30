/**
 * The data behind the 3D / 2D pipeline view, from Atlas JSON only: the stations are Atlas's stages
 * (/atlas-api/stages) with the status the HUD holds (real SSE events, or a recorded run's events); the
 * batches are results.json's assets with their risk weight, planned week, tie-break rank, patches (what each
 * asset uses: kex -> ML-KEM, sig -> ML-DSA) and lab gate result; the ledger is results.ledger. Nothing is
 * invented: a missing section leaves its part of the view empty.
 */
import type { AtlasResults, Stage } from "./atlas";
import type { StageStatus } from "./atlas-run";

export type FlowBatch = {
  id: string;
  name: string;
  /** 0..1, risk_weight / the largest risk weight (an assumption in config/assumptions.json). */
  risk: number;
  /** 0-based wave row (planned week order), or -1 before a plan exists. */
  wave: number;
  /** position inside its wave (tie-break rank order), 0-based. */
  slot: number;
  patches: ("kem" | "sig")[];
  /** lab gates passed for this asset's wave ("applied"); otherwise the patch is planned, not verified. */
  applied: boolean;
};
export type FlowModel = {
  stations: { id: string; label: string; status: StageStatus }[];
  batches: FlowBatch[];
  waves: number;
  ledger: { entries: number; verified: boolean };
};

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const usesOf = (alg: string): ("kem" | "sig")[] => {
  const u = new Set<string>();
  for (const m of alg.matchAll(/\[([^\]]*)\]/g))
    (m[1] ?? "").split(",").forEach((x) => u.add(x.trim()));
  if (u.has("both")) {
    u.add("kex");
    u.add("sig");
  }
  return [...(u.has("kex") ? (["kem"] as const) : []), ...(u.has("sig") ? (["sig"] as const) : [])];
};

export function buildFlowModel(
  results: AtlasResults | null | undefined,
  stages: Stage[],
  status: StageStatus[],
): FlowModel {
  const stations = stages.map((s, i) => ({
    id: s.id,
    label: s.label,
    status: status[i] ?? "idle",
  }));
  if (!results) return { stations, batches: [], waves: 0, ledger: { entries: 0, verified: false } };
  const r = results as unknown as Any;
  const assets = (r.assets ?? []) as Any[];
  const maxRisk = Math.max(1e-9, ...assets.map((a) => Number(a.risk_weight) || 0));
  const weeks = [...new Set(assets.map((a) => a.planned_week).filter((w) => w != null))].sort(
    (a, b) => a - b,
  ) as number[];
  // tie-break rank when the stage ran; otherwise the plan's own order (score, then id) inside each week
  const rank = new Map<string, number>();
  for (const w of (r.tiebreak?.waves ?? []) as Any[])
    for (const b of w.batches ?? []) rank.set(b.id, b.rank);
  const status_ = new Map<string, string>(
    Object.entries(
      (r.waves ?? []).reduce((m: Any, w: Any) => ({ ...m, ...(w.asset_status ?? {}) }), {}),
    ),
  );
  const batches: FlowBatch[] = [];
  for (const week of weeks) {
    const inWeek = assets
      .filter((a) => a.planned_week === week)
      .sort(
        (a, b) =>
          (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) ||
          (b.risk_weight ?? 0) - (a.risk_weight ?? 0) ||
          String(a.id).localeCompare(String(b.id)),
      );
    inWeek.forEach((a, slot) =>
      batches.push({
        id: a.id,
        name: a.name ?? a.id,
        risk: (Number(a.risk_weight) || 0) / maxRisk,
        wave: weeks.indexOf(week),
        slot,
        patches: usesOf(String(a.algorithm ?? "")),
        applied: (status_.get(a.id) ?? a.status) === "applied",
      }),
    );
  }
  for (const a of assets.filter((x) => x.planned_week == null))
    batches.push({
      id: a.id,
      name: a.name ?? a.id,
      risk: (Number(a.risk_weight) || 0) / maxRisk,
      wave: -1,
      slot: 0,
      patches: usesOf(String(a.algorithm ?? "")),
      applied: false,
    });
  const L = r.ledger as Any | null;
  return {
    stations,
    batches,
    waves: weeks.length,
    ledger: { entries: L?.entry_count ?? 0, verified: !!(r.ledger_verification as Any | null)?.ok },
  };
}

/** Where the batches are: the last stage that has started (running, done or failed); -1 before a run. */
export function frontier(m: FlowModel): number {
  let f = -1;
  m.stations.forEach((s, i) => s.status !== "idle" && (f = i));
  return f;
}
export const stationDone = (m: FlowModel, id: string) =>
  m.stations.find((s) => s.id === id)?.status === "done";

/** A stored result is evidence only for its own stage; missing sections never imply success. */
export function recordedStatuses(
  results: AtlasResults | null | undefined,
  stages: Stage[],
): StageStatus[] {
  const r = results as unknown as Any | null | undefined;
  const present: Record<string, boolean> = {
    detect: !!r?.detect,
    ledger: !!r?.ledger,
    schedule: !!r?.exposure,
    tiebreak: !!r?.tiebreak,
    capture: !!r?.handshake_evidence,
    gates: !!r?.gates,
    qaoa: !!r?.qaoa,
    seal: r?.ledger_verification?.ok === true,
    report: (r?.ledger?.entries ?? []).some((e: { type: string }) => e.type === "report.html"),
  };
  return stages.map((s) => (present[s.id] ? "done" : "idle"));
}
