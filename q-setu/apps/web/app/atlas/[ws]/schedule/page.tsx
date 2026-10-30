import type { Metadata } from "next";
import { ScheduleStep } from "@/components/atlas/steps/ScheduleStep";

export const metadata: Metadata = { title: "Plan · Q-Shield" };

export default function Page() {
  return <ScheduleStep />;
}
