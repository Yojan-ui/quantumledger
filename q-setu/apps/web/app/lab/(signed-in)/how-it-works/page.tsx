import { Container, Panel, Stat } from "@/components/ui";
import { RevealBelow } from "@/components/lab/RevealBelow";
import { EngineOffline, LabFrame } from "@/components/lab/ui";
import { Copy } from "@/components/ui/Copy";
import { modelDetail } from "@/lib/lab/data";
import { labPage } from "@/lib/lab/page";
import { modelNote } from "@/lib/lab/words";

export const dynamic = "force-dynamic";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;

/** Inputs → hidden layer → score, drawn with the role colours (no raw colours). */
function Diagram({ inputs }: { inputs: number }) {
  const H = 8;
  const W = 640;
  const Hh = 300;
  const y = (i: number, n: number) => 20 + ((Hh - 40) * (i + 0.5)) / n;
  return (
    <svg
      viewBox={`0 0 ${W} ${Hh}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${inputs} inputs, each connected to ${H} hidden units, which combine into one risk score.`}
    >
      <g className="text-line-strong" stroke="currentColor" strokeWidth="0.6">
        {Array.from({ length: inputs }).flatMap((_, i) =>
          Array.from({ length: H }).map((__, h) => (
            <line key={`${i}-${h}`} x1="90" y1={y(i, inputs)} x2="320" y2={y(h, H)} />
          )),
        )}
        {Array.from({ length: H }).map((_, h) => (
          <line key={`o${h}`} x1="320" y1={y(h, H)} x2="540" y2={Hh / 2} />
        ))}
      </g>
      <g className="text-kem" fill="currentColor">
        {Array.from({ length: inputs }).map((_, i) => (
          <circle key={i} cx="90" cy={y(i, inputs)} r="4" />
        ))}
      </g>
      <g className="text-sig" fill="currentColor">
        {Array.from({ length: H }).map((_, h) => (
          <circle key={h} cx="320" cy={y(h, H)} r="6" />
        ))}
      </g>
      <circle cx="540" cy={Hh / 2} r="12" className="text-ok" fill="currentColor" />
      <g
        className="text-fg-3"
        fill="currentColor"
        fontSize="12"
        fontFamily="var(--font-geist-mono)"
      >
        <text x="90" y={Hh - 2} textAnchor="middle">
          {inputs} signals
        </text>
        <text x="320" y={Hh - 2} textAnchor="middle">
          {H} hidden units
        </text>
        <text x="540" y={Hh / 2 + 32} textAnchor="middle">
          risk 0–1
        </text>
      </g>
    </svg>
  );
}

export default async function HowItWorks({
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
  const mt = m.metrics;
  return (
    <LabFrame
      user={user}
      customers={user.role === "team" ? customers : []}
      scopeName={ctx.scopeName}
      title="How the model works"
      lead={
        <Copy
          simple="What this shows: how the Lab's threat model decides whether a request is safe or an attack, what it learned from, how well it does, and what it can't do."
          technical={`A 16-8-1 feed-forward network (tanh hidden layer, sigmoid output), plain TypeScript, mini-batch gradient descent with momentum, class-balanced, L2. ${m.version ?? ""}`}
        />
      }
    >
      <RevealBelow className="flex flex-col gap-10">
        <Panel>
          <h2 className="text-h3 font-medium text-fg">
            <Copy simple="The idea in one picture" technical="Architecture" />
          </h2>
          <p className="mt-2 max-w-prose text-body text-fg-2">
            <Copy
              simple={`Every request becomes ${m.features.length} numbers (how fast, how many pages, how random the address looks…). A small network of ${8} hidden units weighs them and outputs a risk from 0 to 1: under 0.4 looks safe, 0.4 to 0.7 suspicious, above 0.7 an attack.`}
              technical="Inputs standardised with the training mean and standard deviation; output thresholds 0.4 / 0.7 for labels, 0.4 / 0.7 / 0.9 for slow / challenge / block. Explanations by occlusion in log-odds (each feature set to the training mean)."
            />
          </p>
          <div className="mt-6">
            <Diagram inputs={m.features.length} />
          </div>
        </Panel>

        <section aria-labelledby="hiw-data">
          <h2 id="hiw-data" className="text-h3 font-medium text-fg">
            <Copy simple="What it learned from" technical="Training data" />
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Panel>
              <p className="text-body text-fg">
                <Copy simple="Real attack data" technical={mt?.dataset ?? "CSIC 2010"} />
              </p>
              <p className="mt-2 text-small text-fg-2">
                <Copy
                  simple={`${mt?.datasetAttacks ?? 0} attack and ${mt?.datasetNormal ?? 0} normal web requests from the public CSIC 2010 dataset (a Spanish research council's labelled set). This is where it learns what injected code and odd addresses look like.`}
                  technical={`${mt?.datasetAttacks ?? 0} anomalous + ${mt?.datasetNormal ?? 0} normal requests; behaviour features held at a single browser request's values (the dataset has no timing). See packages/attack-lab/data/README.md.`}
                />
              </p>
            </Panel>
            <Panel>
              <p className="text-body text-fg">
                <Copy simple="Attacks this Lab recorded" technical="Lab evidence" />
              </p>
              <p className="mt-2 text-small text-fg-2">
                <Copy
                  simple={`${mt?.attacks ?? 0} attacks Shield caught here. This is where it learns behaviour: speed, bursts, machine-even timing, traps.`}
                  technical={`${mt?.attacks ?? 0} incidents; flagged requests = 1, let-through requests = 0 (newest ${2000} samples).`}
                />
              </p>
            </Panel>
            <Panel>
              <p className="text-body text-fg">
                <Copy simple="Ordinary visitors" technical="Unrecorded traffic" />
              </p>
              <p className="mt-2 text-small text-fg-2">
                <Copy
                  simple="Requests Shield saw and let through without recording, kept only as numbers, so it learns what normal looks like too."
                  technical="Feature vectors of unrecorded allowed requests (bounded ring of 2,000), no routes or identities."
                />
              </p>
            </Panel>
          </div>
        </section>

        <section aria-labelledby="hiw-acc">
          <h2 id="hiw-acc" className="text-h3 font-medium text-fg">
            <Copy simple="How well it does" technical="Held-back accuracy" />
          </h2>
          <p className="mt-2 max-w-prose text-body text-fg-2">
            <Copy
              simple="Before each update, about 1 in 5 attacks is hidden from training; the model is then tested on those. The number moves as new attacks arrive."
              technical="Hold-out: ≈20% of recorded incidents (whole incidents) and ≈20% of dataset rows and ordinary-traffic vectors, by hash. Deployed model is then trained on everything."
            />
          </p>
          <div className="mt-4 grid grid-cols-1 gap-6 border-y border-line py-8 sm:grid-cols-3">
            <Stat
              value={pct(mt?.accuracy)}
              label="Overall"
              footnote={`(${mt?.heldOut ?? 0} held-back requests)`}
            />
            <Stat
              value={pct(mt?.datasetAccuracy)}
              label="On real attack data"
              footnote="(CSIC 2010, held back)"
            />
            <Stat
              value={pct(mt?.labAccuracy)}
              label="On this Lab's attacks"
              footnote="(held back)"
            />
          </div>
          <p className="mt-3 font-mono text-label uppercase text-kem">
            {modelNote(mt, m.trainedAt)}
          </p>
        </section>

        <section aria-labelledby="hiw-learn">
          <h2 id="hiw-learn" className="text-h3 font-medium text-fg">
            <Copy simple="How it learns from new attacks" technical="Online retraining" />
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-body text-fg-2">
            <li>
              <Copy
                simple="Shield catches an attack and the Lab records it."
                technical="Recorder appends signed event records (each carries the current verdict)."
              />
            </li>
            <li>
              <Copy
                simple="A few seconds after the attack stops, the model retrains in the background on everything so far."
                technical="Debounced 2.5 s after the last write; trains in well under a second on this laptop."
              />
            </li>
            <li>
              <Copy
                simple="It tests itself on attacks it hasn't seen and updates its accuracy."
                technical="Hold-out evaluation, then full refit."
              />
            </li>
            <li>
              <Copy
                simple="The new version is saved and signed with a quantum-safe signature, like every record."
                technical="Weights written to the data folder; a model record (version, weights hash, metrics) is signed with ML-DSA-65 into the evidence chain."
              />
            </li>
          </ol>
        </section>

        <section aria-labelledby="hiw-signals">
          <h2 id="hiw-signals" className="text-h3 font-medium text-fg">
            <Copy simple={`The ${m.features.length} signals it weighs`} technical="Features" />
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-x-6 md:grid-cols-2">
            {m.features.map((f) => (
              <li key={f.id} className="border-t border-line py-3 text-small text-fg-2">
                <Copy simple={f.simple} technical={`${f.id}: ${f.technical}`} />
              </li>
            ))}
          </ul>
        </section>

        <Panel>
          <h2 className="text-h3 font-medium text-fg">
            <Copy simple="What it can't do" technical="Limits" />
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-body text-fg-2">
            <li>
              It doesn&apos;t catch everything. It gets better with more data, and it can be wrong
              in both directions.
            </li>
            <li>
              It advises; Shield&apos;s rules decide. Its verdict is recorded next to what Shield
              did.
            </li>
            <li>
              It learns from the labels it&apos;s given. Early steps of an attack that Shield
              hadn&apos;t flagged yet count as &ldquo;safe&rdquo;, which makes it less sure about
              the first moments of a flood.
            </li>
            <li>
              The public dataset is from 2010 and one shop&apos;s traffic; it teaches what injected
              code looks like, not how today&apos;s AI agents pace themselves (the Lab&apos;s own
              attacks teach that).
            </li>
            <li>
              It has no signal for a fake search-engine bot; Shield&apos;s DNS check catches those.
            </li>
            <li>It sees numbers about requests, never their contents or anyone&apos;s identity.</li>
          </ul>
        </Panel>
      </RevealBelow>
    </LabFrame>
  );
}
