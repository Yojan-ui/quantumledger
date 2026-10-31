import type { Metadata } from "next";
import { HandshakesStep } from "@/components/atlas/steps/HandshakesStep";

export const metadata: Metadata = { title: "Handshake gates · Q-Shield" };

export default function Page() {
  return <HandshakesStep />;
}
