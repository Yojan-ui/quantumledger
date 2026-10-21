import Link from "next/link";
import { Container, Panel, Stat } from "@/components/ui";
import { AutoRefresh, SendTestTraffic } from "@/components/lab/client";
import { CustomerEditor } from "@/components/lab/CustomerEditor";
import { AttackMapView } from "@/components/lab/AttackMapView";
import { ago, EngineOffline, LabFrame, Score } from "@/components/lab/ui";
import { Copy } from "@/components/ui/Copy";
import { agoWords, patternStory, shieldSentence, stopped } from "@/lib/lab/words";
import { overviewFor, patternsFor, quantumSafe } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LabOverview({ searchParams }: { searchParams: SP }) {
  const ctx = await labPage(searchParams);
  if (ctx === "offline")
    return (
      <Container className="py-16 md:py-24">
        <EngineOffline />
      </Container>
    );
  const { user, scope, customers } = ctx;
  const team = user.role === "team";
  const inScope = scope.kind === "customer" ? [scope.customer] : customers;
  const [o, patterns, qs] = await Promise.all([
    overviewFor(scope),
    patternsFor(scope),
    quantumSafe(inScope),
  ]);
  const qsParam = ctx.customerParam ? `?customer=${ctx.customerParam}` : "";
  const top = patterns.slice(0, 5);
  const maxCount = Math.max(1, ...top.map((p) => p.count));
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const today = o.incidents.filter((i) => i.lastSeen >= startOfDay);
  const stoppedToday = today.filter((i) => stopped(i.actions).refused > 0);
  const sites = new Set(today.map((i) => i.site)).size;
  const allSealed = o.incidents.every((i) => i.sealed);
  const where = (n: number) =>
    scope.kind === "customer" ? "on your site" : `on ${n} site${n === 1 ? "" : "s"}`;
  const summary =
    o.incidents.length === 0
      ? team
        ? "No attacks yet. Press Send test traffic to watch Shield stop one."
        : "No attacks recorded on your site yet. When Shield stops one, it shows up here."
      : today.length
        ? `Today Shield stopped ${stoppedToday.length} attack${stoppedToday.length === 1 ? "" : "s"} ${where(sites)}.`
        : `No attacks today. Shield has stopped ${o.incidents.filter((i) => stopped(i.actions).refused > 0).length} so far, most recently ${agoWords(o.incidents[0]!.lastSeen)}.`;
  const mapIncidents = o.incidents.slice(0, 24).map((i) => {
    const { refused, total } = stopped(i.actions);
    return { id: i.id, pattern: i.pattern.id, refused, allowed: total - refused };
  });

  return (
    <LabFrame
      user={user}
      customers={team ? customers : []}
      scopeName={ctx.scopeName}
      title="Overview"
      lead={
        <Copy
          simple={`What this page shows: every attack Shield caught on ${team && scope.kind === "all" ? "your customers' sites" : "your site"}, and how it stopped them.`}
          technical="Attacks Shield flagged on the protected sites, recorded as signed evidence. Shield raises the cost of abuse and makes it noisy; nothing here makes a site impossible to attack."
        />
      }
      actions={team ? <SendTestTraffic /> : undefined}
    >
      <AutoRefresh seconds={10} />

      {user.role === "customer" && scope.kind === "customer" && (
        <Panel className="mb-10 border-sig">
          <p className="font-mono text-label uppercase text-sig">From the QuantumLedger team</p>
          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-split">
            <p className="whitespace-pre-line text-body text-fg-2">
              {scope.customer.note || "No note from the team yet."}
            </p>
            <Stat
              value={
                scope.customer.readiness === null ? (
                  <Copy simple="Not scored yet" technical="—" />
                ) : (
                  `${scope.customer.readiness}/100`
                )
              }
              label="Readiness score"
            />
          </div>
        </Panel>
      )}

      <section
        aria-label="Summary"
        className="mb-10 rounded-lg border border-line bg-raised p-6 md:p-8"
      >
        <p className="text-lead text-fg">
          <Copy
            simple={summary}
            technical={`${o.totals.incidents} incidents · ${o.totals.flagged} flagged requests · ${o.totals.patterns} patterns · ${o.totals.records} signed records`}
          />
        </p>
        {o.incidents.length > 0 && (
          <p className="mt-2 text-body text-fg-2">
            <Copy
              simple={
                allSealed
                  ? "All records are tamper-proof: each one is signed, so nobody can change it without it showing."
                  : "New records are being signed now; each one becomes tamper-proof within seconds."
              }
              technical={`Every record is signed with ${o.key.alg} and hash-chained to the one before it.`}
            />
          </p>
        )}
        <p className="mt-4 max-w-prose text-small text-fg-3" data-copy="simple">
          Why it matters to your company: attackers try sites like yours every day. Seeing what they
          tried, with proof that Shield stopped it, is what your board, auditors and customers will
          ask for.
        </p>
      </section>

      {mapIncidents.length > 0 && (
        <div className="mb-10">
          <AttackMapView
            incidents={mapIncidents}
            patterns={patterns.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 border-y border-line py-8 md:grid-cols-4">
        <Stat
          value={<Copy simple={o.totals.incidents || "None yet"} technical={o.totals.incidents} />}
          label="Incidents"
          footnote={<Copy simple="(attacks)" technical="" />}
        />
        <Stat
          value={<Copy simple={o.totals.flagged || "None yet"} technical={o.totals.flagged} />}
          label="Flagged requests"
          footnote={<Copy simple="(suspicious requests)" technical="" />}
        />
        <Stat
          value={<Copy simple={o.totals.patterns || "None yet"} technical={o.totals.patterns} />}
          label="Patterns"
          footnote={<Copy simple="(kinds of attack)" technical="" />}
        />
        <Stat
          value={
            qs.share === null ? (
              <Copy simple="Not measured" technical="—" />
            ) : (
              `${Math.round(qs.share * 100)}%`
            )
          }
          label="Traffic quantum-safe"
          footnote={
            qs.share === null ? (
              qs.linked ? (
                <Copy
                  simple="(appears once Shield's front door is in place)"
                  technical="(no Shield Edge data yet)"
                />
              ) : (
                <Copy
                  simple="(the team links your site to measure this)"
                  technical="(no Shield site linked)"
                />
              )
            ) : (
              `(${qs.connections.toLocaleString("en-GB")} TLS connections, 30 days)`
            )
          }
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-h3 font-medium text-fg">Top patterns</h2>
            <Link href={`/lab/patterns${qsParam}`} className="link-u text-small text-fg-2">
              All patterns
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="mt-6 text-body text-fg-2">
              <Copy
                simple="No attacks yet, so no patterns. Each kind of attack Shield stops gets a name here."
                technical="Nothing recorded yet."
              />
            </p>
          ) : (
            <ul className="mt-6">
              {top.map((p) => (
                <li key={p.id} className="border-t border-line py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-body text-fg">{p.name}</span>
                    <span className="tabular font-mono text-small text-fg-2">
                      <Copy
                        simple={`${p.count} time${p.count === 1 ? "" : "s"} · ${agoWords(p.lastSeen)}`}
                        technical={`${p.count} · ${ago(p.lastSeen)}`}
                      />
                    </span>
                  </div>
                  <p className="mt-1 text-small text-fg-3" data-copy="simple">
                    {patternStory(p.id).tried}
                  </p>
                  <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full bg-danger"
                      style={{ width: `${(p.count / maxCount) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-h3 font-medium text-fg">Latest incidents</h2>
            <Link href={`/lab/incidents${qsParam}`} className="link-u text-small text-fg-2">
              All incidents
            </Link>
          </div>
          {o.incidents.length === 0 ? (
            <p className="mt-6 text-body text-fg-2">
              <Copy
                simple={
                  team
                    ? "No attacks yet. Press Send test traffic to watch Shield stop one."
                    : "No attacks recorded on your site yet."
                }
                technical="Nothing recorded yet."
              />
            </p>
          ) : (
            <ul className="mt-6">
              {o.incidents.slice(0, 5).map((i) => (
                <li key={i.id} className="border-t border-line py-3">
                  <Link
                    href={`/lab/incidents/${i.id}${qsParam}`}
                    className="flex flex-wrap items-center justify-between gap-3 transition-colors duration-150 hover:text-fg"
                  >
                    <span>
                      <span className="block text-body text-fg">{i.pattern.name}</span>
                      <span className="block text-small text-fg-3" data-copy="simple">
                        {shieldSentence(i.actions)}
                      </span>
                    </span>
                    <span className="flex items-center gap-4">
                      <Score n={i.maxScore} />
                      <span className="text-small text-fg-3">
                        <Copy
                          simple={`${i.synthetic ? "Practice attack" : "Attack"} · ${agoWords(i.lastSeen)}`}
                          technical={ago(i.lastSeen)}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="mt-6 font-mono text-label uppercase text-fg-3">
        <Copy
          simple="Tamper-proof records: signed with a quantum-safe signature"
          technical={`Evidence signed with ${o.key.alg} · key ${o.key.keyId}`}
        />
      </p>

      {team && (
        <section className="mt-15" aria-labelledby="lab-customers">
          <h2 id="lab-customers" className="text-h3 font-medium text-fg">
            Special info for each customer
          </h2>
          <p className="mt-2 max-w-prose text-body text-fg-2">
            A note and a readiness score per customer. Each customer sees only their own, on their
            overview.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {inScope.map((c) => (
              <Panel key={c.id}>
                <p className="text-body text-fg">{c.name}</p>
                <p className="mb-4 mt-1 font-mono text-label uppercase text-fg-3">
                  {c.site} · {c.emails.join(", ")}
                </p>
                <CustomerEditor customer={c} />
              </Panel>
            ))}
          </div>
        </section>
      )}
    </LabFrame>
  );
}
