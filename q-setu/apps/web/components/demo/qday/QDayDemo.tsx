"use client";

import {
  breakClassical,
  SECTORS,
  type HarvestRecord,
  type NetEvent,
  type QDayOutcome,
  type SectorId,
} from "@qsetu/sim";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrambleText } from "@/components/demo/ScrambleText";
import { SceneView } from "@/components/world/SceneView";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { SectorSwitcher } from "@/components/demo/shell/SectorSwitcher";
import { StepControls } from "@/components/demo/shell/StepControls";
import { Code, Heading, Label, Stat, Text } from "@/components/ui";
import { LiveConsole } from "@/components/live/LiveConsole";
import { Odometer } from "@/components/ui/Odometer";
import { pushLocal } from "@/lib/client/live";
import { ms } from "@/lib/format";
import type { OpEvent } from "@/lib/live/types";

/** The simulator's real hops on the server, and the Q-Day attack running in this tab. */
const consoleFilter = (e: OpEvent) => e.source === "sim" || e.source === "browser";

const QDayScene = dynamic(() => import("./QDayScene"), { ssr: false, loading: () => null });

const START = 2026;
const END = 2035;
/** Illustrative. Nobody knows the real date of a cryptographically relevant quantum computer. */
const Q_DAY = 2033;
const ROWS = 7;

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
  const playing = useRef(false);
  const [isPlaying, setPlaying] = useState(false);
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

  // Q-Day: the browser really factors every recorded RSA modulus; the server attacks Q-Setu traffic.
  useEffect(() => {
    if (!qday || qsetuOutcomes || attacking) return;
    setAttacking(true);
    void (async () => {
      const { records: all } = (await (await fetch(`/api/harvest?sector=${sector}`)).json()) as {
        records: HarvestRecord[];
      };
      setRecords(all);
      const t = performance.now();
      const outcomes = breakClassical(all);
      const breakMs = performance.now() - t;
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
    playing.current = false;
    setPlaying(false);
    setYear(START);
    setBroken(new Map());
    setQsetuOutcomes(undefined);
    setReading(undefined);
  }

  async function play() {
    if (playing.current) {
      playing.current = false;
      setPlaying(false);
      return;
    }
    playing.current = true;
    setPlaying(true);
    for (let y = year + 1; y <= Q_DAY && playing.current; y++) {
      setYear(y);
      await new Promise((r) => setTimeout(r, 650));
    }
    playing.current = false;
    setPlaying(false);
  }

  const switchSector = (s: SectorId) => {
    reset();
    setHarvest({ classical: 0, qsetu: 0 });
    setRecords([]);
    setSector(s);
  };

  return (
    <DemoShell
      title="Demo 3 · Q-Day Time Machine"
      caption="An adversary records both systems' traffic today. Move the timeline to Q-Day: classical records open, Q-Setu records stay sealed."
      controls={
        <StepControls
          onStep={() => setYear((y) => Math.min(END, y + 1))}
          onPlay={play}
          onReset={reset}
          playing={isPlaying}
          done={year >= END}
          stepLabel="+1 year"
          playLabel="Go to Q-Day"
        />
      }
      meter={<ComputeMeter reading={reading} />}
      console={<LiveConsole title="Live console · recording and attack" filter={consoleFilter} />}
      onAutoplay={() => void play()}
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <SectorSwitcher value={sector} onChange={switchSector} disabled={isPlaying || attacking} />
        <Label as="p">
          <span aria-live="polite">
            Recorded so far: {harvest.classical} classical · {harvest.qsetu} Q-Setu packets
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

        <div className="overflow-hidden rounded-lg border border-line lg:col-span-4">
          <div
            className="relative h-stage-sm"
            role="img"
            aria-label={`Adversary recording packets. Year ${year}. ${qday ? "Q-Day: the adversary attacks everything it recorded." : "Recording traffic."}`}
          >
            <SceneView className="absolute inset-0">
              <QDayScene
                progress={(year - START) / (Q_DAY - START)}
                qday={qday}
                harvest={harvest}
              />
            </SceneView>
            <p className="pointer-events-none absolute left-4 top-4">
              <span className="tabular block text-h2 font-medium text-fg">{year}</span>
              {qday && <Label>Q-Day (illustrative)</Label>}
            </p>
          </div>
          <div className="border-t border-line p-4">
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
          title="Q-Setu"
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
            <Stat value={qsetuOutcomes ? qExposed : "…"} label="Exposed · Q-Setu" />
          </div>
          <AttackLog
            title="Classical attack log"
            lines={firstClassical?.log}
            ms={firstClassical?.ms}
          />
          <AttackLog title="Q-Setu attack log" lines={firstQsetu?.log} ms={firstQsetu?.ms} />
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
            Q-Setu side: real X25519 + ML-KEM-768 and ML-DSA-65. The attacker even gets a simulated
            Shor oracle that reveals the X25519 secrets, then runs the real key schedule with its
            best guess for the ML-KEM share. The AES-GCM tag check fails.
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
