import { describe, expect, it } from "vitest";
import { SECTOR_IDS, isSectorId } from "@qsetu/sim";
import { SOLUTIONS, solution } from "../data/solutions";
import index from "../data/readiness-index.json";
import targets from "../data/readiness-targets.json";

describe("banking scope", () => {
  it("offers only the fintech scenario and solution", () => {
    expect(SECTOR_IDS).toEqual(["fintech"]);
    expect(SOLUTIONS.map((s) => s.id)).toEqual(["fintech"]);
    for (const id of ["healthcare", "education", "government"]) {
      expect(isSectorId(id)).toBe(false);
      expect(solution(id)).toBeUndefined();
    }
  });
  it("uses the recorded banking subset, with matching target counts", () => {
    expect(Object.keys(index.sectors)).toEqual(["banking"]);
    expect(Object.keys(targets.sectors)).toEqual(["banking"]);
    expect(index.all).toEqual(index.sectors.banking);
    expect(index.all.targets).toBe(targets.sectors.banking.length);
  });
});
