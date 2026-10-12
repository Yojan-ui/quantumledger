"use client";

import { SECTORS, type HarvestRecord } from "@qsetu/sim";
import { breakInWorker } from "@/lib/client/qday-crypto";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ScrambleText } from "@/components/demo/ScrambleText";
import { Label, RoleDot, Stat } from "@/components/ui";
import dynamic from "next/dynamic";
import { LazyView } from "@/components/scenes/LazyView";
import { Odometer } from "@/components/ui/Odometer";

const QDayShatter = dynamic(() => import("@/components/scenes/QDayShatter"), { ssr: false });

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
export default function HarvestQDay({ progress }: { progress: number }) {
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
        const broken = (await breakInWorker(cls)).outcomes.find((o) => o.plaintext);
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

  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(
      window.innerWidth < 768 || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);
  const firstPlain = rows?.find((r) => r.mode === "classical" && r.plain)?.plain;
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
      <div>
        <LazyView
          className="h-32 w-full"
          label="Two recorded packets. At Q-Day the classical one shatters; the Q-Setu one stays whole."
        >
          {(on) => <QDayShatter qday={qday} still={still} active={on} />}
        </LazyView>
        <div className="grid grid-cols-2 gap-6 font-mono text-label uppercase text-fg-3">
          <div className="space-y-1 text-center">
            <RoleDot role="warn" label="Classical packet" />
            <p
              className={`truncate normal-case text-fg transition-opacity duration-700 ${qday && firstPlain ? "opacity-100" : "opacity-0"}`}
            >
              {firstPlain ?? " "}
            </p>
          </div>
          <div className="space-y-1 text-center">
            <RoleDot role="kem" label="Q-Setu packet" />
            <p
              className={`normal-case transition-opacity duration-700 ${qday ? "opacity-100" : "opacity-0"}`}
            >
              still sealed
            </p>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-line border-y border-line" aria-label="Recorded packets">
        {(rows ?? []).slice(0, 4).map((r) => (
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
