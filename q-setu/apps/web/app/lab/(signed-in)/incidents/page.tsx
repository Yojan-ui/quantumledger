import Link from "next/link";
import { Container } from "@/components/ui";
import { AutoRefresh } from "@/components/lab/client";
import { ago, Chip, dur, EngineOffline, LabFrame, Score } from "@/components/lab/ui";
import { overviewFor } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";

export const dynamic = "force-dynamic";

export default async function LabIncidents({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await labPage(searchParams);
  if (ctx === "offline")
    return (
      <Container className="py-16 md:py-24">
        <EngineOffline />
      </Container>
    );
  const { user, scope, customers } = ctx;
  const team = user.role === "team";
  const o = await overviewFor(scope);
  const qs = ctx.customerParam ? `?customer=${ctx.customerParam}` : "";
  const nameOf = (site: string) => customers.find((c) => c.site === site)?.name ?? site;

  return (
    <LabFrame
      user={user}
      customers={team ? customers : []}
      scopeName={ctx.scopeName}
      title="Incidents"
      lead="Flagged requests grouped by source and session, newest first. Every record is signed with ML-DSA-65 and chained to the one before it."
    >
      <AutoRefresh seconds={5} />
      {o.incidents.length === 0 ? (
        <p className="rounded-lg border border-line bg-raised p-8 text-body text-fg-2">
          No incidents recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-raised">
          <table className="w-full text-left text-small">
            <thead>
              <tr className="border-b border-line font-mono text-label uppercase text-fg-3">
                <th className="px-4 py-3 font-normal">Pattern</th>
                {team && <th className="px-4 py-3 font-normal">Customer</th>}
                <th className="px-4 py-3 font-normal">Steps</th>
                <th className="px-4 py-3 font-normal">Peak risk</th>
                <th className="px-4 py-3 font-normal">Shield</th>
                <th className="px-4 py-3 font-normal">Last seen</th>
                <th className="px-4 py-3 font-normal">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {o.incidents.map((i) => {
                const refused =
                  (i.actions.block ?? 0) + (i.actions.challenge ?? 0) + (i.actions.limit ?? 0);
                return (
                  <tr key={i.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/lab/incidents/${i.id}${qs}`} className="link-u text-fg">
                        {i.pattern.name}
                      </Link>
                      <span className="mt-1 block font-mono text-label text-fg-3">
                        {i.id}
                        {i.synthetic ? " · test traffic" : ""}
                      </span>
                    </td>
                    {team && <td className="px-4 py-3 text-fg-2">{nameOf(i.site)}</td>}
                    <td className="tabular px-4 py-3 font-mono text-fg-2">
                      {i.steps} · {dur(i.durationMs)}
                    </td>
                    <td className="px-4 py-3">
                      <Score n={i.maxScore} />
                    </td>
                    <td className="px-4 py-3">
                      {refused ? (
                        <Chip tone="ok">refused {refused}</Chip>
                      ) : (
                        <Chip tone="fg-2">allowed</Chip>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-2">{ago(i.lastSeen)}</td>
                    <td className="px-4 py-3">
                      {i.sealed ? <Chip tone="sig">signed</Chip> : <Chip tone="fg-3">sealing</Chip>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </LabFrame>
  );
}
