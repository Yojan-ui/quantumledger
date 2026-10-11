"use client";

import { envelopeSize, seal, utf8ToBytes } from "@qsetu/core";
import { breakClassical, SECTORS, type HarvestRecord } from "@qsetu/sim";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ScrambleText } from "@/components/demo/ScrambleText";
import { Code, Container, Label, MiniStat, Stat, Text } from "@/components/ui";
import { CountUp } from "@/components/ui/CountUp";
import { Odometer } from "@/components/ui/Odometer";
import { buttonClass } from "@/components/ui/Button";
import { arcIndex, NODES } from "@/components/world/geo";
import { notify, subscribe, useWorld, world } from "@/components/world/store";
import { BENCH_NOTE } from "@/data/facts";
import { useBench } from "@/lib/client/useBench";
import { bytes, hexPreview, ms, us } from "@/lib/format";
import { ADAPTERS, SECTOR_NOTES } from "./chapters";
import { generateVisitorKeys, visitor } from "./visitor";

function useVisitor() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((x) => x + 1)), []);
  useEffect(() => void generateVisitorKeys(), []);
  return visitor.keys;
}

/** Hero: three live measurements in one row, separated by 1px dividers. They count up from 0. */
export function HeroStats() {
  const bench = useBench();
  const s = bench?.sessions.find((x) => x.profile === "standard");
  const items: [number | undefined, (n: number) => string, string][] = [
    [s?.handshakeMs, (n) => `${n.toFixed(1)} ms`, "PQC handshake, once per session"],
    [
      s && Math.max(0.1, s.perMessageUs - s.baselineMessageUs),
      (n) => `${n.toFixed(1)} µs`,
      "Added per message",
    ],
    [s?.messageOverheadBytes, (n) => `${Math.round(n)} B`, "Added bytes per message"],
  ];
  return (
    <div className="absolute inset-x-0 bottom-8 hidden md:block">
      <Container>
        <div className="flex items-stretch border-t border-line pt-6">
          {items.map(([v, f, l], i) => (
            <div key={l} className={`pr-8 ${i > 0 ? "border-l border-line pl-8" : ""}`}>
              <MiniStat value={v === undefined ? "…" : <CountUp to={v} format={f} />} label={l} />
            </div>
          ))}
          <p className="ml-auto self-end font-mono text-label text-fg-3">
            MEASURED LIVE ON THIS SERVER{" "}
            <a
              href={`#fact-${BENCH_NOTE}`}
              className="underline decoration-line-strong underline-offset-4"
            >
              [{BENCH_NOTE}]
            </a>
          </p>
        </div>
      </Container>
    </div>
  );
}

function SealIt() {
  const keys = useVisitor();
  const [text, setText] = useState("ravi@bharatbank pays ₹2,450");
  const [out, setOut] = useState<{ size: number; ms: number; hex: string }>();
  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!keys || !text.trim()) return;
    const t = performance.now();
    const env = seal(utf8ToBytes(text), keys.hybridPublicKey);
    setOut({ size: envelopeSize(env), ms: performance.now() - t, hex: hexPreview(env.ct, 12) });
    world.pulses.push({
      arc: arcIndex("mumbai", "hyderabad"),
      color: "cyan",
      size: 24,
      speed: 0.35,
    });
    notify();
  }
  return (
    <div className="max-w-text space-y-4">
      <form onSubmit={go} className="flex gap-2">
        <label htmlFor="seal-input" className="sr-only">
          Text to seal
        </label>
        <input
          id="seal-input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 60))}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-inset px-3 font-mono text-small text-fg outline-none transition-colors duration-150 placeholder:text-fg-3 focus:border-line-strong"
        />
        <button type="submit" disabled={!keys} className={buttonClass("secondary")}>
          Seal
        </button>
      </form>
      <Code code={out ? out.hex : ""} copy={false}>
        {out ? (
          <>
            <span className="text-accent">sealed</span> {bytes(out.size)} in {ms(out.ms)} · ct{" "}
            {out.hex}
          </>
        ) : (
          <span className="text-fg-3">nothing sealed yet</span>
        )}
      </Code>
      <Label as="p">
        {keys
          ? `Your ML-KEM-768 key ${keys.kid} · generated here in ${ms(keys.timings.mlkem)}`
          : "Generating your key…"}
      </Label>
    </div>
  );
}

interface Row {
  id: string;
  mode: "classical" | "qsetu";
  cipher: string;
  plain?: string;
}

const QDAY_AT = 0.68;

/**
 * Chapters 3–4, scrubbed: recorded packets (real ones, from the eavesdropper's store) while a year
 * counter runs 2026 → 2035. At Q-Day the classical rows are broken for real, in this browser, and
 * scramble into readable text; the Q-Setu rows stay sealed.
 */
export function HarvestQDay({ progress }: { progress: number }) {
  const [rows, setRows] = useState<Row[]>();
  const [recorded, setRecorded] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      const all = await Promise.all(
        (["fintech", "healthcare", "education"] as const).map(async (s) => {
          let { records } = (await (await fetch(`/api/harvest?sector=${s}`)).json()) as {
            records: HarvestRecord[];
          };
          if (!records.some((r) => r.mode === "classical")) {
            await fetch("/api/simulate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sector: s, count: 1, paceMs: 0, wait: true }),
            });
            ({ records } = (await (await fetch(`/api/harvest?sector=${s}`)).json()) as {
              records: HarvestRecord[];
            });
          }
          return { s, records };
        }),
      );
      if (!live) return;
      setRecorded(all.reduce((n, x) => n + x.records.length, 0));
      const out: Row[] = [];
      for (const { s, records } of all) {
        const cls = records.filter((r) => r.mode === "classical").slice(-1);
        const broken = breakClassical(cls).find((o) => o.plaintext);
        const c = cls[0];
        if (c)
          out.push({
            id: c.id,
            mode: "classical",
            cipher: c.preview.slice(0, 40),
            plain: broken?.plaintext ? SECTORS[s].reveal(broken.plaintext).headline : undefined,
          });
        const q = records.filter((r) => r.mode === "qsetu").at(-1);
        if (q) out.push({ id: q.id, mode: "qsetu", cipher: q.preview.slice(0, 40) });
      }
      setRows(out);
    })().catch(() => setRows([]));
    return () => {
      live = false;
    };
  }, []);

  const year = 2026 + Math.round(Math.min(1, Math.max(0, progress / QDAY_AT)) * 9);
  const qday = progress >= QDAY_AT;
  return (
    <div className="max-w-text space-y-6">
      <div className="flex items-end gap-12">
        <Stat value={<Odometer value={String(year)} />} label={qday ? "Q-Day" : "Year"} />
        <Stat
          value={<Odometer value={recorded.toLocaleString("en-IN")} />}
          label="Packets recorded"
        />
      </div>
      <ul className="divide-y divide-line border-y border-line" aria-label="Recorded packets">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="grid grid-cols-12 gap-3 py-3">
            <Label as="p" className="col-span-4 pt-px">
              {r.mode === "classical" ? "Classical · RSA" : "Q-Setu · ML-KEM"}
            </Label>
            <p className="col-span-8 truncate font-mono text-small">
              {r.mode === "classical" && qday && r.plain ? (
                <ScrambleText text={r.plain} className="text-fg" />
              ) : (
                <span className="text-fg-3">{r.cipher}</span>
              )}
            </p>
          </li>
        ))}
        {!rows && (
          <li className="py-3 font-mono text-small text-fg-3">
            reading the eavesdropper’s recordings…
          </li>
        )}
      </ul>
      <Label as="p">
        {qday
          ? "Broken in this browser · 40-bit RSA stand-in · "
          : "Recorded today, decrypted at Q-Day · "}
        <Link
          href="/demo/qday"
          className="underline decoration-line-strong underline-offset-4 hover:text-fg"
        >
          Demo 3
        </Link>
      </Label>
    </div>
  );
}

function Sockets({ sub }: { sub: number }) {
  const i = Math.min(4, Math.floor(sub * 5));
  useEffect(() => {
    world.socket = i;
    return () => void (world.socket = -1);
  }, [i]);
  const a = ADAPTERS[i]!;
  return (
    <div className="max-w-text space-y-3">
      <Label as="p">
        {String(i + 1).padStart(2, "0")} / 05 — {a.name}
      </Label>
      <Code code={a.code}>{a.code}</Code>
    </div>
  );
}

function India() {
  const hover = useWorld((w) => w.hover?.id);
  const node = NODES.find((n) => n.id === hover);
  if (!node)
    return (
      <Label as="p">
        <span className="text-accent">●</span> Sealed with Q-Setu ·{" "}
        <span className="text-fg-2">●</span> Not yet
      </Label>
    );
  return (
    <div className="max-w-text space-y-1">
      <p className="text-h3 font-medium text-fg">
        {node.label} <span className="text-fg-3">· {node.city}</span>
      </p>
      <Text size="small">ML-KEM protects {SECTOR_NOTES[node.sector]!.kem}.</Text>
      <Text size="small">ML-DSA signs {SECTOR_NOTES[node.sector]!.dsa}.</Text>
    </div>
  );
}

function Cost() {
  const bench = useBench();
  const s = bench?.sessions.find((x) => x.profile === "standard");
  return (
    <Stat
      value={s ? <CountUp to={s.perMessageUs} format={us} /> : "…"}
      label={s ? `Per message, after one ${ms(s.handshakeMs)} handshake` : "Per message"}
      footnote={
        <a
          href={`#fact-${BENCH_NOTE}`}
          className="underline decoration-line-strong underline-offset-4"
        >
          [{BENCH_NOTE}]
        </a>
      }
    />
  );
}

export function ChapterBody({ index, sub }: { index: number; sub: number }) {
  if (index === 1) return <SealIt />;
  if (index === 4) return <Sockets sub={sub} />;
  if (index === 5) return <India />;
  if (index === 6) return <Cost />;
  return null;
}
