import type { Metadata } from "next";
import { HandshakeDemo } from "@/components/demo/handshake/HandshakeDemo";

export const metadata: Metadata = { title: "How it works · Q-Setu demo" };

export default function Page() {
  return <HandshakeDemo />;
}
