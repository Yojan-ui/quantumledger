/**
 * Quantum Readiness Scanner. Finds quantum-vulnerable and classically broken cryptography
 * in arbitrary text (source code, configs, PEM, `openssl -text` output) and produces
 * findings, a 0–100 readiness score and a CycloneDX 1.6 CBOM.
 *
 * It's a heuristic, line-oriented scanner meant for fast triage. It isn't a substitute
 * for a full cryptographic inventory.
 */
import { buildCbom, type Cbom } from "./cbom";
import { isBase64Body, scanPemBlocks } from "./pem";
import { RULES, TLS_SUITE, type Primitive, type Rule, type Severity } from "./rules";
import { analyzeSuite } from "./tls";

export interface Finding {
  ruleId: string;
  line: number;
  column: number;
  match: string;
  algorithm: string;
  primitive: Primitive;
  severity: Severity;
  quantumVulnerable: boolean;
  quantumSafe: boolean;
  parameter?: string;
  why: string;
  replacement: string;
}

export interface ScanResult {
  score: number;
  grade: "Quantum-ready" | "At risk" | "Critical";
  summary: Record<Severity, number>;
  findings: Finding[];
  cbom: Cbom;
}

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 25,
  medium: 10,
  low: 3,
  info: 0,
};

const ruleById = new Map(RULES.map((r) => [r.id, r]));

function fromRule(rule: Rule, line: number, column: number, match: string, src: string): Finding {
  return {
    ruleId: rule.id,
    line,
    column,
    match,
    algorithm: rule.algorithm,
    primitive: rule.primitive,
    severity: rule.severity,
    quantumVulnerable: rule.quantumVulnerable,
    quantumSafe: rule.quantumSafe ?? false,
    parameter: rule.parameter?.(src),
    why: rule.why,
    replacement: rule.replacement,
  };
}

/** `context` is the line plus the next two, so parameters split across lines (for example
 * "Public Key Algorithm: rsaEncryption" / "Public-Key: (2048 bit)") are still captured. */
function scanLine(src: string, lineNo: number, context: string): Finding[] {
  const findings: Finding[] = [];
  let masked = src;

  // 1. Analyse TLS cipher suites as a whole, then mask them so their parts aren't re-reported.
  for (const m of src.matchAll(TLS_SUITE)) {
    const a = analyzeSuite(m[0]);
    findings.push({
      ruleId: "tls-suite",
      line: lineNo,
      column: (m.index ?? 0) + 1,
      match: m[0],
      algorithm: "TLS cipher suite",
      primitive: "protocol",
      severity: a.severity,
      quantumVulnerable: a.quantumVulnerable,
      quantumSafe: false,
      parameter: `kx=${a.keyExchange}; auth=${a.authentication}; cipher=${a.cipher}`,
      why: a.why,
      replacement: "TLS 1.3 with TLS_AES_256_GCM_SHA384 and the X25519MLKEM768 hybrid group",
    });
    masked =
      masked.slice(0, m.index) +
      " ".repeat(m[0].length) +
      masked.slice((m.index ?? 0) + m[0].length);
  }

  // 2. Individual algorithm rules. One finding per rule per line keeps the table readable.
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    const m = rule.pattern.exec(masked);
    if (m) findings.push(fromRule(rule, lineNo, m.index + 1, m[0], context));
  }
  return findings;
}

export function scoreFindings(findings: Finding[]): number {
  const counts = new Map<string, { severity: Severity; n: number }>();
  for (const f of findings) {
    const key = `${f.ruleId}:${f.severity}`;
    const c = counts.get(key);
    if (c) c.n++;
    else counts.set(key, { severity: f.severity, n: 1 });
  }
  let penalty = 0;
  for (const { severity, n } of counts.values()) {
    if (severity === "info") continue;
    // Full weight for the first hit of each kind, then a small, capped penalty for repeats.
    penalty += SEVERITY_WEIGHT[severity] + Math.min(n - 1, 5) * 2;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

/** "Quantum-ready" also requires zero high or critical quantum-vulnerable findings. */
export function gradeFor(score: number, findings: Finding[] = []): ScanResult["grade"] {
  const exposed = findings.some(
    (f) => f.quantumVulnerable && (f.severity === "critical" || f.severity === "high"),
  );
  if (score >= 80 && !exposed) return "Quantum-ready";
  return score >= 50 ? "At risk" : "Critical";
}

export function scan(text: string, sourceName = "pasted-input"): ScanResult {
  const lines = text.split(/\r?\n/);
  const findings: Finding[] = [];

  lines.forEach((line, i) => {
    if (isBase64Body(line)) return;
    findings.push(...scanLine(line, i + 1, lines.slice(i, i + 3).join("\n")));
  });

  for (const hit of scanPemBlocks(lines)) {
    for (const oid of hit.oids) {
      const rule = ruleById.get(oid.ruleId)!;
      const already = findings.some((f) => f.line === hit.line && f.ruleId === rule.id);
      if (!already) {
        findings.push({
          ...fromRule(rule, hit.line, 1, `${hit.label} → ${oid.name}`, ""),
          parameter: `OID ${oid.name}`,
        });
      }
    }
  }

  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  const summary: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  const score = scoreFindings(findings);

  return {
    score,
    grade: gradeFor(score, findings),
    summary,
    findings,
    cbom: buildCbom(findings, sourceName),
  };
}
