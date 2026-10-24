import type { Metadata } from "next";
import { Scanner } from "@/components/demo/Scanner";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { Term } from "@/components/ui/Term";

export const metadata: Metadata = { title: "Quantum Readiness Scanner · QuantumLedger" };

export default function Page() {
  return (
    <DemoShell
      title="Quantum Readiness Scanner"
      workflow={{
        steps: [
          { simple: "Enter a site", technical: "Input: code, config, certificate or URL" },
          { simple: "We read its encryption", technical: "Static scan / TLS probe" },
          { simple: "See its quantum-safe score", technical: "Score, findings, CBOM" },
          { simple: "Fix with Shield", technical: "Ordered migration plan" },
        ],
      }}
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
