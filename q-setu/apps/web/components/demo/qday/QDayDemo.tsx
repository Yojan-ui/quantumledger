"use client";

import {
  SECTORS,
  type HarvestRecord,
  type NetEvent,
  type QDayOutcome,
  type SectorId,
} from "@qsetu/sim";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrambleText } from "@/components/demo/ScrambleText";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { SectorSwitcher } from "@/components/demo/shell/SectorSwitcher";
import { DirectorHUD } from "@/components/director/HUD";
import type { Shot, Step } from "@/components/director/types";
import { useDirector } from "@/components/director/useDirector";
import { useFilm } from "@/components/director/useFilm";
import { LazyView } from "@/components/scenes/LazyView";
import { Button, Code, Heading, Label, Stat, Text } from "@/components/ui";
import { LiveConsole } from "@/components/live/LiveConsole";
import { Odometer } from "@/components/ui/Odometer";
import { breakInWorker } from "@/lib/client/qday-crypto";
import { pushLocal } from "@/lib/client/live";
import { ms } from "@/lib/format";
import type { OpEvent } from "@/lib/live/types";

/** The simulator's real hops on the server, and the Q-Day attack running in this tab. */
const consoleFilter = (e: OpEvent) => e.source === "sim" || e.source === "browser";

const QDayFilm = dynamic(() => import("./QDayFilm"), { ssr: false, loading: () => null });

const START = 2026;
const END = 2035;
/** Illustrative. Nobody knows the real date of a cryptographically relevant quantum computer. */
const Q_DAY = 2033;
const ROWS = 7;

const STEP_BAR: Step[] = [
  { label: "Record", role: "warn" },
  { label: "Wait", role: "warn" },
  { label: "Q-Day", role: "danger" },
  { label: "Aftermath", role: "kem" },
];

const SHOTS: Shot[] = [
  {
    id: "split",
    camera: { position: [0, 0.7, 8], target: [0, -0.3, -0.6], fov: 40 },
    step: 0,
    caption: "An adversary records both systems' encrypted traffic, today.",
    simple: "An attacker copies both systems' locked messages, today.",
  },
  {
    id: "timelapse",
    camera: { position: [-2.2, 1.6, 8.6], target: [0, 0, -1], fov: 40 },
    focus: "orb",
    step: 1,
    caption: "Years pass; the recordings are kept, unreadable for now.",
    simple: "Years pass. The copies wait, still locked.",
  },
  {
    id: "climax",
    camera: { position: [0, 0.4, 5.6], target: [0, -0.15, -0.4], fov: 40 },
    step: 2,
    caption: "Q-Day: classical keys fall, and the recorded data opens.",
    simple: "Q-Day: the old locks break, and the copies open.",
  },
  {
    id: "aftermath",
    camera: { position: [0, 1.4, 8.4], target: [0, -0.35, -0.4], fov: 40 },
    step: 3,
    caption: "Classical records are exposed; QuantumLedger records stay sealed.",
    simple: "Old-lock records are exposed. QuantumLedger records stay locked.",
  },
];

/** The console lines behind each shot. */
const HIGHLIGHT: Record<string, (e: OpEvent) => boolean> = {
  split: (e) => e.source === "sim",
  timelapse: (e) => e.source === "sim",
  climax: (e) => e.source === "browser" && e.op === "OPEN",
  aftermath: (e) => e.source === "browser" && e.op === "REJECT",
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row {
  recordId: string;
  classical?: HarvestRecord;
  qsetu?: HarvestRecord;
}

export function QDayDemo() {
  const [sector, setSector] = useState<SectorId>("fintech");
  const [year, setYear] = useState(START);
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [harvest, setHarvest] = useState({ classical: 0, qsetu: 0 });
  const [broken, setBroken] = useState<Map<string, QDayOutcome>>(new Map());
  const [qsetuOutcomes, setQsetuOutcomes] = useState<QDayOutcome[]>();
  const [reading, setReading] = useState<MeterReading>();
  const [attacking, setAttacking] = useState(false);
  const qday = year >= Q_DAY;

  const refresh = useCallback(async (s: SectorId) => {
    const { records } = (await (await fetch(`/api/harvest?sector=${s}`)).json()) as {
      records: HarvestRecord[];
    };
    setRecords(records);
  }, []);

  // Live traffic while we're "before Q-Day": the adversary keeps recording.
  useEffect(() => {
    let live = true;
    const es = new EventSource(`/api/stream?sector=${sector}`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as NetEvent;
      if (e.stage === "sent") setHarvest((h) => ({ ...h, [e.mode]: h[e.mode] + 1 }));
      if (e.stage === "delivered" && live) void refresh(sector);
    };
    void (async () => {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sector }),
      });
      await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sector, count: 4, paceMs: 0, wait: true }),
      });
      if (live) await refresh(sector);
    })();
    return () => {
      live = false;
      es.close();
    };
  }, [sector, refresh]);

  useEffect(() => {
    if (qday) return;
    const t = setInterval(() => {
      void fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sector, count: 1, paceMs: 500 }),
      });
    }, 3500);
    return () => clearInterval(t);
  }, [sector, qday]);

  // Q-Day: the browser really factors every recorded RSA modulus; the server attacks QuantumLedger traffic.
  useEffect(() => {
    if (!qday || qsetuOutcomes || attacking) return;
    setAttacking(true);
    void (async () => {
      const { records: all } = (await (await fetch(`/api/harvest?sector=${sector}`)).json()) as {
        records: HarvestRecord[];
      };
      setRecords(all);
      const { outcomes, ms: breakMs } = await breakInWorker(all);
      // Reveal one row at a time so the scramble reads as a cascade.
      for (const o of outcomes) {
        setBroken((m) => new Map(m).set(o.harvestId, o));
        pushLocal({
          op: "OPEN",
          alg: "rsa-40 (factored)",
          ms: o.ms,
          ok: o.status !== "decrypted",
          detail:
            o.status === "decrypted"
              ? `EXPOSED · ${o.recordId} decrypted by the attacker`
              : `${o.recordId} not recovered`,
        });
        await new Promise((r) => setTimeout(r, 70));
      }
      const q = (await (
        await fetch("/api/qday", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sector }),
        })
      ).json()) as { qsetu: QDayOutcome[] };
      setQsetuOutcomes(q.qsetu);
      for (const o of q.qsetu)
        pushLocal({
          op: "REJECT",
          alg: "ml-kem-768+x25519",
          ms: o.ms,
          ok: o.status !== "decrypted",
          detail:
            o.status === "decrypted"
              ? `${o.recordId} decrypted`
              : `${o.recordId}: attack failed, AES-GCM tag mismatch`,
        });
      setReading({
        label: "Q-Day attack, run live in this browser",
        cpuMs: breakMs,
        cpuLabel: "Breaking all classical records",
        perRequestMs: breakMs / Math.max(1, outcomes.length),
        perRequestHint: "per record, once the key is factored",
        extra: [
          {
            label: "Records exposed",
            value: `${outcomes.filter((o) => o.status === "decrypted").length} vs ${q.qsetu.filter((o) => o.status === "decrypted").length}`,
          },
        ],
      });
      setAttacking(false);
    })();
  }, [qday, qsetuOutcomes, attacking, sector]);

  const rows = useMemo<Row[]>(() => {
    const m = new Map<string, Row>();
    for (const r of records.filter((x) => x.hop === "ab"))
      m.set(r.recordId, { ...m.get(r.recordId), recordId: r.recordId, [r.mode]: r });
    return [...m.values()]
      .filter((r) => r.classical && r.qsetu)
      .slice(-ROWS)
      .reverse();
  }, [records]);

  const exposed = [...broken.values()].filter((o) => o.status === "decrypted").length;
  const qExposed = qsetuOutcomes?.filter((o) => o.status === "decrypted").length ?? 0;
  const firstClassical = [...broken.values()][0];
  const firstQsetu = qsetuOutcomes?.[0];

  function reset() {
    take.current++;
    setYear(START);
    setBroken(new Map());
    setQsetuOutcomes(undefined);
    setReading(undefined);
    setBreakAt(0);
    reel.stop();
    director.replay();
  }

  // ── Staging. The time-lapse rolls the real timeline; the climax waits for the real attack. ──
  const [breakAt, setBreakAt] = useState(0);
  const take = useRef(0);
  const yearRef = useRef(year);
  yearRef.current = year;
  const attacked = useRef(false);
  attacked.current = !!qsetuOutcomes;
  const director = useDirector(SHOTS);
  const reel = useFilm(director, {
    last: SHOTS.length - 1,
    need: async (i) => {
      const id = SHOTS[i]!.id;
      const mine = take.current;
      if (id === "timelapse")
        for (let y = yearRef.current + 1; y < Q_DAY && take.current === mine; y++) {
          setYear(y);
          await wait(420);
        }
      if (id === "climax") {
        setYear((y) => Math.max(y, Q_DAY));
        // Hold the climax until the browser has really broken the classical records.
        for (let k = 0; k < 300 && !attacked.current && take.current === mine; k++) await wait(100);
      }
    },
    hold: (id) => (id === "climax" ? 2600 : undefined),
    // Dolly in, a 300 ms beat, then the shock wave.
    onArrive: (id) => id === "climax" && setBreakAt(performance.now() + 300),
    restart: () => reset(),
  });
  // Dragging the timeline past Q-Day cuts to the climax too.
  useEffect(() => {
    if (qday && director.state.index < 2) void reel.to(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qday]);
  const [small, setSmall] = useState(false);
  useEffect(() => setSmall(window.matchMedia("(max-width: 767px)").matches), []);
  // Presenter mode starts the film by itself.
  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-present")) return;
    const t = setTimeout(() => void reel.play(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const leaks = useMemo(
    () =>
      [...broken.values()]
        .filter((o) => o.status === "decrypted" && o.plaintext)
        .slice(0, 3)
        .map((o) => SECTORS[sector].reveal(o.plaintext!).headline),
    [broken, sector],
  );

  const switchSector = (s: SectorId) => {
    reset();
    setHarvest({ classical: 0, qsetu: 0 });
    setRecords([]);
    setSector(s);
  };

  return (
    <DemoShell
      title="Demo 3 · Q-Day Time Machine"
      caption="An adversary records both systems' traffic today. Move the timeline to Q-Day: classical records open, QuantumLedger records stay sealed."
      controls={
        <Button
          variant="primary"
          onClick={() => void (reel.playing ? undefined : reel.play())}
          disabled={reel.busy || qday}
        >
          Go to Q-Day
        </Button>
      }
      meter={<ComputeMeter reading={reading} />}
      console={
        <LiveConsole
          title="Live console · recording and attack"
          filter={consoleFilter}
          highlight={HIGHLIGHT[director.state.shot.id]}
        />
      }
      onAutoplay={() => void reel.play()}
    >
      <div className="relative mb-12 overflow-hidden rounded-lg border border-line">
        <LazyView
          className="h-stage-sm md:h-stage"
          label={`Two corridors of recorded packets, classical and QuantumLedger, watched by an adversary. Year ${year}. ${qday ? "Q-Day: classical packets break open; QuantumLedger packets stay whole." : "Recording traffic."}`}
        >
          {(onScreen) => (
            <QDayFilm
              state={director.state}
              onSettled={reel.onSettled}
              active={onScreen}
              progress={Math.min(1, (year - START) / (Q_DAY - START))}
              recorded={harvest.classical}
              breakAt={qday ? breakAt : 0}
              leaks={leaks}
              exposed={exposed}
              qExposed={qsetuOutcomes ? qExposed : undefined}
              small={small}
            />
          )}
        </LazyView>
        <div className="pointer-events-none absolute left-4 top-4 md:left-6 md:top-6" aria-hidden>
          <span
            className={`tabular block font-mono text-h2 transition-colors duration-300 ${qday ? "text-warn" : "text-fg"}`}
          >
            <Odometer value={String(year)} />
          </span>
          <Label>{qday ? "Q-Day (illustrative)" : "Recording"}</Label>
        </div>
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

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <SectorSwitcher value={sector} onChange={switchSector} disabled={reel.busy || attacking} />
        <Label as="p">
          <span aria-live="polite">
            Recorded so far: {harvest.classical} classical · {harvest.qsetu} QuantumLedger packets
          </span>
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Column title="Classical" sub="RSA (tiny stand-in) + ECDSA" exposed={exposed} tone="warn">
          {rows.map((r) => {
            const o = r.classical && broken.get(r.classical.id);
            const open = o?.status === "decrypted" && !!o.plaintext;
            const text = open
              ? SECTORS[sector].reveal(o!.plaintext!).headline
              : r.classical!.preview.slice(0, 48);
            return (
              <li key={r.recordId} className="flex items-center gap-3 border-t border-line py-2">
                <span
                  className={`text-small ${open ? "text-warn" : "text-fg-3"}`}
                  aria-label={open ? "Decrypted" : "Encrypted"}
                >
                  ●
                </span>
                <ScrambleText
                  text={text}
                  className={`min-w-0 truncate font-mono text-small ${open ? "text-fg" : "text-fg-3"}`}
                />
              </li>
            );
          })}
        </Column>

        <div className="self-start rounded-lg border border-line lg:col-span-4">
          <div className="p-4">
            <label htmlFor="year" className="font-mono text-label uppercase text-fg-3">
              Timeline
            </label>
            <input
              id="year"
              type="range"
              min={START}
              max={END}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-2 w-full accent-fg"
              aria-valuetext={`${year}${qday ? ", Q-Day reached" : ""}`}
            />
            <div className="relative h-4 font-mono text-label text-fg-3">
              <span className="absolute left-0">{START}</span>
              <span className="absolute right-0">{END}</span>
            </div>
            {/* The Q-Day marker sits on its own row, so it never collides with the end year. */}
            <div className="relative mt-1 h-4 font-mono text-label text-fg-3">
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${((Q_DAY - START) / (END - START)) * 100}%` }}
              >
                ↑ Q-DAY
              </span>
            </div>
          </div>
        </div>

        <Column
          title="QuantumLedger"
          sub="X25519 + ML-KEM-768 · ML-DSA-65"
          exposed={qExposed}
          tone="accent"
        >
          {rows.map((r) => (
            <li key={r.recordId} className="flex items-center gap-3 border-t border-line py-2">
              <span
                className={`text-small ${qday ? "text-accent" : "text-fg-3"}`}
                aria-label="Sealed"
              >
                ●
              </span>
              <span className="min-w-0 truncate font-mono text-small text-fg-3">
                {r.qsetu!.preview.slice(0, 48)}
              </span>
            </li>
          ))}
        </Column>
      </div>

      {qday && (
        <div className="mt-12 grid animate-reveal grid-cols-1 gap-12 border-t border-line pt-12 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-4">
            <Stat
              value={attacking && !qsetuOutcomes ? "…" : exposed}
              label={`${SECTORS[sector].noun}s exposed · classical`}
            />
            <Stat value={qsetuOutcomes ? qExposed : "…"} label="Exposed · QuantumLedger" />
          </div>
          <AttackLog
            title="Classical attack log"
            lines={firstClassical?.log}
            ms={firstClassical?.ms}
          />
          <AttackLog title="QuantumLedger attack log" lines={firstQsetu?.log} ms={firstQsetu?.ms} />
        </div>
      )}

      <details className="mt-12 border-t border-line pt-6">
        <summary className="cursor-pointer text-small text-fg">How this simulation works</summary>
        <div className="mt-4 max-w-text space-y-3">
          <Text size="small">
            Classical side: no quantum computer can break RSA-2048 today. To show what Q-Day means,
            the classical system uses a deliberately tiny ~40-bit RSA key (isolated in{" "}
            <span className="font-mono">sim/classical/</span>, labelled INSECURE_DEMO_ONLY). Your
            browser really factors it with Pollard’s rho, standing in for Shor’s algorithm. The
            AES-256 payload encryption is real.
          </Text>
          <Text size="small">
            QuantumLedger side: real X25519 + ML-KEM-768 and ML-DSA-65. The attacker even gets a
            simulated Shor oracle that reveals the X25519 secrets, then runs the real key schedule
            with its best guess for the ML-KEM share. The AES-GCM tag check fails.
          </Text>
          <Text size="small">
            The Q-Day year is illustrative. Nobody knows when a cryptographically relevant quantum
            computer will exist.
          </Text>
        </div>
      </details>
    </DemoShell>
  );
}

function Column({
  title,
  sub,
  exposed,
  tone,
  children,
}: {
  title: string;
  sub: string;
  /** Records the attacker has read so far; rolls up as the cascade runs. */
  exposed: number;
  tone: "warn" | "accent";
  children: React.ReactNode;
}) {
  return (
    <section className="lg:col-span-4" aria-label={`${title} system`}>
      <header className="mb-3 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <Heading as="h2" variant="h3">
            {title}
          </Heading>
          <span
            className={`font-mono text-small ${exposed > 0 && tone === "warn" ? "text-warn" : "text-fg-2"}`}
          >
            <Odometer value={String(exposed)} /> exposed
          </span>
        </div>
        <Label as="p" className="truncate">
          {sub}
        </Label>
      </header>
      <ul className="min-h-panel border-b border-line">{children}</ul>
    </section>
  );
}

function AttackLog({ title, lines, ms: t }: { title: string; lines?: string[]; ms?: number }) {
  return (
    <div className="space-y-3 lg:col-span-4">
      <Label as="p">
        {title}
        {t !== undefined && ` · ${ms(t)}`}
      </Label>
      <Code code={(lines ?? []).join("\n")} copy={false} wrap>
        <span className="text-fg-2">{lines ? lines.map((l) => `› ${l}`).join("\n") : "…"}</span>
      </Code>
    </div>
  );
}
