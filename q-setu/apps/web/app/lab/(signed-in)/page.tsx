import Link from "next/link";
import { Container, Panel, Stat } from "@/components/ui";
import { AutoRefresh, SendTestTraffic } from "@/components/lab/client";
import { CustomerEditor } from "@/components/lab/CustomerEditor";
import { ago, EngineOffline, LabFrame, Score } from "@/components/lab/ui";
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

  return (
    <LabFrame
      user={user}
      customers={team ? customers : []}
      scopeName={ctx.scopeName}
      title="Overview"
      lead="Attacks Shield flagged on the protected sites, recorded as signed evidence. Shield raises the cost of abuse and makes it noisy; nothing here makes a site impossible to attack."
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
              value={scope.customer.readiness === null ? "—" : `${scope.customer.readiness}/100`}
              label="Readiness score"
            />
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-6 border-y border-line py-8 md:grid-cols-4">
        <Stat value={o.totals.incidents} label="Incidents" />
        <Stat value={o.totals.flagged} label="Flagged requests" />
        <Stat value={o.totals.patterns} label="Patterns" />
        <Stat
          value={qs.share === null ? "—" : `${Math.round(qs.share * 100)}%`}
          label="Traffic quantum-safe"
          footnote={
            qs.share === null
              ? qs.linked
                ? "(no Shield Edge data yet)"
                : "(no Shield site linked)"
              : `(${qs.connections.toLocaleString("en-GB")} TLS connections, 30 days)`
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
            <p className="mt-6 text-body text-fg-2">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-6">
              {top.map((p) => (
                <li key={p.id} className="border-t border-line py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-body text-fg">{p.name}</span>
                    <span className="tabular font-mono text-small text-fg-2">
                      {p.count} · {ago(p.lastSeen)}
                    </span>
                  </div>
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
            <p className="mt-6 text-body text-fg-2">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-6">
              {o.incidents.slice(0, 5).map((i) => (
                <li key={i.id} className="border-t border-line py-3">
                  <Link
                    href={`/lab/incidents/${i.id}${qsParam}`}
                    className="flex flex-wrap items-center justify-between gap-3 transition-colors duration-150 hover:text-fg"
                  >
                    <span className="text-body text-fg">{i.pattern.name}</span>
                    <span className="flex items-center gap-4">
                      <Score n={i.maxScore} />
                      <span className="text-small text-fg-3">{ago(i.lastSeen)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="mt-6 font-mono text-label uppercase text-fg-3">
        Evidence signed with {o.key.alg} · key {o.key.keyId}
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
