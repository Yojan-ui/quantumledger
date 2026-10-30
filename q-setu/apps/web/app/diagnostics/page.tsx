import type { Metadata } from "next";
import { AtlasHud } from "@/components/hud/AtlasHud";
import { DiagnosticsApp } from "@/components/hud/DiagnosticsApp";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  title: "PQC diagnostics",
  description:
    "Scan a domain's TLS, score its quantum risk, apply a hybrid ML-KEM patch, anchor the proof in a signed chain and verify it: live.",
  path: "/diagnostics",
});

/**
 * The full-screen diagnostics HUD: the showpiece, and where presenter mode opens. `?ws=<workspace>` switches
 * it to a Q-Shield (Atlas) workspace: Atlas's stages, real runs and their live log. Without it, the domain HUD.
 */
export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string | string[] }>;
}) {
  const raw = (await searchParams).ws;
  const ws = typeof raw === "string" && /^[a-z0-9-]{1,64}$/.test(raw) ? raw : null;
  return (
    <main id="main" className="h-svh p-2 md:p-3">
      <h1 className="sr-only">
        {ws ? `Q-Shield pipeline · ${ws}` : "QuantumLedger PQC diagnostics"}
      </h1>
      {ws ? <AtlasHud ws={ws} /> : <DiagnosticsApp />}
    </main>
  );
}
