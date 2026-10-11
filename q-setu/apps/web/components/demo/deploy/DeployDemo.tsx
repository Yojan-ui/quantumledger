"use client";

import type { SectorId } from "@qsetu/sim";
import { useEffect, useMemo, useState } from "react";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { SectorSwitcher } from "@/components/demo/shell/SectorSwitcher";
import { StepControls } from "@/components/demo/shell/StepControls";
import { Button, Code, Heading, Label, Text } from "@/components/ui";
import { ADAPTERS, ADAPTER_ORDER, SITES, type AdapterId } from "@/data/sites";
import { LiveConsole } from "@/components/live/LiveConsole";
import { Odometer } from "@/components/ui/Odometer";
import { errText } from "@/lib/client/api";
import { useMetrics } from "@/lib/client/live";
import { useStepper } from "@/lib/client/useStepper";
import type { OpEvent } from "@/lib/live/types";
import { BEFORE_AFTER, runAdapter, SNIPPETS, type RunResult } from "./adapters";
import { CertificateFlow } from "./CertificateFlow";
import { notify, world, type NodeState } from "@/components/world/store";

/** Adapter work on the server, deployed-node traffic, and anything this tab did. */
const consoleFilter = (e: OpEvent) =>
  !!e.site || ["web", "shield", "sdk", "vault", "certs", "edge", "browser"].includes(e.source);

/** After deploy, each sealed node keeps doing real work (sign, seal, open, verify) about once a second. */
function useNodeTraffic(sites: string[]) {
  const key = sites.join(",");
  useEffect(() => {
    if (!sites.length) return;
    let i = 0;
    const t = setInterval(
      () => {
        if (document.hidden) return;
        const site = sites[i++ % sites.length]!;
        void fetch("/api/traffic", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ site }),
        }).catch(() => {});
      },
      Math.max(350, 1100 / sites.length),
    );
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function DeployDemo() {
  const [sector, setSector] = useState<SectorId>("fintech");
  const [adapter, setAdapter] = useState<AdapterId>("web");
  const [states, setStates] = useState<Record<string, NodeState>>({});
  const [result, setResult] = useState<RunResult>();
  const [reading, setReading] = useState<MeterReading>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [tamper, setTamper] = useState<string>();

  const sectorSites = useMemo(() => SITES.filter((s) => s.sector === sector), [sector]);
  const metrics = useMetrics();
  useNodeTraffic(SITES.filter((s) => states[s.id] === "protected").map((s) => s.id));

  // The map is the site's own globe: tell the world which sector and which nodes are protected.
  useEffect(() => {
    world.sector = sector;
    world.nodeStates = states;
    notify();
  }, [sector, states]);
  useEffect(
    () => () => {
      world.nodeStates = {};
    },
    [],
  );

  async function deploy(a: AdapterId) {
    const site = sectorSites.find((s) => s.adapter === a)!;
    setAdapter(a);
    setRunning(true);
    setError(undefined);
    setTamper(undefined);
    setStates((s) => ({ ...s, [site.id]: "deploying" }));
    try {
      const r = await runAdapter(a, sector);
      setResult(r);
      setReading(r.meter);
      setStates((s) => ({ ...s, [site.id]: "protected" }));
    } catch (e) {
      setError((e as Error).message);
      setStates((s) => ({ ...s, [site.id]: "vulnerable" }));
    } finally {
      setRunning(false);
    }
  }

  // Step / Play walk the sector's nodes west → east ("Deploy all" = a wave across the map).
  const stepper = useStepper(sectorSites.length, (i) => deploy(sectorSites[i]!.adapter), 500);

  function reset() {
    stepper.reset();
    setStates({});
    setResult(undefined);
    setReading(undefined);
  }

  async function tamperVault() {
    if (!result?.vaultId) return;
    await fetch(`/api/vault/${result.vaultId}/tamper`, { method: "POST" });
    const r = await (await fetch(`/api/vault/${result.vaultId}`)).json();
    setTamper(r.error ? errText(r) : "Read succeeded (unexpected)");
  }

  const protectedCount = sectorSites.filter((s) => states[s.id] === "protected").length;
  const snippet = SNIPPETS[adapter];

  return (
    <DemoShell
      title="Demo 2 · Deploy anywhere"
      caption="Pick a system and deploy its Q-Setu adapter for real. Grey nodes are harvestable today; sealed nodes turn cyan."
      controls={
        <StepControls
          {...stepper}
          onStep={stepper.step}
          onPlay={stepper.play}
          onReset={reset}
          stepLabel="Deploy next"
          playLabel="Deploy all"
          busy={running || stepper.busy}
          primaryPlay={false}
        />
      }
      meter={<ComputeMeter reading={reading} profile={adapter === "edge" ? "edge" : "standard"} />}
      console={<LiveConsole title="Live console · deployed nodes" filter={consoleFilter} />}
      onAutoplay={() => void stepper.play()}
    >
      <div className="grid grid-cols-1 gap-12 xl:grid-cols-demo">
        <aside className="space-y-8">
          <SectorSwitcher
            value={sector}
            onChange={(s) => (setSector(s), stepper.reset(), setResult(undefined))}
            disabled={running || stepper.playing}
          />
          <div
            role="radiogroup"
            aria-label="What are you protecting?"
            className="border-b border-line"
          >
            {ADAPTER_ORDER.map((a) => {
              const site = sectorSites.find((s) => s.adapter === a)!;
              const st = states[site.id] ?? "vulnerable";
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={adapter === a}
                  onClick={() => setAdapter(a)}
                  className="flex w-full items-center justify-between gap-4 border-t border-line py-3 text-left"
                >
                  <span>
                    <span
                      className={`block text-small transition-colors duration-150 ${adapter === a ? "text-fg" : "text-fg-2"}`}
                    >
                      {ADAPTERS[a].label}
                    </span>
                    <span className="block text-small text-fg-3">{site.label}</span>
                  </span>
                  {st === "protected" && (
                    <span
                      className="ml-auto font-mono text-label text-fg-3"
                      aria-label="operations since deploy"
                    >
                      <Odometer value={(metrics?.bySite[site.id] ?? 0).toLocaleString("en-IN")} />{" "}
                      ops
                    </span>
                  )}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${st === "protected" ? "bg-accent" : st === "deploying" ? "bg-fg-2" : "bg-fg-3"}`}
                    aria-label={st === "protected" ? "sealed" : st}
                  />
                </button>
              );
            })}
          </div>
          <div className="space-y-4">
            <Label as="p">
              {ADAPTERS[adapter].product} · {ADAPTERS[adapter].target}
            </Label>
            <Code code={snippet.code} />
            <dl className="space-y-3">
              <div>
                <Label as="dt">Before</Label>
                <dd className="mt-1 text-small text-fg-2">{BEFORE_AFTER[adapter].before}</dd>
              </div>
              <div>
                <Label as="dt">After</Label>
                <dd className="mt-1 text-small text-fg-2">{BEFORE_AFTER[adapter].after}</dd>
              </div>
            </dl>
            <Button
              variant="primary"
              onClick={() => deploy(adapter)}
              disabled={running || stepper.playing}
              className="w-full"
            >
              {running ? "Deploying…" : `Deploy ${ADAPTERS[adapter].product}`}
            </Button>
            {adapter === "web" && (
              <a
                href="/web-shield-demo/"
                target="_blank"
                rel="noreferrer"
                className="block text-small text-fg-3 transition-colors duration-150 hover:text-fg"
              >
                Open the plain HTML form it protects →
              </a>
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-12">
          <div
            data-world-focus
            data-world-drag
            className="relative h-stage-sm rounded-lg border border-line md:h-stage"
            role="img"
            aria-label={`Globe zoomed to India showing ${sectorSites.length} ${sector} systems; ${protectedCount} protected by Q-Setu.`}
          />
          <div className="-mt-8 flex justify-between gap-4">
            <Label as="p">
              <span aria-live="polite">
                {protectedCount} / {sectorSites.length} {sector} systems sealed
              </span>
            </Label>
            <Label as="p">Natural Earth · drag to rotate</Label>
          </div>

          {error && <Text size="small">Deploy failed: {error}</Text>}

          {result && (
            <div className="space-y-6 border-t border-line pt-8" aria-live="polite">
              <Heading as="h2" variant="h3">
                {result.headline}
              </Heading>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label as="p">Without Q-Setu, a recorder captures</Label>
                  <Code code={result.plainView} copy={false} wrap>
                    {result.plainView}
                  </Code>
                </div>
                <div className="space-y-2">
                  <Label as="p">With Q-Setu, it captures</Label>
                  <Code code={result.sealedView} copy={false} wrap>
                    <span className="text-fg-2">{result.sealedView}</span>
                  </Code>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-x-12 gap-y-2 md:grid-cols-2">
                {result.details.map((d) => (
                  <div key={d.k} className="flex justify-between gap-4 border-b border-line pb-2">
                    <dt className="text-small text-fg-3">{d.k}</dt>
                    <dd className="tabular text-right font-mono text-small text-fg">{d.v}</dd>
                  </div>
                ))}
              </dl>
              {result.vaultId && (
                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={tamperVault}>Tamper with the stored record</Button>
                  {tamper && <Text size="small">✕ {tamper}</Text>}
                </div>
              )}
            </div>
          )}

          {sector === "education" && <CertificateFlow />}
        </section>
      </div>
    </DemoShell>
  );
}
