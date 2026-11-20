import { Container } from "@/components/ui";
import { ReplayRunner } from "@/components/lab/ReplayRunner";
import { EngineOffline, LabFrame } from "@/components/lab/ui";
import { overviewFor } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";

export const dynamic = "force-dynamic";

/** Team only: customers get a 404 here, and the replay API refuses them too. */
export default async function LabReplay({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams;
  const ctx = await labPage(sp, { team: true });
  if (ctx === "offline")
    return (
      <Container className="py-16 md:py-24">
        <EngineOffline />
      </Container>
    );
  const { user, scope, customers } = ctx;
  const o = await overviewFor(scope);
  const q = await sp;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const nameOf = (site: string) => customers.find((c) => c.site === site)?.name ?? site;
  return (
    <LabFrame
      user={user}
      customers={customers}
      scopeName={ctx.scopeName}
      title="Replay"
      lead="Sends a saved incident’s steps, in order and with its pacing, to two fresh copies of the legacy bank on this machine: one bare, one behind Shield. The results show what each one did."
    >
      <ReplayRunner
        options={o.incidents.map((i) => ({
          id: i.id,
          label: `${i.pattern.name} · ${nameOf(i.site)} · ${i.steps} steps · ${i.id}`,
        }))}
        {...(one(q.incident) ? { initial: one(q.incident) } : {})}
        {...(one(q.job) ? { job: one(q.job) } : {})}
        {...(ctx.customerParam ? { customer: ctx.customerParam } : {})}
      />
    </LabFrame>
  );
}
