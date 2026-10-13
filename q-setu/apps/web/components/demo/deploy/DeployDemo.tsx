"use client";

import type { SectorId } from "@qsetu/sim";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { SectorSwitcher } from "@/components/demo/shell/SectorSwitcher";
import { DirectorHUD } from "@/components/director/HUD";
import type { Shot, Step } from "@/components/director/types";
import { useDirector } from "@/components/director/useDirector";
import { useFilm } from "@/components/director/useFilm";
import { easeToken } from "@/lib/ease";
import type { Pose } from "@/components/world/store";
import { Button, Code, Heading, Label, Text } from "@/components/ui";
import { ADAPTERS, ADAPTER_ORDER, SITES, type AdapterId } from "@/data/sites";
import { LiveConsole } from "@/components/live/LiveConsole";
import { Odometer } from "@/components/ui/Odometer";
import { errText } from "@/lib/client/api";
import { useMetrics } from "@/lib/client/live";
import type { OpEvent } from "@/lib/live/types";
import { BEFORE_AFTER, runAdapter, SNIPPETS, type RunResult } from "./adapters";
import { notify, world, type NodeState } from "@/components/world/store";
import { burst } from "@/lib/client/burst";

// The certificate scenario (QR encode + scan) sits below the film: its code loads on demand.
const CertificateFlow = dynamic(() => import("./CertificateFlow").then((m) => m.CertificateFlow), {
  ssr: false,
  loading: () => null,
});

/** Adapter work on the server, deployed-node traffic, and anything this tab did. */
const consoleFilter = (e: OpEvent) =>
  !!e.site || ["web", "shield", "sdk", "vault", "certs", "edge", "browser"].includes(e.source);

const STEP_BAR: Step[] = [
  { label: "Survey", role: "warn" },
  { label: "Target", role: "warn" },
  { label: "Integrate", role: "kem" },
  { label: "Quantum-safe", role: "ok" },
];

/** Shot poses on the site's globe (lat/lon to face the camera; dist as a multiple of the fit size). */
interface GlobeShot extends Shot {
  pose: Pose;
  extrude: number;
  zoom: boolean;
}

function shotsFor(site: (typeof SITES)[number], sector: string): GlobeShot[] {
  const cam = {
    position: [0, 0, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  };
  return [
    {
      id: "orbit",
      camera: cam,
      step: 0,
      pose: { dist: 3.1, lat: 16, lon: 74, spin: 0.04 },
      extrude: 0,
      zoom: false,
      caption: "This traffic can be recorded today and decrypted after Q-Day.",
      simple: "Everything crossing these lines can be copied today, opened later.",
    },
    {
      id: "descend",
      camera: cam,
      step: 0,
      pose: { dist: 1.55, lat: 21, lon: 80, spin: 0 },
      extrude: 1,
      zoom: false,
      caption: `Each saffron node is a ${sector} system sending harvestable data.`,
      simple: `Each orange dot is a ${sector} system with old locks.`,
    },
    {
      id: "target",
      camera: cam,
      step: 1,
      // The dive: down low over the node, looking across at its building.
      pose: { dist: 1.12, lat: site.lat + 1.5, lon: site.lon, spin: 0, tilt: 52, yaw: 18 },
      extrude: 1,
      zoom: true,
      caption: `${site.label}'s data still crosses the network under classical keys.`,
      simple: `${site.label}'s data still travels under old-style locks.`,
    },
    {
      id: "integrate",
      camera: cam,
      step: 2,
      pose: { dist: 1.04, lat: site.lat + 0.8, lon: site.lon + 0.6, spin: 0, tilt: 66, yaw: 30 },
      extrude: 1,
      zoom: true,
      caption: "One adapter, and this system's traffic is sealed with ML-KEM.",
      simple: "One line of setup, and this system gets quantum-safe locks.",
    },
    {
      id: "all",
      camera: cam,
      step: 3,
      // Pull right back while the seal spreads across the sector.
      pose: { dist: 2.7, lat: 20, lon: 80, spin: 0, tilt: 0, yaw: 0 },
      extrude: 0.5,
      zoom: false,
      caption: `Every ${sector} system now seals its traffic with ML-KEM.`,
      simple: `Every ${sector} system now uses quantum-safe locks.`,
    },
  ];
}

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
      // Done: a short burst from the deployed node (its label's anchor on screen).
      const at = world.focusScreen;
      if (at) burst(at);
    } catch (e) {
      setError((e as Error).message);
      setStates((s) => ({ ...s, [site.id]: "vulnerable" }));
    } finally {
      setRunning(false);
    }
  }

  const statesRef = useRef(states);
  statesRef.current = states;
  /** "Deploy all": the sector's remaining nodes, west → east, each a real adapter run. */
  async function deployAll() {
    const order = [...sectorSites].sort((a, b) => a.lon - b.lon);
    for (const s of order) if (statesRef.current[s.id] !== "protected") await deploy(s.adapter);
    world.waveAt = performance.now();
  }

  function reset() {
    setStates({});
    setResult(undefined);
    setReading(undefined);
    world.waveAt = 0;
    reel.stop();
    director.replay();
  }

  // ── Staging: shots on the site's globe. The camera pose is tweened with the motion easing on an
  // arc (it lifts away from the surface mid-flight), and each shot waits for its real deploys. ──
  const site = sectorSites.find((s) => s.adapter === adapter)!;
  const shots = useMemo(() => shotsFor(site, sector), [site, sector]);
  const director = useDirector(shots);
  const reel = useFilm(director, {
    last: shots.length - 1,
    need: async (i) => {
      const id = shots[i]!.id;
      if (id === "integrate" && statesRef.current[site.id] !== "protected") await deploy(adapter);
      if (id === "all") await deployAll();
    },
    hold: (id) => (id === "integrate" ? 2600 : id === "target" ? 1800 : undefined),
    restart: () => reset(),
  });
  const shot = director.state.shot as GlobeShot;
  const pose = useRef<Pose>({ ...shots[0]!.pose });
  useEffect(() => {
    const to = shot.pose;
    world.shot = {
      pose: { ...pose.current },
      extrude: shot.extrude,
      focus: shot.zoom ? site.id : null,
      model: shot.zoom,
    };
    const from = { ...pose.current };
    const travel =
      Math.hypot(to.lat - from.lat, to.lon - from.lon) / 20 +
      Math.abs(to.dist - from.dist) +
      Math.abs((to.tilt ?? 0) - (from.tilt ?? 0)) / 90;
    const done = () => {
      pose.current = { ...to };
      world.shot!.pose = { ...to };
      reel.onSettled();
    };
    if (director.state.reduce || travel < 1e-3) return done();
    const p = { t: 0 };
    // Created inside a gsap.context, killed (not reverted: that would snap the camera back) on unmount.
    let ctx: { kill: () => void } | undefined;
    let cancelled = false;
    // GSAP loads with the first camera move, not with the page.
    void import("gsap").then(({ default: gsap }) => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        gsap.to(p, {
          t: 1,
          // Slower into and out of the node (the dive and the pull-back are the hero moment).
          duration: Math.min(
            1.8,
            Math.max(0.7, 0.7 + travel * 0.3 + Math.abs((to.tilt ?? 0) - (from.tilt ?? 0)) / 60),
          ),
          ease: easeToken,
          onUpdate: () => {
            const t = p.t;
            pose.current = {
              lat: from.lat + (to.lat - from.lat) * t,
              lon: from.lon + (to.lon - from.lon) * t,
              // The arc: lift away from the surface mid-flight, proportional to the distance travelled.
              dist:
                from.dist +
                (to.dist - from.dist) * t +
                Math.min(0.6, travel * 0.35) * Math.sin(Math.PI * t),
              spin: to.spin,
              tilt: (from.tilt ?? 0) + ((to.tilt ?? 0) - (from.tilt ?? 0)) * t,
              yaw: (from.yaw ?? 0) + ((to.yaw ?? 0) - (from.yaw ?? 0)) * t,
            };
            world.shot!.pose = pose.current;
          },
          onComplete: done,
        });
      });
    });
    return () => {
      cancelled = true;
      ctx?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director.state.index, director.state.take, shot]);
  useEffect(
    () => () => {
      world.shot = null;
      world.waveAt = 0;
    },
    [],
  );
  // Presenter mode starts the film by itself.
  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-present")) return;
    const t = setTimeout(() => void reel.play(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      caption="Pick a system and deploy its QuantumLedger adapter for real. Grey nodes are harvestable today; sealed nodes turn cyan."
      controls={
        <Button onClick={() => reel.to(shots.length - 1)} disabled={running || reel.busy}>
          Deploy all
        </Button>
      }
      meter={<ComputeMeter reading={reading} profile={adapter === "edge" ? "edge" : "standard"} />}
      console={<LiveConsole drawer title="Live console · deployed nodes" filter={consoleFilter} />}
      onAutoplay={() => void reel.play()}
      tryIt={{
        hint: "Deploy one adapter, then all of them: watch each system's traffic switch to ML-KEM",
        disabled: running || reel.busy || reel.playing,
        run: () => reel.play(),
      }}
    >
      <div className="grid grid-cols-1 gap-12">
        <aside className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <SectorSwitcher
            value={sector}
            onChange={(s) => (setSector(s), setResult(undefined))}
            disabled={running || reel.busy}
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
              onClick={() => reel.to(3)}
              disabled={running || reel.busy}
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

        <section className="order-first min-w-0 space-y-12">
          <div className="full-bleed relative border-y border-line">
            <div
              data-world-focus
              data-world-drag
              className="h-stage-full min-h-stage"
              role="img"
              aria-label={`Globe zoomed to India showing ${sectorSites.length} ${sector} systems; ${protectedCount} protected by QuantumLedger.`}
            />
            <p
              aria-hidden
              className={`pointer-events-none absolute left-4 top-4 font-mono text-h3 tabular transition-opacity duration-300 md:left-6 md:top-6 ${shot.id === "all" && director.state.settled ? "opacity-100" : "opacity-0"}`}
            >
              <span className={protectedCount === sectorSites.length ? "text-ok" : "text-fg"}>
                {protectedCount} / {sectorSites.length}
              </span>{" "}
              <span className="text-small text-fg-2">systems quantum-safe</span>
            </p>
            <NodeLabel
              show={director.state.settled && shot.zoom}
              title={`${site.label} · ${site.city}`}
              role={states[site.id] === "protected" ? "ok" : "warn"}
              value={
                states[site.id] === "protected"
                  ? `${ADAPTERS[adapter].product} · ML-KEM sealed ✓`
                  : states[site.id] === "deploying"
                    ? `deploying ${ADAPTERS[adapter].product}…`
                    : "classical TLS · harvestable"
              }
              code={shot.id === "integrate" ? snippet.code : undefined}
            />
            <DirectorHUD
              director={director}
              steps={STEP_BAR}
              playing={reel.playing}
              busy={reel.busy}
              onToggle={() => void reel.play()}
              onNext={() => void reel.next()}
              onPrev={reel.prev}
              onReplay={reset}
            />
          </div>
          <div className="flex justify-between gap-4">
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
                  <Label as="p">Without QuantumLedger, a recorder captures</Label>
                  <Code code={result.plainView} copy={false} wrap>
                    {result.plainView}
                  </Code>
                </div>
                <div className="space-y-2">
                  <Label as="p">With QuantumLedger, it captures</Label>
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

const TEXT = { ok: "text-ok", warn: "text-warn" } as const;

/**
 * The focused node's anchored label (and, while integrating, the adapter snippet typing itself in),
 * pinned to the node's screen position by a 1px leader line. Follows the node every frame.
 */
function NodeLabel({
  show,
  title,
  value,
  role,
  code,
}: {
  show: boolean;
  title: string;
  value: string;
  role: "ok" | "warn";
  code?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = world.focusScreen;
      const d = el.current;
      if (d) {
        d.style.visibility = s ? "visible" : "hidden";
        if (s) d.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  // The snippet types in once the camera has settled (about 1.2 s, whatever its length).
  useEffect(() => {
    setTyped(0);
    if (!code || !show) return;
    const per = Math.max(6, 1200 / code.length);
    const t = setInterval(() => setTyped((n) => (n >= code.length ? n : n + 1)), per);
    return () => clearInterval(t);
  }, [code, show]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  // Portalled to <body>: a transformed ancestor would otherwise re-anchor `position: fixed`.
  return createPortal(
    <div
      ref={el}
      aria-hidden
      className={`pointer-events-none fixed left-0 top-0 z-20 flex flex-col items-center transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
    >
      <div className="max-w-label rounded-sm border border-line bg-base px-3 py-2 font-mono text-label">
        <span className={`block uppercase ${TEXT[role]}`}>{title}</span>
        <span className="block text-fg">{value}</span>
        {code && (
          <pre className="mt-2 whitespace-pre-wrap break-all border-t border-line pt-2 text-fg-2">
            {code.slice(0, typed)}
            <span className="text-kem">{typed < code.length ? "▍" : ""}</span>
          </pre>
        )}
      </div>
      <span className="block h-6 w-px bg-line-strong" />
    </div>,
    host,
  );
}
