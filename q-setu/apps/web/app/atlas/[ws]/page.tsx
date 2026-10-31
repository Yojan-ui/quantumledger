import type { Metadata } from "next";
import { OverviewStep } from "@/components/atlas/steps/OverviewStep";

export const metadata: Metadata = { title: "Overview · Q-Shield" };

/** /atlas/<ws>: the workspace Overview (Atlas's /w/<ws>/pipeline). */
export default function Page() {
  return <OverviewStep />;
}
