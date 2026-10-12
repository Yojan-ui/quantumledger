"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { DirectorHUD } from "@/components/director/HUD";
import type { Shot, Step } from "@/components/director/types";
import { useDirector } from "@/components/director/useDirector";
import { useFilm } from "@/components/director/useFilm";
import { LiveConsole } from "@/components/live/LiveConsole";
import { LazyView } from "@/components/scenes/LazyView";
import { Button, Code, Heading, Label, Text } from "@/components/ui";
import { Odometer } from "@/components/ui/Odometer";
import { hs } from "@/lib/client/handshake-crypto";
import { errText } from "@/lib/client/api";
import { onLive } from "@/lib/client/live";
import type { LedgerEntry, VerifyResult } from "@/lib/live/ledger";
import type { OpEvent } from "@/lib/live/types";

const LedgerFilm = dynamic(() => import("./LedgerFilm"), { ssr: false, loading: () => null });

const TARGET = 42;
/** Arc positions: six entries around #42 (it sits at index 3), then the six newest. */
const ARC = 6;

const STEP_BAR: Step[] = [
  { label: "Append", role: "sig" },
  { label: "Verify", role: "ok" },
  { label: "Tamper", role: "danger" },
  { label: "Detect", role: "danger" },
  { label: "Restore", role: "ok" },
];

const SHOTS: Shot[] = [
  {
    id: "chain",
    camera: { position: [3.4, 1.7, 2.6], target: [5.4, 0, -3], fov: 42 },
    step: 0,
    caption: "Each new entry is hashed and signed, chained to the last.",
    simple: "Each new entry is sealed and linked to the one before.",
  },
  {
    id: "verify",
    camera: { position: [0, 3.4, 8.6], target: [0, -0.2, -1.6], fov: 50 },
    step: 1,
    caption: "Verification re-hashes every entry; a signed checkpoint vouches for the signatures.",
    simple: "Checking re-reads every entry and every seal, sweeping the chain.",
  },
  {
    id: "tamper",
    camera: { position: [-2.5, 1.1, 2.6], target: [-3.45, 0, -0.9], fov: 40 },
    focus: "target",
    step: 2,
    caption: `An insider edits entry #${TARGET} directly in the database.`,
    simple: `Someone inside quietly changes entry #${TARGET} in the database.`,
  },
  {
    id: "broken",
    camera: { position: [-1.2, 2.1, 5], target: [-2.6, -0.1, -1], fov: 44 },
    step: 3,
    caption: `Verification stops at #${TARGET}: its hash no longer matches.`,
    simple: `The check stops at entry #${TARGET}: it was changed.`,
  },
  {
    id: "restore",
    camera: { position: [0, 3.4, 8.6], target: [0, -0.2, -1.6], fov: 50 },
    step: 4,
    caption: "The original row is restored; the whole chain verifies again.",
    simple: "The original is put back; every link checks out again.",
  },
];
const SHOT = Object.fromEntries(SHOTS.map((s, i) => [s.id, i]));
/** The "broken" caption says what verification really found, wherever it was. */
const FOUND: Record<string, string> = {
  "payload-modified": "its hash no longer matches",
  "chain-broken": "its link to the row before is broken",
  "bad-signature": "its ML-DSA signature fails",
  "unknown-key": "it is signed by an unknown key",
  "missing-entry": "a row is missing",
};

/** The console lines behind each shot. */
const HIGHLIGHT: Record<string, (e: OpEvent) => boolean> = {
  chain: (e) => e.op === "LEDGER",
  verify: (e) => e.source === "ledger" && e.op === "VERIFY",
  tamper: (e) => e.source === "ledger" && /tamper|edit/i.test(e.detail ?? ""),
  broken: (e) => e.source === "ledger" && (e.op === "VERIFY" || e.op === "REJECT"),
  restore: (e) => e.source === "ledger" && (e.op === "VERIFY" || /restor/i.test(e.detail ?? "")),
};
const consoleFilter = (e: OpEvent) =>
  e.source === "ledger" || e.source === "kms" || e.op === "POLICY";

const REASON: Record<string, string> = {
  "payload-modified": "Row edited after it was written: its SHA3-256 hash no longer matches",
  "chain-broken": "Row no longer links to the one before it",
  "bad-signature": "ML-DSA signature does not verify",
  "unknown-key": "Signed by a key the KMS never issued",
  "missing-entry": "A row was deleted",
};

async function call<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = (await r.json()) as T;
  if (!r.ok) throw new Error(errText(d));
  return d;
}

/**
 * Demo 4: the Proof Chain. Verify the whole chain, then edit entry #42 directly in SQLite (the way an
 * insider with database access would) and verify again: the chain breaks exactly there, and says why.
 */
export function LedgerDemo() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [count, setCount] = useState(0);
  const [tampered, setTampered] = useState<number[]>([]);
  const [verify, setVerify] = useState<VerifyResult>();
  const [edit, setEdit] = useState<{ field: string; before: unknown; after: unknown }>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState<MeterReading>();

  const load = useCallback(async () => {
    const d = await call<{ count: number; tampered: number[]; entries: LedgerEntry[] }>(
      `/api/ledger?around=${TARGET}&limit=9`,
    );
    setEntries(d.entries);
    setCount(d.count);
    setTampered(d.tampered);
  }, []);

  // The arc: six entries around #42 and the six newest (refreshed as live entries arrive).
  const [around, setAround] = useState<number[]>([]);
  const [newest, setNewest] = useState<number[]>([]);
  const [headAt, setHeadAt] = useState(0);
  const [merkle, setMerkle] = useState<{ levels: string[][]; root: string; at: number }>();
  const loadArc = useCallback(async () => {
    const [a, n] = await Promise.all([
      call<{ entries: LedgerEntry[] }>(`/api/ledger?around=${TARGET}&limit=${ARC}`),
      call<{ entries: LedgerEntry[] }>(`/api/ledger?limit=${ARC}`),
    ]);
    setAround(a.entries.map((e) => e.id));
    // A Merkle tree over the four newest entries' real hashes, computed in the worker.
    const four = n.entries
      .slice(0, 4)
      .reverse()
      .map((e) => e.hash);
    if (four.length === 4)
      void hs
        .merkle(four)
        .then((t) => setMerkle((m) => (m?.root === t.root ? m : { ...t, at: performance.now() })));
    setNewest((old) => {
      const ids = n.entries.map((e) => e.id).reverse();
      if (old.length && ids.at(-1) !== old.at(-1)) setHeadAt(performance.now());
      return ids;
    });
  }, []);

  useEffect(() => {
    void load();
    void loadArc();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onLive((e) => {
      if (e.op !== "LEDGER") return;
      setCount((n) => n + 1);
      clearTimeout(t);
      t = setTimeout(() => void loadArc(), 400);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, [load, loadArc]);

  const run = (name: string, fn: () => Promise<void>) => async () => {
    setBusy(name);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const doVerify = run("verify", async () => {
    const r = await call<VerifyResult>("/api/ledger/verify", {});
    setVerify(r);
    setReading({
      label: r.ok ? "Chain verified" : `Chain broken at #${r.broken!.id}`,
      cpuMs: r.ms,
      cpuLabel: `Verify ${r.checked} entries`,
      perRequestMs: r.ms / Math.max(1, r.checked),
      extra: [
        { label: "Per entry", value: `${((r.ms / Math.max(1, r.checked)) * 1000).toFixed(0)} µs` },
      ],
    });
  });
  const doTamper = run("tamper", async () => {
    const r = await call<{ tampered: { field: string; before: unknown; after: unknown } }>(
      "/api/ledger/tamper",
      {
        id: TARGET,
      },
    );
    setEdit(r.tampered);
    setVerify(undefined);
    await load();
  });
  const doRestore = run("restore", async () => {
    await call("/api/ledger/tamper", { id: TARGET, restore: true });
    setEdit(undefined);
    setVerify(undefined);
    await load();
  });

  const broken = verify?.broken;
  const isTampered = tampered.includes(TARGET);

  // ── Staging. Next / Play (and presenter →) walk verify → tamper → verify (break) → restore; the
  // header buttons do the same real actions, and the camera follows whatever just happened. ──
  const ids = useMemo(() => [...around, ...newest], [around, newest]);
  const [tamperedAt, setTamperedAt] = useState(0);
  const [restoredAt, setRestoredAt] = useState(0);
  const [verifyAt, setVerifyAt] = useState(0);
  const wasTampered = useRef(false);
  const restored = useRef(false);
  useEffect(() => {
    if (isTampered) {
      setTamperedAt(performance.now());
      setRestoredAt(0);
      restored.current = false;
    } else if (wasTampered.current) {
      setTamperedAt(0);
      setRestoredAt(performance.now());
      restored.current = true;
    }
    wasTampered.current = isTampered;
  }, [isTampered]);
  useEffect(() => setVerifyAt(verify ? performance.now() : 0), [verify]);
  const shots = useMemo(
    () =>
      SHOTS.map((s) =>
        s.id === "broken" && broken
          ? {
              ...s,
              caption: `Verification stops at #${broken.id}: ${FOUND[broken.reason] ?? "it fails"}.`,
              simple: `The check stops at entry #${broken.id}: it was changed.`,
            }
          : s,
      ),
    [broken],
  );
  const director = useDirector(shots);
  const reel = useFilm(director, {
    last: SHOTS.length - 1,
    need: async (i) => {
      const id = SHOTS[i]!.id;
      if (id === "verify" || id === "broken") await doVerify();
      if (id === "tamper" && !isTamperedRef.current) await doTamper();
      if (id === "restore") {
        if (isTamperedRef.current) await doRestore();
        await doVerify();
      }
    },
    hold: (id) => (id === "broken" ? 2600 : id === "verify" ? 2200 : undefined),
    restart: () => void reset(),
  });
  const isTamperedRef = useRef(isTampered);
  isTamperedRef.current = isTampered;
  // Buttons: the camera follows the real state.
  useEffect(() => {
    const to = broken
      ? SHOT.broken!
      : verify
        ? restored.current
          ? SHOT.restore!
          : SHOT.verify!
        : isTampered
          ? SHOT.tamper!
          : restored.current
            ? SHOT.restore!
            : director.state.index;
    if (to !== director.state.index) director.go(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verify, isTampered]);
  async function reset() {
    reel.stop();
    if (isTamperedRef.current) await doRestore();
    setVerify(undefined);
    setEdit(undefined);
    setRestoredAt(0);
    restored.current = false;
    director.replay();
  }
  return (
    <DemoShell
      title="Demo 4 · Proof Chain"
      caption="An append-only audit log: each entry is hash-chained with SHA3-256 and signed with ML-DSA-65. Edit one row in the database and see verification pinpoint it."
      controls={
        <>
          <Button onClick={doTamper} disabled={!!busy || isTampered}>
            {busy === "tamper" ? "Editing…" : `Tamper with entry #${TARGET}`}
          </Button>
          <Button onClick={doRestore} disabled={!!busy || !isTampered}>
            Restore
          </Button>
          <Button variant="primary" onClick={doVerify} disabled={!!busy}>
            {busy === "verify" ? "Verifying…" : "Verify the chain"}
          </Button>
        </>
      }
      meter={<ComputeMeter reading={reading} />}
      console={
        <LiveConsole
          title="Live console · ledger and KMS"
          filter={consoleFilter}
          highlight={HIGHLIGHT[director.state.shot.id]}
        />
      }
      onAutoplay={() => void reel.play()}
    >
      <div className="space-y-12">
        <div className="relative overflow-hidden rounded-lg border border-line">
          <LazyView
            className="h-stage-sm md:h-stage"
            label={`The ledger as a chain of signed blocks: entries around #${TARGET} and the newest entries. ${broken ? `Broken at #${broken.id}.` : verify ? "Verified intact." : ""}`}
          >
            {(onScreen) => (
              <LedgerFilm
                state={director.state}
                onSettled={reel.onSettled}
                active={onScreen}
                ids={ids}
                tamperedAt={tamperedAt}
                verify={
                  verify && verifyAt
                    ? { at: verifyAt, broken: broken ? ids.indexOf(broken.id) : -1 }
                    : null
                }
                restoredAt={restoredAt}
                headAt={headAt}
                merkle={merkle}
              />
            )}
          </LazyView>
          <DirectorHUD
            director={director}
            steps={STEP_BAR}
            playing={reel.playing}
            busy={reel.busy}
            onToggle={() => void reel.play()}
            onNext={() => void reel.next()}
            onPrev={reel.prev}
            onReplay={() => void reset()}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <p className="tabular text-h1-sm font-medium text-fg md:text-h1">
              <Odometer value={count.toLocaleString("en-IN")} />
            </p>
            <Label as="p" className="mt-2">
              Entries · growing with live traffic
            </Label>
          </div>
          <div className="md:col-span-2" aria-live="polite">
            {!verify && (
              <Text className="pt-2">
                Press Verify to re-hash every entry, check every link and verify the signed
                checkpoints and every signature after the last one.
              </Text>
            )}
            {verify?.ok && (
              <div className="space-y-1">
                <p className="text-h2 font-medium text-fg">
                  <span className="text-ok">✓</span> Chain intact
                </p>
                <Label as="p">
                  {verify.checked} entries · {verify.ms.toFixed(0)} ms · head{" "}
                  {verify.head.slice(0, 16)}…
                </Label>
              </div>
            )}
            {broken && (
              <div className="space-y-1">
                <p className="text-h2 font-medium text-fg">
                  <span className="text-danger">✗</span> Broken at entry #{broken.id}
                </p>
                <Text size="small">{REASON[broken.reason] ?? broken.detail}</Text>
                <Label as="p">
                  {verify!.checked - 1} entries before it verified · {verify!.ms.toFixed(0)} ms
                </Label>
              </div>
            )}
          </div>
        </div>

        {edit && (
          <div className="space-y-3 border-t border-line pt-8">
            <Label as="p">What the insider ran, directly in the database</Label>
            <Code
              code={`UPDATE entries SET payload = json_set(payload, '$.${edit.field}', ${JSON.stringify(edit.after)}) WHERE id = ${TARGET};`}
              copy={false}
              wrap="words"
            />
            <Text size="small">
              {edit.field}: {JSON.stringify(edit.before)} → {JSON.stringify(edit.after)}. The row
              looks normal to any query; only verification can tell.
            </Text>
          </div>
        )}

        <div>
          <Heading as="h2" variant="h3">
            Entries around #{TARGET}
          </Heading>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-panel table-fixed text-left font-mono text-small">
              <thead>
                <tr className="border-b border-line">
                  <Label as="th" className="w-12 pb-3 pr-4 font-normal">
                    #
                  </Label>
                  <Label as="th" className="w-24 pb-3 pr-4 font-normal">
                    Kind
                  </Label>
                  <Label as="th" className="pb-3 pr-4 font-normal">
                    Payload
                  </Label>
                  <Label as="th" className="w-40 pb-3 pr-4 font-normal">
                    SHA3-256
                  </Label>
                  <Label as="th" className="w-32 pb-3 font-normal">
                    Signed by
                  </Label>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const bad = broken?.id === e.id;
                  const after = !!broken && e.id > broken.id;
                  return (
                    <tr
                      key={e.id}
                      className={`border-b border-line align-top ${bad ? "bg-raised" : ""}`}
                    >
                      <td className={`py-3 pr-4 ${bad ? "text-warn" : "text-fg"}`}>{e.id}</td>
                      <td className="py-3 pr-4 text-fg-2">{e.kind}</td>
                      <td
                        className={`truncate py-3 pr-4 ${bad ? "text-fg" : "text-fg-3"}`}
                        title={JSON.stringify(e.payload)}
                      >
                        {JSON.stringify(e.payload)}
                      </td>
                      <td className="py-3 pr-4 text-fg-3">
                        {bad && broken?.actual ? (
                          <>
                            <span className="block text-warn">
                              now {broken.actual.slice(0, 10)}…
                            </span>
                            <span className="block">was {e.hash.slice(0, 10)}…</span>
                          </>
                        ) : (
                          `${e.hash.slice(0, 14)}…`
                        )}
                      </td>
                      <td className="truncate py-3 text-fg-3">
                        {after ? "after the break" : e.alg}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {error && <Text size="small">{error}</Text>}
        <Label as="p">
          SQLite on this server · keys from the demo KMS (wrapped with AES-256-GCM, rotated on a
          schedule) · the tamper button is a demo-only endpoint
        </Label>
      </div>
    </DemoShell>
  );
}
