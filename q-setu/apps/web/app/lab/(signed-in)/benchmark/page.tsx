import { Container } from "@/components/ui";
import { BenchmarkRunner } from "@/components/lab/BenchmarkRunner";
import { EngineOffline, LabFrame } from "@/components/lab/ui";
import { Copy } from "@/components/ui/Copy";
import { labPage } from "@/lib/lab/page";

export const dynamic = "force-dynamic";

/** Team only: customers get a 404 here, and the benchmark API refuses them too. */
export default async function LabBenchmark({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await labPage(searchParams, { team: true });
  if (ctx === "offline")
    return (
      <Container className="py-16 md:py-24">
        <EngineOffline />
      </Container>
    );
  return (
    <LabFrame
      user={ctx.user}
      customers={ctx.customers}
      scopeName={ctx.scopeName}
      title="Resilience benchmark"
      lead={
        <Copy
          simple="What this page shows: our own attacker agents hammer two practice copies of a bank site on this computer — one bare, one behind PQC + Shield — and measure how well it holds. It reports honestly, including anything that gets through."
          technical="The Lab's attacker agents run the same goals against both loopback sandbox copies (bare, and behind a real PQC handshake + Shield). Outcomes are measured, rolled into a resilience score, and the report is signed with ML-DSA-65. Strictly loopback; nothing else is ever a target."
        />
      }
    >
      <BenchmarkRunner />
    </LabFrame>
  );
}
