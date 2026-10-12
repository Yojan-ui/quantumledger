import type { Metadata } from "next";
import { DeployDemo } from "@/components/demo/deploy/DeployDemo";

export const metadata: Metadata = { title: "Deploy anywhere · QuantumLedger demo" };

export default function Page() {
  return <DeployDemo />;
}
