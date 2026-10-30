import type { Metadata } from "next";
import { ReviewStep } from "@/components/atlas/steps/ReviewStep";

export const metadata: Metadata = { title: "Review · Q-Shield" };

export default function Page() {
  return <ReviewStep />;
}
