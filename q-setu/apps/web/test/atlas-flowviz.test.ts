/** The pipeline view's model (lib/client/atlas-flowviz): only Atlas JSON in, nothing invented. */
import { describe, expect, it } from "vitest";
import type { AtlasResults, Stage } from "@/lib/client/atlas";
import {
  buildFlowModel,
  frontier,
  nowLine,
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

describe("nowLine", () => {
  const plain = stages.map((s) => ({ ...s, plain: `does ${s.id}` }));
  it("names the running stage in Atlas's words, then the sealed ledger, never before a run", () => {
    const st = (n: number, cur: "running" | "failed" | "done" = "running") =>
      plain.map((_, i) => (i < n ? "done" : i === n ? cur : "idle"));
    expect(
      nowLine(
        buildFlowModel(
          results,
          plain,
          plain.map(() => "idle"),
        ),
      ),
    ).toBeNull();
    expect(nowLine(buildFlowModel(results, plain, st(3)))).toBe("Now: tiebreak. does tiebreak");
    expect(nowLine(buildFlowModel(results, plain, st(5, "failed")))).toBe(
      "Failed: gates. does gates",
    );
    expect(nowLine(buildFlowModel(results, plain, st(9)))).toBe(
      "Sealed: 7 ledger entries signed (ML-DSA-65) and verified.",
    );
  });
});

describe("stage facts and the tied pair come only from results.json", () => {
  it("no tie group: no swap; a tie group of two in one wave: that pair", () => {
    const m = buildFlowModel(
      results,
      stages,
      stages.map(() => "done"),
    );
    expect(m.tiePair).toBeNull();
    expect(m.facts.ledger).toBe("7 signed entries (ML-DSA-65)");
    expect(m.facts.seal).toBe("7 entries · chain verified");
    expect(m.facts.detect).toBeUndefined(); // no detect section: no fact
    const tied = {
      ...results,
      tiebreak: {
        tie_groups: 1,
        waves: [
          {
            week: 1,
            batches: [
              { id: "a", rank: 1, tie: { size: 2 } },
              { id: "b", rank: 2, tie: { size: 2 } },
            ],
          },
          { week: 2, batches: [{ id: "c", rank: 3 }] },
        ],
      },
    } as unknown as AtlasResults;
    const t = buildFlowModel(
      tied,
      stages,
      stages.map(() => "done"),
    );
    expect(t.tiePair).toEqual([0, 1]);
    expect(t.facts.tiebreak).toBe("1 tie group ordered");
  });
});
