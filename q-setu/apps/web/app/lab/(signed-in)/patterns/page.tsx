import Link from "next/link";
import { Container, Panel } from "@/components/ui";
import { ago, EngineOffline, LabFrame } from "@/components/lab/ui";
import { patternsFor } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";

export const dynamic = "force-dynamic";

export default async function LabPatterns({
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
  const patterns = await patternsFor(scope);
  const max = Math.max(1, ...patterns.map((p) => p.count));
  const qs = ctx.customerParam ? `?customer=${ctx.customerParam}` : "";

  return (
    <LabFrame
      user={user}
      customers={user.role === "team" ? customers : []}
      scopeName={ctx.scopeName}
      title="Patterns"
      lead="Incidents that look alike, grouped by named rules that each say what evidence they key on. Anything that fits none of them lands in “Other automated abuse”."
    >
      {patterns.length === 0 ? (
        <p className="rounded-lg border border-line bg-raised p-8 text-body text-fg-2">
          No incidents yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {patterns.map((p) => (
            <Panel key={p.id} as="article">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-h3 font-medium text-fg">{p.name}</h2>
                  <p className="mt-1 text-body text-fg-2">{p.description}</p>
                </div>
                <div className="flex items-baseline gap-6">
                  <span className="tabular text-h3 font-medium text-fg">
                    {p.count}{" "}
                    <span className="text-small text-fg-3">incident{p.count === 1 ? "" : "s"}</span>
                  </span>
                  <span className="text-small text-fg-2">last seen {ago(p.lastSeen)}</span>
                </div>
              </div>
              <span className="mt-4 block h-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full bg-danger"
                  style={{ width: `${(p.count / max) * 100}%` }}
                />
              </span>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="font-mono text-label uppercase text-fg-3">Most requested</p>
                  <ul className="mt-2 font-mono text-small">
                    {p.topRoutes.map((r) => (
                      <li key={r.route} className="flex justify-between gap-4 py-1">
                        <span className="break-all text-fg">{r.route}</span>
                        <span className="tabular text-fg-3">{r.n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-label uppercase text-fg-3">
                    Clients · {p.clients.join(", ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.incidentIds.slice(0, 12).map((id) => (
                      <Link
                        key={id}
                        href={`/lab/incidents/${id}${qs}`}
                        className="rounded-sm border border-line px-2 py-1 font-mono text-label text-fg-2 transition-colors duration-150 hover:text-fg"
                      >
                        {id}
                      </Link>
                    ))}
                    {p.incidentIds.length > 12 && (
                      <span className="text-small text-fg-3">+{p.incidentIds.length - 12}</span>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </LabFrame>
  );
}
