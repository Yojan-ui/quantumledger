import type { Metadata } from "next";
import { LedgerDemo } from "@/components/demo/ledger/LedgerDemo";

export const metadata: Metadata = { title: "Q-Ledger · Q-Setu demo" };

export default function Page() {
  return <LedgerDemo />;
}
