"use client";

import Link from "next/link";
import { FLOW } from "@/lib/client/atlas-flow";
import { Details } from "./AtlasUI";

const source = "https://github.com/Yojan-ui/quantumledger/blob/feat/atlas-integration/qshield/";

export function AboutPipeline({ ws }: { ws: string }) {
  return (
    <Details summary="About this pipeline">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-body font-medium text-fg">Real data</h2>
          <p>
            Atlas records TLS handshakes from public Indian bank endpoints, selected from the CC0
            bank-in-domains dataset at pinned commit 7b161ae. The observations are in
            data/real_banks/scan_2026-10-29.csv. These are public connection metadata, not customer
            records, bank source code or an assessment of a bank.
          </p>
          <p>
            {ws === "demo"
              ? "You are viewing the default fictional-bank demo: detect/fixtures/mock_bank, with real scanner output and local TLS lab evidence."
              : ws === "real-banks"
                ? "This is the real-banks workspace. Migration is planned only; no bank has been changed."
                : "This workspace uses its own source or a live TLS endpoint scan (one handshake per public host). Its results are not bank observations, and nothing is changed on a scanned host."}
          </p>
          <Link
            prefetch={false}
            href="/atlas/real-banks"
            className="block underline underline-offset-4"
          >
            Open bank observations (Atlas sign-in required)
          </Link>
          <a
            href={source + "data/real_banks/DATA_DICTIONARY.md"}
            className="block underline underline-offset-4"
          >
            Observation method and source
          </a>
        </section>
        <section className="space-y-2">
          <h2 className="text-body font-medium text-fg">What it does</h2>
          <ul className="space-y-2">
            {FLOW.map((s) => (
              <li key={s.id}>
                <strong className="font-medium text-fg">{s.label}:</strong> {s.hands}.
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="text-body font-medium text-fg">Why it matters</h2>
          <p>
            Harvest-now-decrypt-later: recorded traffic relying on classical key exchange can remain
            sensitive into the quantum threat window. Mosca’s inequality compares secrecy lifetime
            plus migration time with time to that threat: x + y &gt; z.
          </p>
          <p>
            Banks can compare a migration estimate with their own deadline in weeks. Atlas documents
            a workspace planning deadline, not a regulatory deadline. Shelf life, effort, capacity
            and Q-day scenarios are assumptions, not forecasts.
          </p>
          <a href={source + "docs/TIEBREAK.md"} className="block underline underline-offset-4">
            Mosca model and tie-break method
          </a>
          <a href={source + "docs/BACKEND.md"} className="block underline underline-offset-4">
            Deadline and lab evidence limits
          </a>
        </section>
        <section className="space-y-2">
          <h2 className="text-body font-medium text-fg">Our workflow</h2>
          <p>
            Detect → inventory → plan → tie-break → QAOA → handshake gates → seal ledger → review.
          </p>
          <p>
            Findings are signed before planning. The 3D view shows the actual execution order from
            Atlas: lab handshakes and gates run before QAOA, followed by sealing and the report.
            Human review follows the run.
          </p>
          <h2 className="pt-2 text-body font-medium text-fg">Why we stand out</h2>
          <p>
            Recorded public TLS observations and live endpoint scans; a tamper-evident ML-DSA Proof
            Chain; quantum (QAOA) and classical results checked against the exact optimum;
            deterministic ML-KEM/ML-DSA patch ordering for tied batches.
          </p>
          <p>
            Simulator, recorded hardware, assumptions and unverified systems retain their labels.
            Local lab success is not a bank deployment, and no quantum advantage is claimed.
          </p>
        </section>
      </div>
    </Details>
  );
}

export function StageDetails({ href }: { href: string }) {
  const stage =
    FLOW.find((s) => s.href === href) ??
    (href === "ledger" ? FLOW.find((s) => s.id === "proof_verified") : undefined);
  if (!stage) return null;
  return (
    <Details>
      <p>{stage.does}</p>
      <p>{stage.why}</p>
      <p>
        Values come from this workspace’s Atlas results. Missing evidence stays unavailable. Risk,
        effort, capacity and secrecy lifetime are configuration assumptions; gate results apply only
        to the recorded lab or endpoint.
      </p>
    </Details>
  );
}
