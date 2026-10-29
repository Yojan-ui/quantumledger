/**
 * Scene data for the Lab's 3D layer: per file its line count, score and grade, and per finding its line,
 * severity and the scanner's own SEVERITY_WEIGHT (the penalty weight `scoreFindings` uses). Only fields of
 * the finished run record, nothing derived beyond that lookup. The browser turns this into GPU arrays.
 */
import { SEVERITY_WEIGHT } from "@qsetu/core";
import type { RunRecord } from "./runs";

export const SCENE_VERSION = 1;

export function buildScene(r: RunRecord) {
  return {
    version: SCENE_VERSION,
    runId: r.runId,
    resultSha256: r.resultSha256,
    weights: SEVERITY_WEIGHT,
    files: r.files.map((f) => ({
      name: f.name,
      lines: f.lines,
      score: f.score,
      grade: f.grade,
      findings: f.findings.map((x, n) => ({
        n,
        line: x.line,
        severity: x.severity,
        weight: SEVERITY_WEIGHT[x.severity],
        algorithm: x.algorithm,
        ruleId: x.ruleId,
        quantumVulnerable: x.quantumVulnerable,
        quantumSafe: x.quantumSafe,
      })),
    })),
  };
}

export const sceneEtag = (r: RunRecord) => `"${r.resultSha256}-scene-v${SCENE_VERSION}"`;
