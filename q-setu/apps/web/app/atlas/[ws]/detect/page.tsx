import type { Metadata } from "next";
import { DetectStep } from "@/components/atlas/steps/DetectStep";

export const metadata: Metadata = { title: "Detect · Q-Shield" };

export default function Page() {
  return <DetectStep />;
}
