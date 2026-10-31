import type { Metadata } from "next";
import { InventoryStep } from "@/components/atlas/steps/InventoryStep";

export const metadata: Metadata = { title: "Inventory & drift · Q-Shield" };

export default function Page() {
  return <InventoryStep />;
}
