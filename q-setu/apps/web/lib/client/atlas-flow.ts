/**
 * The seven user-facing Q-Shield steps and their headline facts, ported from the original Atlas UI
 * (qshield/atlas_web/static/js/flow.js and components/overview.js flowFacts, views/handshakes.js rowsOf,
 * model.js solverLabel) so both UIs show the same steps, in the same order, with the same numbers.
 * Every fact reads results.json; a missing section gives no fact (the UI says "not yet run").
 */
import type { AtlasResults } from "./atlas";

export type FlowStep = {
  id: string;
  /** Page under /atlas/[ws]/ (with ?section= for the two Proof Chain steps). */
  href: string;
  label: string;
  /** Atlas execution stages (contracts/stages.json ids) that light this step. */
  stages: string[];
  hands: string;
  does: string;
};

export const FLOW: FlowStep[] = [
  {
    id: "detect",
    href: "detect",
    label: "Detect",
    stages: ["detect"],
    hands: "Findings with file:line evidence",
    does: "Finds RSA, ECC and DH in code, configs, certificates and live TLS, and groups the findings into systems (inventory and drift).",
  },
  {
    id: "proof_open",
    href: "ledger?section=2",
    label: "Proof: findings signed",
    stages: ["ledger"],
    hands: "The Detect evidence, signed first",
    does: "The RSA / ECC / DH findings are signed with ML-DSA-65 before planning (detect.run), after the existing chain is verified.",
  },
  {
    id: "schedule",
    href: "schedule",
    label: "Plan",
    stages: ["schedule"],
    hands: "The wave plan (week per system)",
    does: "Plans the migration in weekly waves (QpiAI Opt MILP) within team capacity and dependencies, compared with simple orders.",
  },
  {
    id: "gates",
    href: "handshakes",
    label: "Handshake gates",
    stages: ["capture", "gates"],
    hands: "Gate results per wave",
    does: "Tests every wave on real TLS 1.3 lab services: post-quantum handshake, no silent downgrade, compatibility, rollback.",
  },
  {
    id: "waves",
    href: "qaoa",
    label: "Wave selection",
    stages: ["qaoa"],
    hands: "A checked wave selection",
    does: "Cross-checks one week's choice of systems with QAOA on a simulator against the exact answer.",
  },
  {
    id: "proof_verified",
    href: "ledger?section=6",
    label: "Proof: post-quantum verified",
    stages: ["seal"],
    hands: "Every result signed, the whole chain re-verified",
    does: "The ML-KEM (X25519MLKEM768) handshake and gate evidence is signed, and every entry's ML-DSA-65 signature is verified across the chain.",
  },
  {
    id: "review",
    href: "review",
    label: "Review",
    stages: [],
    hands: "Approved migration steps",
    does: "A person approves or rejects each result with a reason; the decision is signed too.",
  },
];

// results.json is typed from the schema, but several sections are open objects; these are the fields read.
type R = AtlasResults & Record<string, unknown>;
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** "QpiAI Opt · local MILP · optimal · global optimum" from solver_runs[0] (recorded fields only). */
export function solverLabel(r: AtlasResults | null | undefined): string {
  const x = ((r?.solver_runs ?? []) as Any[])[0];
  if (!x) return "not yet run";
  return [
    "QpiAI Opt",
    x.mode === "local" ? "local MILP" : `${x.mode || "platform"} MILP`,
    x.termination,
    x.guarantee === "global_optimum" ? "global optimum" : x.guarantee,
  ]
    .filter(Boolean)
    .join(" · ");
}

export type Fact = { num: string; mean: string; backend: string };
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One headline per step, exactly as the Atlas Overview computes it. */
export function flowFacts(
  results: AtlasResults | null | undefined,
  reviews?: { items: { status: string }[] } | null,
): Record<string, Fact> {
  const f: Record<string, Fact> = {};
  if (!results) return f;
  const r = results as R as Any;
  if (r.detect) {
    const drift = ((r.detect.probes ?? []) as Any[]).reduce(
      (n, p) => n + ((p.drift ?? []) as unknown[]).length,
      0,
    );
    f.detect = {
      num: `${r.detect.summary.vulnerable_findings} → ${r.assets.length}`,
      mean: `findings → systems · ${pl(drift, "drift alert", "drift alerts")} (${r.detect.files_scanned} files scanned)`,
      backend: "static scan + OpenSSL 3.6.5 live probes",
    };
  }
  if (r.exposure)
    f.schedule = {
      num: `${r.exposure.makespan_weeks} wk`,
      mean: `to migrate everything in ${pl(r.waves.length, "wave", "waves")} at the assumed capacity`,
      backend: solverLabel(results),
    };
  if (r.qaoa) {
    const top = ((r.qaoa.runs ?? []) as Any[])
      .filter((x) => x.source === "local" && x.metrics)
      .sort((a, b) => b.p - a.p)[0];
    const dev = (r.qaoa.qpiai_local ?? {}).device;
    if (top)
      f.waves = {
        num:
          top.metrics.approximation_ratio === 1
            ? "optimal"
            : Number(top.metrics.approximation_ratio).toFixed(3),
        mean: `week ${r.qaoa.problem.week} selection, ${r.qaoa.problem.n_variables} variables, checked against the exact answer`,
        backend: `${dev ? "QpiAI-QSV-Local simulator" : "numpy statevector simulator"} · QCloud: awaiting account activation`,
      };
  }
  if (r.gates) {
    const passed = (r.waves as Any[]).filter((w) => w.status === "applied").length;
    f.gates = {
      num: `${passed} / ${r.waves.length}`,
      mean: "waves passed every lab gate; the rest are partly verified or not testable in the lab",
      backend: "OpenSSL 3.6.5 lab services on 127.0.0.1",
    };
  }
  if (r.ledger) {
    const v = r.ledger_verification as Any | null;
    const backend = `${r.ledger.alg} · ${r.ledger.backend}`;
    const first = ((r.ledger.entries ?? []) as Any[]).find((e) => e.type === "detect.run");
    f.proof_open = {
      num: first ? `#${first.index}` : String(r.ledger.entry_count),
      mean: first ? "the Detect evidence was signed first (detect.run)" : "signed records",
      backend,
    };
    const mlkem = (((r.handshake_evidence ?? {}).sessions ?? []) as Any[]).some((x) =>
      /MLKEM/i.test(x.negotiated_group ?? ""),
    );
    f.proof_verified = {
      num: String(r.ledger.entry_count),
      mean: !(v && v.ok)
        ? "signed records · not verified"
        : mlkem
          ? "signatures verified · X25519MLKEM768 handshake evidence signed"
          : "signatures verified; no post-quantum handshake recorded",
      backend,
    };
  }
  const items = reviews?.items ?? [];
  if (items.length) {
    const pending = items.filter((i) => i.status === "pending").length;
    f.review = {
      num: `${items.length - pending} / ${items.length}`,
      mean: `results decided by a person · ${pending} awaiting review`,
      backend: "decisions signed with ML-DSA-65",
    };
  }
  return f;
}

export type HandshakeRow = {
  live: boolean;
  classical: boolean;
  s: {
    service_id: string;
    negotiated_group?: string;
    kex_class?: string;
    auth_alg?: string;
    transcript_sha256?: string;
    endpoint?: string;
    label?: string | null;
  };
  kex: Any | null;
  auth: Any | null;
  down: Any | null;
  probe?: Any;
};

/** Lab sessions plus completed live probes, classical first (Atlas views/handshakes.js rowsOf). */
export function rowsOf(results: AtlasResults): HandshakeRow[] {
  const r = results as R as Any;
  const g = (r.gates ?? {}) as Any;
  const find = (list: Any[] | undefined, id: string) =>
    (list ?? []).find((x) => x.service_id === id) ?? null;
  const lab: HandshakeRow[] = (((r.handshake_evidence ?? {}).sessions ?? []) as Any[]).map((s) => ({
    live: false,
    s: s as HandshakeRow["s"],
    classical: s.kex_class === "classical",
    kex: find(g.pq_handshake, s.service_id),
    auth: find(g.pq_auth, s.service_id),
    down: find(g.downgrade, s.service_id),
  }));
  const live: HandshakeRow[] = (((r.detect ?? {}).probes ?? []) as Any[])
    .filter((p) => p.live && p.live.handshake_ok)
    .map((p) => ({
      live: true,
      probe: p,
      classical: !!p.live.kex_quantum_vulnerable,
      kex: null,
      auth: null,
      down: null,
      s: {
        service_id: p.service,
        negotiated_group: p.live.group,
        kex_class: p.live.kex_quantum_vulnerable ? "classical" : "hybrid-pq",
        auth_alg: p.live.cert_algorithm,
        transcript_sha256: p.live.transcript_sha256,
        endpoint: p.endpoint,
      },
    }));
  return [...lab, ...live].sort((a, b) => Number(b.classical) - Number(a.classical));
}
