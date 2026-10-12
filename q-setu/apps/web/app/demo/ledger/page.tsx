import type { Metadata } from "next";
import { LedgerDemo } from "@/components/demo/ledger/LedgerDemo";

export const metadata: Metadata = { title: "Proof Chain · QuantumLedger demo" };

export default function Page() {
  return <LedgerDemo />;
}
