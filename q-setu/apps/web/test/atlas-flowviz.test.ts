/** The pipeline view's model (lib/client/atlas-flowviz): only Atlas JSON in, nothing invented. */
import { describe, expect, it } from "vitest";
import type { AtlasResults, Stage } from "@/lib/client/atlas";
import {
  buildFlowModel,
  frontier,
  stationDone,
  recordedStatuses,
} from "@/lib/client/atlas-flowviz";

const stages: Stage[] = [
  "detect",
  "ledger",
  "schedule",
  "tiebreak",
  "capture",
  "gates",
  "qaoa",
  "seal",
  "report",
].map((id) => ({ id, label: id, plain: "", steps: [id] }));

const results = {
  assets: [
    {
      id: "b",
      name: "B",
      risk_weight: 10,
      planned_week: 1,
      algorithm: "ECC[kex,sig]",
      status: "applied",
    },
    {
      id: "a",
      name: "A",
      risk_weight: 5,
      planned_week: 1,
      algorithm: "RSA[sig]",
      status: "planned",
    },
    {
      id: "c",
      name: "C",
      risk_weight: 5,
      planned_week: 2,
      algorithm: "ECC[kex]",
      status: "planned",
    },
  ],
  waves: [
    { week: 1, assets: ["b", "a"], asset_status: { b: "applied", a: "not_verified_in_lab" } },
    { week: 2, assets: ["c"], asset_status: { c: "partially_verified" } },
  ],
  tiebreak: {
    waves: [
      {
        week: 1,
        batches: [
          { id: "a", rank: 1 },
          { id: "b", rank: 2 },
        ],
      },
      { week: 2, batches: [{ id: "c", rank: 3 }] },
    ],
  },
  ledger: { entry_count: 7 },
  ledger_verification: { ok: true },
} as unknown as AtlasResults;

describe("buildFlowModel", () => {
  it("maps Atlas JSON to batches: risk scale, wave rows, tie-break slots, patches from use, lab result", () => {
    const m = buildFlowModel(
      results,
      stages,
      stages.map(() => "idle"),
    );
    expect(m.waves).toBe(2);
    expect(m.batches.map((b) => [b.id, b.wave, b.slot])).toEqual([
      ["a", 0, 0],
      ["b", 0, 1],
      ["c", 1, 0],
    ]); // tie-break rank, not input order
    expect(m.batches.find((b) => b.id === "b")).toMatchObject({
      risk: 1,
      patches: ["kem", "sig"],
      applied: true,
    });
    expect(m.batches.find((b) => b.id === "a")).toMatchObject({
      risk: 0.5,
      patches: ["sig"],
      applied: false,
    });
    expect(m.batches.find((b) => b.id === "c")?.patches).toEqual(["kem"]);
    expect(m.ledger).toEqual({ entries: 7, verified: true });
  });

  it("stations carry the given statuses; frontier is the last started stage", () => {
    const m = buildFlowModel(results, stages, [
      "done",
      "done",
      "done",
      "running",
      "idle",
      "idle",
      "idle",
      "idle",
      "idle",
    ]);
    expect(frontier(m)).toBe(3);
    expect(stationDone(m, "schedule")).toBe(true);
    expect(stationDone(m, "gates")).toBe(false);
    expect(
      frontier(
        buildFlowModel(
          results,
          stages,
          stages.map(() => "idle"),
        ),
      ),
    ).toBe(-1);
  });

  it("no results: stations only, no invented batches or ledger", () => {
    const m = buildFlowModel(
      null,
      stages,
      stages.map(() => "idle"),
    );
    expect(m.batches).toEqual([]);
    expect(m.ledger).toEqual({ entries: 0, verified: false });
    expect(m.stations).toHaveLength(9);
  });
});

describe("recorded stage status", () => {
  it("does not mark missing or unverified evidence complete", () => {
    const partial = {
      detect: {},
      ledger: { entries: [] },
      ledger_verification: { ok: false },
    } as unknown as AtlasResults;
    expect(recordedStatuses(partial, stages)).toEqual([
      "done",
      "done",
      "idle",
      "idle",
      "idle",
      "idle",
      "idle",
      "idle",
      "idle",
    ]);
    expect(recordedStatuses(null, stages).every((s) => s === "idle")).toBe(true);
  });
});
