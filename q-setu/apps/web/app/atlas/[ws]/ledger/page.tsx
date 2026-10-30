import type { Metadata } from "next";
import { LedgerStep } from "@/components/atlas/steps/LedgerStep";

export const metadata: Metadata = { title: "Proof Chain · Q-Shield" };

export default function Page() {
  return <LedgerStep />;
}
