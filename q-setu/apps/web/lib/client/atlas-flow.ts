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
  /** Why the step matters, shown in its closed Details dropdown. */
  why: string;
  /** The math behind it, as qshield implements it (monospace), and why it is credible. */
  math: string;
  credible: string;
};

export const FLOW: FlowStep[] = [
  {
    id: "detect",
    href: "detect",
    label: "Detect",
    stages: ["detect"],
    hands: "Findings with file:line evidence",
    does: "Finds RSA, ECC and DH in code, configs, certificates and live TLS, and groups the findings into systems (inventory and drift).",
    why: "You can only migrate what you can find: RSA / ECC key exchange recorded today is harvest-now-decrypt-later exposure.",
    math: "vulnerable(f)  ⇔  family(f) ∈ {RSA, ECC, DH, DSA}\nHNDL-exposed   ⇔  negotiated key exchange ∉ PQ allowlist (classical)\nper system i, by data class (config/assumptions.json, ASSUMPTIONS):\n  X_i shelf life (years), r_i risk weight\n  payments X=7 r=10 · customer_pii X=10 r=8 · archive_backup X=25 r=9\n  regulatory_records X=7 r=6 · auth_session X=0.5 r=5 · public_content X=0.1 r=1",
    credible:
      "Every finding carries file:line or host/field evidence; the weights are labelled assumptions with a sensitivity test.",
  },
  {
    id: "inventory",
    href: "inventory",
    label: "Inventory",
    stages: ["detect"],
    hands: "Systems and drift from scan evidence",
    does: "Groups findings into systems and compares configured cryptography with recorded TLS observations.",
    why: "Findings become systems with owners, dependencies and shelf life, the units the plan schedules.",
    math: "Mosca:  exposed  ⇔  x + y > z\n  x = secrecy lifetime, y = migration time, z = years to a quantum threat\nexposure of system i in scenario s (years):\n  e_i,s = max(0, X_i + t_i / 52 − (Z_s − start_year))\nscenarios Z_s (ASSUMPTIONS): 2030 (p=0.3), 2032 (p=0.4), 2035 (p=0.3)\nHarvest now, decrypt later: traffic recorded today is exposed for e_i,s years.",
    credible:
      "Mosca's inequality is the standard way to reason about PQC deadlines; the Q-day years are scenarios, not forecasts.",
  },
  {
    id: "proof_open",
    href: "ledger?section=2",
    label: "Sign findings",
    stages: ["ledger"],
    hands: "The Detect evidence, signed first",
    does: "The RSA / ECC / DH findings are signed with ML-DSA-65 before planning (detect.run), after the existing chain is verified.",
    why: "Signing the evidence before planning means the plan cannot quietly change what was found.",
    math: "σ_i      = ML-DSA-65.Sign(sk, canonical(entry_i without σ_i))\nprev_i   = SHA-256(canonical(entry_{i−1} with σ_{i−1})),  prev_0 = 0^256\npayload  = SHA-256(file signed)\nMerkle root (RFC 6962): leaf = SHA-256(0x00 ‖ e), node = SHA-256(0x01 ‖ L ‖ R)\n(Atlas uses SHA-256; the site's separate Proof Chain demo uses SHA3-256.)",
    credible:
      "Changing one byte of an entry breaks its signature and the next entry's prev hash; anyone with the public key can check.",
  },
  {
    id: "schedule",
    href: "schedule",
    label: "Plan",
    stages: ["schedule"],
    hands: "The wave plan (week per system)",
    does: "Plans the migration in weekly waves (QpiAI Opt MILP) within team capacity and dependencies, compared with simple orders.",
    why: "Mosca: if secrecy lifetime plus migration time exceeds time to a quantum threat (x + y > z), data is exposed; the plan minimises that exposure.",
    math: "MILP (QpiAI Opt, local), y_i,k = 1 if system i migrates in week k:\n  min  Σ_s p_s Σ_i r_i e_i,s          then tie-break  Σ_i r_i t_i\n  s.t. Σ_k y_i,k = 1                   each system exactly once\n       Σ_i w_i y_i,k ≤ C               weekly capacity (effort days)\n       t_d ≤ t_i                        a dependency d migrates no later than i\n       t_i = Σ_k k y_i,k ,  e_i,s ≥ X_i + t_i/52 − (Z_s − start),  e ≥ 0\nbaselines, same evaluator: FCFS = discovery order;\n  Greedy = r_i / w_i highest first (Smith's rule)",
    credible:
      "Solved to a proven optimum and scored with the same evaluator as the baselines, on the same data.",
  },
  // Added in Quantum Ledger (not in the original Atlas sidebar): python -m tiebreak, right after the plan.
  {
    id: "tiebreak",
    href: "tiebreak",
    label: "Tie-break",
    stages: ["tiebreak"],
    hands: "The patch order inside each wave",
    does: "When batches in a wave have the same vulnerability score, decides which one gets its ML-KEM / ML-DSA patch first (Mosca margin, harvest-now exposure, internet exposure, dependents, effort, id).",
    why: "Ties are common; a fixed, explained order makes the patch sequence reproducible and auditable.",
    math: "inside a wave, batches with equal score r_i are ordered by, in turn:\n  1 Mosca margin x + y − z (larger first)   2 HNDL-exposed first\n  3 internet-facing first   4 more dependents first   5 less effort first   6 id\n  (a batch another tied batch depends on always goes first)\npatch:  key exchange → ML-KEM-768 (NIST FIPS 203)\n        signatures   → ML-DSA-65  (NIST FIPS 204);  both → ML-KEM first",
    credible:
      "Deterministic: the same plan and config give the same order, and each decision records the key that separated the pair.",
  },
  {
    id: "waves",
    href: "qaoa",
    label: "QAOA",
    stages: ["qaoa"],
    hands: "A checked wave selection",
    does: "Cross-checks one week's choice of systems with QAOA on a simulator against the exact answer.",
    why: "An independent check that the planner's choice is optimal on a small instance. No quantum advantage is claimed.",
    math: "x_i ∈ {0,1}: cut over system i in this week\n  min  −Σ_i r_i a_i x_i + A (Σ_i w_i x_i + s − C)² + B Σ_(i needs j) x_i (1 − x_j)\n  a_i = exposure-years avoided by not deferring i;  A = B = 1 + Σ_i |c_i|\nx_i = (1 − Z_i)/2  ⇒  H_C = Σ_k h_k Z_k + Σ_k<l J_kl Z_k Z_l   (Ising)\n|γ,β⟩ = Π_(l=1..p) e^(−iβ_l H_M) e^(−iγ_l H_C) |+⟩^n ,  H_M = Σ_k X_k\napproximation ratio = best feasible sampled objective / exact optimum",
    credible:
      "Small enough to brute force, so every QAOA answer is checked against the exact optimum. Simulated; no quantum advantage claimed.",
  },
  {
    id: "gates",
    href: "handshakes",
    label: "Handshake gates",
    stages: ["capture", "gates"],
    hands: "Gate results per wave",
    does: "Tests every wave on real TLS 1.3 lab services: post-quantum handshake, no silent downgrade, compatibility, rollback.",
    why: "A wave counts as migrated only with handshake evidence, not because a config file changed.",
    math: "X25519MLKEM768: the ML-KEM-768 and X25519 shared secrets are concatenated\n  into the TLS 1.3 key schedule, so the session stays secret if either holds\npq_handshake PASS ⇔ negotiated group ∈ PQ allowlist\ndowngrade    PASS ⇔ a classical-only client is refused\ncompatibility: every client gets its expected outcome in the mode\nrollback:     the saved config hash is restored after an injected failure\napplied ⇔ every gate passed for the wave; otherwise not_verified_in_lab",
    credible:
      "Measured on real OpenSSL 3.6.5 TLS 1.3 handshakes in a local lab; scanned public hosts are never changed.",
  },
  {
    id: "proof_verified",
    href: "ledger?section=6",
    label: "Seal ledger",
    stages: ["seal"],
    hands: "Every result signed, the whole chain re-verified",
    does: "The ML-KEM (X25519MLKEM768) handshake and gate evidence is signed, and every entry's ML-DSA-65 signature is verified across the chain.",
    why: "Anyone can re-verify every result later, with signatures that stay secure against quantum attacks.",
    math: "for every entry i, in order:\n  index = i,  prev_i = SHA-256(entry_{i−1}),  pubkey fingerprint matches,\n  SHA-256(payload) = payload_hash,  ML-DSA-65.Verify(pk, entry_i, σ_i) = true\nroot = MTH(entries) (RFC 6962), with an inclusion proof per entry",
    credible:
      "ML-DSA-65 is NIST FIPS 204; the whole chain is re-verified, so a single changed byte is caught.",
  },
  {
    id: "review",
    href: "review",
    label: "Review",
    stages: [],
    hands: "Approved migration steps",
    does: "A person approves or rejects each result with a reason; the decision is signed too.",
    why: "Automation proposes; an accountable person decides, and that decision is evidence too.",
    math: "decision = {item, approve | reject, reason, reviewer, ts}\n  → appended to the ledger and signed with ML-DSA-65 like every other entry",
    credible:
      "A named person's decision is evidence too, and it cannot be edited afterwards without breaking the chain.",
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
  if (r.detect)
    f.inventory = {
      num: pl(r.assets.length, "system", "systems"),
      mean: "with cryptography to migrate",
      backend: "Detect inventory · risk and effort are assumptions",
    };
  if (r.exposure)
    f.schedule = {
      num: `${r.exposure.makespan_weeks} wk`,
      mean: `to migrate everything in ${pl(r.waves.length, "wave", "waves")} at the assumed capacity`,
      backend: solverLabel(results),
    };
  if (r.tiebreak) {
    const t = r.tiebreak as Any;
    const n = ((t.waves ?? []) as Any[]).reduce((k, w) => k + (w.batches ?? []).length, 0);
    f.tiebreak = {
      num: pl(t.tie_groups, "tie", "ties"),
      mean: `resolved across ${pl(n, "batch", "batches")}; Q-day ${t.threat.scenario} used for Mosca's margin`,
      backend: "deterministic keys · config/tiebreak.json (assumption)",
    };
  }
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
