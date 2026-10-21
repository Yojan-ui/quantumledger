import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Container, Panel } from "@/components/ui";
import {
  ActionChip,
  dur,
  EngineOffline,
  LabFrame,
  PHASE,
  PhaseChip,
  Score,
} from "@/components/lab/ui";
import { isDenied } from "@/lib/lab/access";
import { incidentFor } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";
import { IncidentStory } from "@/components/lab/IncidentStory";
import { Copy } from "@/components/ui/Copy";
import { incidentWords, patternStory, story } from "@/lib/lab/words";

export const dynamic = "force-dynamic";

const DOT = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  sig: "bg-sig",
  "fg-2": "bg-fg-2",
  "fg-3": "bg-fg-3",
};

export default async function LabIncident({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
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
  const d = await incidentFor(scope, (await params).id);
  if (isDenied(d)) notFound();
  const { incident: inc, timeline: t, check } = d;
  const span = Math.max(1, t.durationMs);
  const qs = ctx.customerParam ? `?customer=${ctx.customerParam}` : "";
  const verified = check.ok;

  return (
    <LabFrame
      user={user}
      customers={team ? customers : []}
      scopeName={ctx.scopeName}
      title={d.pattern.name}
      lead={
        <Copy
          simple={`What this page shows: one attack, step by step. ${patternStory(d.pattern.id).tried} ${patternStory(d.pattern.id).shield}`}
          technical={`${d.pattern.description} ${t.steps.length} steps over ${dur(t.durationMs)}${t.firstStop !== undefined ? `; Shield first refused at step ${t.firstStop + 1}.` : "; Shield refused nothing."}`}
        />
      }
      actions={
        team ? (
          <ButtonLink
            href={`/lab/replay?incident=${inc.id}${ctx.customerParam ? `&customer=${ctx.customerParam}` : ""}`}
          >
            Replay in sandbox
          </ButtonLink>
        ) : undefined
      }
    >
      <p className="mb-6 font-mono text-label uppercase text-fg-3">
        <Link href={`/lab/incidents${qs}`} className="link-u">
          Incidents
        </Link>{" "}
        /{" "}
        <Copy
          simple={incidentWords(inc.synthetic, inc.lastSeen)}
          technical={`${inc.id}${inc.synthetic ? " · test traffic" : ""}`}
        />
      </p>

      <Panel className="mb-6" as="section">
        <div data-copy="simple">
          <h2 className="text-h3 font-medium text-fg">What happened</h2>
          <p className="mb-6 mt-1 text-small text-fg-3">
            Green dots are steps Shield stopped; grey ones it let through.
          </p>
          <IncidentStory steps={story(t.steps, inc.clients[0])} />
        </div>
        <div data-copy="technical">
          <h2 className="text-h3 font-medium text-fg">Summary</h2>
          <p className="mt-2 text-body text-fg-2">
            {t.steps.length} steps over {dur(t.durationMs)}
            {t.firstStop !== undefined
              ? `; first refusal at step ${t.firstStop + 1}.`
              : "; nothing refused."}{" "}
            Actions:{" "}
            {Object.entries(t.actions)
              .map(([k, v]) => `${k} ${v}`)
              .join(", ")}
            .
          </p>
        </div>
      </Panel>

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-h3 font-medium text-fg">Timeline</h2>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(PHASE) as (keyof typeof PHASE)[])
              .filter((p) => t.phases[p])
              .map((p) => (
                <span key={p} className="flex items-center gap-2 text-small text-fg-2">
                  <span
                    aria-hidden
                    className={`block h-dot w-dot rounded-full ${DOT[PHASE[p].tone]}`}
                  />
                  {PHASE[p].label} {t.phases[p]}
                </span>
              ))}
          </div>
        </div>
        <div
          role="img"
          aria-label={`${t.steps.length} steps across ${dur(t.durationMs)}`}
          className="relative mx-1 mt-6 h-10 border-t border-line"
        >
          {t.steps.map((s) => (
            <span
              key={s.i}
              title={`${s.i + 1}. ${s.method} ${s.route} · ${s.action}`}
              className={`absolute top-3 block h-5 w-2 -translate-x-1 rounded-sm ${DOT[PHASE[s.phase].tone]} ${s.flagged ? "" : "opacity-40"}`}
              style={{ left: `${(s.offsetMs / span) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between font-mono text-label text-fg-3">
          <span>{new Date(inc.opened).toLocaleTimeString("en-GB")}</span>
          <span>+{dur(t.durationMs)}</span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-split">
        <Panel padded={false} className="px-6 py-2 md:px-8">
          <ol>
            {t.steps.map((s) => (
              <li
                key={s.i}
                className="grid grid-cols-entry gap-4 border-b border-line py-4 last:border-b-0"
              >
                <span className="tabular font-mono text-small text-fg-3">+{dur(s.offsetMs)}</span>
                <div className="min-w-0">
                  <p className="break-all font-mono text-small text-fg">
                    <span className="text-fg-3">{s.method}</span> {s.route}{" "}
                    <span className="text-fg-3">{s.status}</span>
                  </p>
                  {s.signals.length > 0 && (
                    <p className="mt-1 text-small text-fg-3">{s.signals.join(" · ")}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PhaseChip phase={s.phase} />
                    <ActionChip action={s.action} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel className={verified ? "border-sig" : "border-danger"}>
            <p
              className={`font-mono text-label uppercase ${verified ? "text-sig" : "text-danger"}`}
            >
              {verified ? (
                <Copy simple="Tamper-proof record: verified" technical="Signature verified" />
              ) : check.seal.ok ? (
                "An event fails its signature"
              ) : (
                "Not sealed yet"
              )}
            </p>
            <p className="mt-3 text-body text-fg-2">
              {verified ? (
                <Copy
                  simple={`Each of the ${check.events} steps was signed when it happened. We just checked every signature: nothing has been changed since.`}
                  technical={`All ${check.events} events and the incident seal check out against the lab's ${d.key.alg} key.`}
                />
              ) : (
                "The engine couldn't verify every record of this incident."
              )}
            </p>
            <dl className="mt-4 grid grid-cols-keys gap-x-4 gap-y-2 font-mono text-small">
              <dt className="text-fg-3">algorithm</dt>
              <dd className="text-fg">{d.key.alg}</dd>
              <dt className="text-fg-3">key id</dt>
              <dd className="break-all text-fg">{d.key.keyId}</dd>
              <dt className="text-fg-3">events</dt>
              <dd className="text-fg">
                {check.events} signed
                {check.badEvents.length ? `, ${check.badEvents.length} failing` : ""}
              </dd>
              <dt className="text-fg-3">seal</dt>
              <dd className="text-fg">
                {d.seal ? `record ${d.seal.seq}, covers ${d.seal.covers}` : "pending"}
                {d.seal && check.unsealed > 0 ? ` (+${check.unsealed} newer)` : ""}
              </dd>
              {d.seal && (
                <>
                  <dt className="text-fg-3">seal hash</dt>
                  <dd className="break-all text-fg">{d.seal.hash.slice(0, 32)}…</dd>
                </>
              )}
            </dl>
          </Panel>
          <Panel>
            <h2 className="text-h3 font-medium text-fg">Source</h2>
            <dl className="mt-4 grid grid-cols-keys gap-x-4 gap-y-2 text-small">
              <dt className="text-fg-3">peak risk</dt>
              <dd>
                <Score n={inc.maxScore} />
              </dd>
              <dt className="text-fg-3">IP hashes</dt>
              <dd className="break-all font-mono text-fg">{inc.ipHashes.join(", ")}</dd>
              <dt className="text-fg-3">ASN</dt>
              <dd className="text-fg-2">{inc.asns.join(", ") || "no lookup configured"}</dd>
              <dt className="text-fg-3">clients</dt>
              <dd className="text-fg">{inc.clients.join(", ")}</dd>
              <dt className="text-fg-3">engine events</dt>
              <dd className="text-fg">{inc.types.join(", ")}</dd>
            </dl>
            <p className="mt-4 text-small text-fg-3">
              IPs are kept only as keyed hashes. No bodies, query strings or headers are stored.
            </p>
          </Panel>
        </div>
      </div>
    </LabFrame>
  );
}
