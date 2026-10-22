import { Container, Panel, Stat } from "@/components/ui";
import { AutoRefresh } from "@/components/lab/client";
import { EngineOffline, LabFrame } from "@/components/lab/ui";
import { Copy } from "@/components/ui/Copy";
import { modelDetail } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";
import { agoWords, LABEL_WORDS, modelNote, RESPONSE_WORDS } from "@/lib/lab/words";

export const dynamic = "force-dynamic";

const LADDER = [
  { label: "safe", from: "0.00", response: "allow" },
  { label: "suspicious", from: "0.40", response: "slow" },
  { label: "attack", from: "0.70", response: "challenge" },
  { label: "attack", from: "0.90", response: "block" },
] as const;

export default async function LabModel({
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
  const { user, customers } = ctx;
  const m = await modelDetail();
  const metrics = m.metrics;
  const acc = metrics ? Math.round(metrics.accuracy * 100) : 0;
  const maxAttacks = Math.max(1, ...m.history.map((h) => h.metrics.attacks));

  return (
    <LabFrame
      user={user}
      customers={user.role === "team" ? customers : []}
      scopeName={ctx.scopeName}
      title="Threat model"
      lead={
        <Copy
          simple="What this page shows: a small learning model that scores every request as safe or an attack, explains why, and gets better from each attack the Lab records. It runs on this computer; nothing is sent anywhere."
          technical="A 13-8-1 neural network (tanh, sigmoid) in plain TypeScript, trained offline by full-batch gradient descent on the Lab's recorded events (flagged = 1, let through = 0) plus unrecorded ordinary traffic. Retrains in the background on new evidence; each update and each verdict is signed with ML-DSA-65."
        />
      }
    >
      <AutoRefresh seconds={4} />
      <p role="status" className="mb-8 font-mono text-label uppercase text-kem">
        <Copy
          simple={modelNote(metrics, m.trainedAt)}
          technical={`${m.version ?? "no model yet"} · ${m.updates} signed update${m.updates === 1 ? "" : "s"}${m.lastSigned ? ` · last record #${m.lastSigned.seq}` : ""}`}
        />
      </p>

      <div className="grid grid-cols-2 gap-6 border-y border-line py-8 md:grid-cols-4">
        <Stat
          value={metrics ? `${acc}%` : <Copy simple="Not yet" technical="—" />}
          label="Accuracy"
          footnote={
            metrics ? (
              <Copy
                simple={`(on ${metrics.heldOut} requests from attacks it hadn't seen)`}
                technical={`(held-back requests: ${metrics.heldOut})`}
              />
            ) : undefined
          }
        />
        <Stat
          value={metrics?.attacks ?? 0}
          label="Attacks learned from"
          footnote="(all protected sites)"
        />
        <Stat
          value={metrics?.samples ?? 0}
          label="Requests studied"
          footnote={metrics?.capped ? "(newest 2,000 kept)" : undefined}
        />
        <Stat
          value={metrics ? `${metrics.ms} ms` : <Copy simple="Not yet" technical="—" />}
          label="Last training took"
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-h3 font-medium text-fg">
            <Copy simple="From score to Shield's response" technical="Verdict → response ladder" />
          </h2>
          <p className="mt-2 text-small text-fg-2">
            <Copy
              simple="The model's verdict feeds Shield's response: it advises allow, slow, challenge or block, next to what Shield's rules decided. Every verdict is saved in the tamper-proof record. It can be wrong; it makes Shield's judgement faster to apply to look-alike attacks, not perfect."
              technical="Each recorded request carries the model's verdict (score, label, confidence, mapped response, top features) inside its signed event record. Shield's rule engine still decides; the model's response is advisory."
            />
          </p>
          <ul className="mt-4">
            {LADDER.map((r) => (
              <li
                key={r.from}
                className="flex items-baseline justify-between gap-4 border-t border-line py-3 text-small"
              >
                <span className="text-fg">
                  <Copy
                    simple={LABEL_WORDS[r.label]}
                    technical={`${r.label} (score ≥ ${r.from})`}
                  />
                </span>
                <span className="text-fg-2">
                  <Copy simple={RESPONSE_WORDS[r.response]} technical={r.response} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <h2 className="text-h3 font-medium text-fg">
            <Copy simple="Model updated" technical="Signed model updates" />
          </h2>
          <p className="mt-2 text-small text-fg-2">
            <Copy
              simple="Each time the Lab records new attacks, the model retrains in the background and checks itself on attacks it hasn't seen."
              technical="Debounced retrain on new evidence; hold-out is whole incidents (≈1 in 5). Newest first."
            />
          </p>
          {m.history.length === 0 ? (
            <p className="mt-4 text-body text-fg-2">
              <Copy
                simple="No updates yet. Send test traffic from the Overview and watch this list grow."
                technical="No model records yet."
              />
            </p>
          ) : (
            <ol className="mt-4">
              {m.history.slice(0, 8).map((h) => (
                <li key={h.seq} className="border-t border-line py-3 text-small">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-fg">
                      <Copy
                        simple={`Learned from ${h.metrics.attacks} attacks · ${Math.round(h.metrics.accuracy * 100)}% right`}
                        technical={`${h.version} · ${h.metrics.samples} samples · acc ${h.metrics.accuracy.toFixed(3)} (n=${h.metrics.heldOut})`}
                      />
                    </span>
                    <span className="text-fg-3">
                      <Copy simple={agoWords(h.trainedAt)} technical={`record #${h.seq}`} />
                    </span>
                  </div>
                  <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                    <span
                      className="block h-full bg-sig"
                      style={{ width: `${(h.metrics.attacks / maxAttacks) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <section aria-labelledby="lab-features" className="mt-10">
        <h2 id="lab-features" className="text-h3 font-medium text-fg">
          <Copy simple="What it looks at" technical="Features (13)" />
        </h2>
        <p className="mt-2 max-w-prose text-body text-fg-2">
          <Copy
            simple="Only what Shield already sees about each request: no message contents, no passwords, no personal details."
            technical="Computed per request from recorded metadata and a bounded per-source history keyed by the salted IP hash."
          />
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {m.features.map((f) => (
            <li key={f.id} className="border-t border-line py-3 text-small text-fg-2">
              <Copy simple={f.simple} technical={`${f.id}: ${f.technical}`} />
            </li>
          ))}
        </ul>
      </section>
    </LabFrame>
  );
}
