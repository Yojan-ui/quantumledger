import type { Metadata } from "next";
import { JoinRoom } from "@/components/room/JoinRoom";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Join live",
  description:
    "Seal a message with post-quantum encryption from your phone and watch it arrive on the big screen.",
  robots: { index: false },
};

/** The phone page behind the QR code. No nav, no globe: one task, done fast. */
export default function JoinPage() {
  return (
    <main id="main" className="mx-auto min-h-svh w-full max-w-text px-5 pb-16 pt-6">
      <Logo />
      <JoinRoom />
    </main>
  );
}
