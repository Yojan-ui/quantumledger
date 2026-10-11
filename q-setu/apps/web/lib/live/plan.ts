/**
 * Migration planner: turns readiness-scanner findings into an ordered checklist. Each step says
 * which Q-Setu adapter (or plain configuration change) fixes which findings, how big the job is
 * (S/M/L), and how urgent it is.
 *
 * Urgency uses Mosca's inequality: if data must stay secret for x years and migrating takes y years,
 * you are already late when x + y exceeds z, the years left until a cryptographically relevant
 * quantum computer. z is a planning assumption (`horizonYear`, default 2035: the year NIST IR 8547's
 * draft proposes disallowing RSA and ECC), not a prediction.
 */
import type { Finding } from "@qsetu/core";

export type Effort = "S" | "M" | "L";
export type Priority = "P1" | "P2" | "P3";
export type Fixer = "Shield" | "Web" | "SDK" | "Edge" | "Vault" | "Config" | "Scanner";

export interface PlanInput {
  findings: Pick<
    Finding,
    "ruleId" | "line" | "algorithm" | "primitive" | "severity" | "quantumVulnerable" | "match"
  >[];
  /** How long the protected data must stay confidential, in years. */
  dataLifetimeYears: number;
  /** "url" plans come from a live TLS probe; "code" plans from pasted source/config. */
  source: "url" | "code";
  hybridPq?: boolean;
  horizonYear?: number;
  year?: number;
}

export interface PlanStep {
  id: string;
  priority: Priority;
  title: string;
  fixer: Fixer;
  effort: Effort;
  /** "ruleId:line" references to the findings this step resolves. */
  resolves: string[];
  why: string;
  action: string;
}

export interface Plan {
  steps: PlanStep[];
  assumptions: { dataLifetimeYears: number; horizonYear: number; yearsLeft: number };
}

const EFFORT_YEARS: Record<Effort, number> = { S: 0.25, M: 1, L: 2 };
const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };
const EFFORT_RANK: Record<Effort, number> = { S: 0, M: 1, L: 2 };

interface Template {
  id: string;
  match: (f: PlanInput["findings"][number], input: PlanInput) => boolean;
  title: string;
  fixer: Fixer;
  effort: Effort;
  /** Quantum (harvest-now) exposure, so Mosca applies; otherwise a classical-hygiene fix. */
  quantum: boolean;
  why: string;
  action: string;
}

const TEMPLATES: Template[] = [
  {
    id: "tls-hybrid",
    match: (f, i) =>
      i.source === "url" &&
      !i.hybridPq &&
      (f.primitive === "key-agree" || f.ruleId === "tls-suite"),
    title: "Turn on hybrid post-quantum key exchange (X25519MLKEM768)",
    fixer: "Config",
    effort: "S",
    quantum: true,
    why: "The server negotiated a classical key exchange, so recorded sessions can be decrypted after Q-Day.",
    action:
      "Upgrade the TLS terminator (OpenSSL 3.5+, or a CDN that supports it) and put X25519MLKEM768 first in the supported groups.",
  },
  {
    id: "shield-transit",
    match: (f, i) =>
      i.source === "code" &&
      (f.primitive === "key-agree" || f.ruleId === "tls-suite" || f.ruleId === "rsa"),
    title: "Front legacy services with Q-Setu Shield",
    fixer: "Shield",
    effort: "S",
    quantum: true,
    why: "RSA and (EC)DH key exchange in transit are exposed to harvest-now, decrypt-later.",
    action:
      "Run `qsetu-shield` beside each service pair; traffic between them becomes hybrid X25519 + ML-KEM-768 with no code change.",
  },
  {
    id: "legacy-tls",
    match: (f) => f.ruleId === "legacy-tls",
    title: "Disable SSL 3.0, TLS 1.0 and TLS 1.1",
    fixer: "Config",
    effort: "S",
    quantum: true,
    why: "Old protocol versions can't negotiate post-quantum groups and are deprecated (RFC 8996).",
    action: "Set the minimum protocol to TLS 1.2 (prefer 1.3) on every listener and client.",
  },
  {
    id: "sdk-sign",
    match: (f, i) => i.source === "code" && f.primitive === "signature",
    title: "Sign transactions and documents with ML-DSA-65 via the SDK",
    fixer: "SDK",
    effort: "M",
    quantum: true,
    why: "RSA, ECDSA and DSA signatures can be forged once a quantum computer exists, and signed records outlive Q-Day.",
    action:
      "Replace sign/verify calls with `@qsetu/sdk` ML-DSA-65; dual-sign (classical + ML-DSA) while verifiers upgrade.",
  },
  {
    id: "cert-plan",
    match: (f, i) => i.source === "url" && (f.primitive === "signature" || f.ruleId === "rsa"),
    title: "Plan the certificate migration",
    fixer: "Config",
    effort: "L",
    quantum: false,
    why: "The certificate uses a classical key. Forging it needs a quantum computer at connection time, so it is not a harvest risk, but CA and browser support for PQ certificates takes years.",
    action:
      "Inventory certificates (the CBOM), shorten lifetimes, and track your CA's ML-DSA roadmap. Use ML-DSA now for internal PKI.",
  },
  {
    id: "sha1",
    match: (f) => f.ruleId === "sha1",
    title: "Replace SHA-1",
    fixer: "Config",
    effort: "S",
    quantum: false,
    why: "SHA-1 collisions are practical today.",
    action: "Use SHA-256 or SHA3-256 for signatures, HMACs and fingerprints.",
  },
  {
    id: "3des",
    match: (f) => f.ruleId === "3des",
    title: "Replace 3DES with AES-256-GCM",
    fixer: "Config",
    effort: "S",
    quantum: false,
    why: "3DES has a 64-bit block (Sweet32) and is disallowed by NIST.",
    action: "Switch cipher configuration to AES-256-GCM.",
  },
];

export function buildPlan(input: PlanInput): Plan {
  const year = input.year ?? new Date().getFullYear();
  const horizonYear = input.horizonYear ?? 2035;
  const yearsLeft = Math.max(0, horizonYear - year);
  const steps: PlanStep[] = [];

  for (const t of TEMPLATES) {
    const hits = input.findings.filter((f) => f.severity !== "info" && t.match(f, input));
    if (!hits.length) continue;
    const late = input.dataLifetimeYears + EFFORT_YEARS[t.effort] > yearsLeft;
    const critical = hits.some((f) => f.severity === "critical");
    const priority: Priority = t.quantum
      ? late || critical
        ? "P1"
        : "P2"
      : critical
        ? "P1"
        : "P3";
    steps.push({
      id: t.id,
      priority,
      title: t.title,
      fixer: t.fixer,
      effort: t.effort,
      resolves: [...new Set(hits.map((f) => `${f.ruleId}:${f.line}`))],
      why:
        t.quantum && late
          ? `${t.why} Data kept ${input.dataLifetimeYears} years + ${EFFORT_YEARS[t.effort]} years to migrate exceeds the ${yearsLeft} years to ${horizonYear}.`
          : t.why,
      action: t.action,
    });
  }

  // Long-lived data at rest needs protecting regardless of what the scan saw in transit.
  if (input.dataLifetimeYears >= 10) {
    steps.push({
      id: "vault-at-rest",
      priority: input.dataLifetimeYears + EFFORT_YEARS.M > yearsLeft ? "P1" : "P2",
      title: "Wrap long-lived records with Q-Setu Vault",
      fixer: "Vault",
      effort: "M",
      resolves: [],
      why: `Records kept ${input.dataLifetimeYears} years will outlive the ${horizonYear} horizon. Backups and replicas leak too.`,
      action:
        "Store each record under its own AES-256 key wrapped with ML-KEM-768 and signed with ML-DSA-65 (`vault.put`).",
    });
  }

  steps.push({
    id: "rescan",
    priority: "P3",
    title: "Keep the CBOM current",
    fixer: "Scanner",
    effort: "S",
    resolves: [],
    why: "Migration is only done when the inventory says so.",
    action: "Run the readiness scanner in CI and attach the CycloneDX CBOM to each release.",
  });

  steps.sort(
    (a, b) => RANK[a.priority] - RANK[b.priority] || EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort],
  );
  return {
    steps,
    assumptions: { dataLifetimeYears: input.dataLifetimeYears, horizonYear, yearsLeft },
  };
}

export function planToMarkdown(plan: Plan, title = "Q-Setu migration plan"): string {
  const a = plan.assumptions;
  return [
    `# ${title}`,
    "",
    `Assumptions: data lifetime ${a.dataLifetimeYears} years; planning horizon ${a.horizonYear} (${a.yearsLeft} years left).`,
    "",
    ...plan.steps.map(
      (s) =>
        `- [ ] **${s.priority} · ${s.title}** (${s.fixer}, effort ${s.effort})\n  - Why: ${s.why}\n  - Do: ${s.action}${s.resolves.length ? `\n  - Resolves: ${s.resolves.join(", ")}` : ""}`,
    ),
    "",
  ].join("\n");
}
