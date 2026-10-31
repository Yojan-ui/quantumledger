import type { Metadata } from "next";
import { TiebreakStep } from "@/components/atlas/steps/TiebreakStep";

export const metadata: Metadata = { title: "Tie-break priority · Q-Shield" };

export default function Page() {
  return <TiebreakStep />;
}
