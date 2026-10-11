import type { Metadata } from "next";
import { DeployDemo } from "@/components/demo/deploy/DeployDemo";

export const metadata: Metadata = { title: "Deploy anywhere · Q-Setu demo" };

export default function Page() {
  return <DeployDemo />;
}
