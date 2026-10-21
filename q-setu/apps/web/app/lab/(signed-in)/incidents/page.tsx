import Link from "next/link";
import { Container } from "@/components/ui";
import { AutoRefresh } from "@/components/lab/client";
import { ago, Chip, dur, EngineOffline, LabFrame, Score } from "@/components/lab/ui";
import { overviewFor } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";
import { Copy } from "@/components/ui/Copy";
import { agoWords, incidentWords, patternStory, shieldSentence } from "@/lib/lab/words";

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
      lead={
        <Copy
          simple="What this page shows: each attack Shield caught, newest first. Open one to read what happened, step by step."
          technical="Flagged requests grouped by source and session, newest first. Every record is signed with ML-DSA-65 and chained to the one before it."
        />
      }
    >
      <AutoRefresh seconds={5} />
      {o.incidents.length === 0 ? (
        <p className="rounded-lg border border-line bg-raised p-8 text-body text-fg-2">
          <Copy
            simple={
              team
                ? "No attacks yet. Go to Overview and press Send test traffic to watch Shield stop one."
                : "No attacks recorded on your site yet. When Shield stops one, it shows up here."
            }
            technical="No incidents recorded yet."
          />
        </p>
      ) : (
        <>
          {/* Phones: one card per attack, with its plain story line. */}
          <ul className="flex flex-col gap-4 md:hidden">
            {o.incidents.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/lab/incidents/${i.id}${qs}`}
                  className="block rounded-lg border border-line bg-raised p-5 transition-colors duration-150 hover:border-line-strong"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-body text-fg">{i.pattern.name}</span>
                    <Score n={i.maxScore} />
                  </span>
                  <span className="mt-1 block font-mono text-label text-fg-3">
                    <Copy
                      simple={incidentWords(i.synthetic, i.lastSeen)}
                      technical={`${i.id}${i.synthetic ? " · test traffic" : ""}`}
                    />
                    {team ? ` · ${nameOf(i.site)}` : ""}
                  </span>
                  <span className="mt-3 block text-small text-fg-2">
                    <Copy
                      simple={`${patternStory(i.pattern.id).tried} ${shieldSentence(i.actions)}`}
                      technical={`${i.steps} steps · ${dur(i.durationMs)} · ${ago(i.lastSeen)}`}
                    />
                  </span>
                  <span className="mt-3 flex flex-wrap gap-2">
                    {i.sealed ? (
                      <Chip tone="sig">
                        <Copy simple="Tamper-proof record" technical="signed" />
                      </Chip>
                    ) : (
                      <Chip tone="fg-3">sealing</Chip>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-line bg-raised md:block">
            <table className="w-full text-left text-small">
              <thead>
                <tr className="border-b border-line font-mono text-label uppercase text-fg-3">
                  <th className="px-4 py-3 font-normal">
                    <Copy simple="Attack" technical="Pattern" />
                  </th>
                  {team && <th className="px-4 py-3 font-normal">Customer</th>}
                  <th className="px-4 py-3 font-normal">Steps</th>
                  <th className="px-4 py-3 font-normal">
                    <Copy simple="Danger" technical="Peak risk" />
                  </th>
                  <th className="px-4 py-3 font-normal">
                    <Copy simple="What Shield did" technical="Shield" />
                  </th>
                  <th className="px-4 py-3 font-normal">
                    <Copy simple="When" technical="Last seen" />
                  </th>
                  <th className="px-4 py-3 font-normal">
                    <Copy simple="Record" technical="Evidence" />
                  </th>
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
                          <Copy
                            simple={i.synthetic ? "Practice attack" : "Attack"}
                            technical={`${i.id}${i.synthetic ? " · test traffic" : ""}`}
                          />
                        </span>
                        <span
                          className="mt-1 block max-w-prose text-small text-fg-3"
                          data-copy="simple"
                        >
                          {patternStory(i.pattern.id).tried}
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
                          <Chip tone="ok">
                            <Copy
                              simple={`blocked ${refused} of ${i.steps} steps`}
                              technical={`refused ${refused}`}
                            />
                          </Chip>
                        ) : (
                          <Chip tone="fg-2">
                            <Copy simple="let through" technical="allowed" />
                          </Chip>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-fg-2">
                        <Copy simple={agoWords(i.lastSeen)} technical={ago(i.lastSeen)} />
                      </td>
                      <td className="px-4 py-3">
                        {i.sealed ? (
                          <Chip tone="sig">
                            <Copy simple="Tamper-proof" technical="signed" />
                          </Chip>
                        ) : (
                          <Chip tone="fg-3">sealing</Chip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </LabFrame>
  );
}
