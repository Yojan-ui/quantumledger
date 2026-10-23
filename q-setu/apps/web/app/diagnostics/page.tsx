import type { Metadata } from "next";
import { DiagnosticsApp } from "@/components/hud/DiagnosticsApp";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  title: "PQC diagnostics",
  description:
    "Scan a domain's TLS, score its quantum risk, apply a hybrid ML-KEM patch, anchor the proof in a signed chain and verify it: live.",
  path: "/diagnostics",
});

/**
 * The full-screen diagnostics HUD: the showpiece, and where presenter mode opens. md+: exactly one
 * screen. Phones: the page grows with the stacked panels and scrolls.
 */
export default function DiagnosticsPage() {
  return (
    <main id="main" className="min-h-svh p-2 md:h-svh md:p-3">
      <h1 className="sr-only">QuantumLedger PQC diagnostics</h1>
      <DiagnosticsApp />
    </main>
  );
}
