import type { Metadata } from "next";
import { QaoaStep } from "@/components/atlas/steps/QaoaStep";

export const metadata: Metadata = { title: "Wave selection (QAOA) · Q-Shield" };

export default function Page() {
  return <QaoaStep />;
}
