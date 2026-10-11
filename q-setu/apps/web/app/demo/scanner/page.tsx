import type { Metadata } from "next";
import { Scanner } from "@/components/demo/Scanner";
import { DemoShell } from "@/components/demo/shell/DemoShell";

export const metadata: Metadata = { title: "Quantum Readiness Scanner · Q-Setu" };

export default function Page() {
  return (
    <DemoShell
      title="Quantum Readiness Scanner"
      caption="Paste code, a config or a certificate, or scan a live website's TLS. Get a readiness score, findings, a CycloneDX CBOM and an ordered migration plan."
    >
      <Scanner />
    </DemoShell>
  );
}
