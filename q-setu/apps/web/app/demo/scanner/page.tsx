import type { Metadata } from "next";
import { Scanner } from "@/components/demo/Scanner";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { Term } from "@/components/ui/Term";

export const metadata: Metadata = { title: "Quantum Readiness Scanner · QuantumLedger" };

export default function Page() {
  return (
    <DemoShell
      title="Quantum Readiness Scanner"
      caption={
        <>
          Paste code, a config or a certificate, or scan a live website&apos;s TLS. Get a readiness
          score, findings, a CycloneDX <Term id="cbom">CBOM</Term> and an ordered migration plan.
        </>
      }
    >
      <Scanner />
    </DemoShell>
  );
}
