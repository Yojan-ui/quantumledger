import type { Metadata } from "next";
import { QDayDemo } from "@/components/demo/qday/QDayDemo";

export const metadata: Metadata = { title: "Q-Day Time Machine · Q-Setu demo" };

export default function Page() {
  return <QDayDemo />;
}
