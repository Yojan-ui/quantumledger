"use client";

import { useCallback, useEffect, useState } from "react";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { LiveConsole } from "@/components/live/LiveConsole";
import { Button, Code, Heading, Label, Text } from "@/components/ui";
import { Odometer } from "@/components/ui/Odometer";
import { errText } from "@/lib/client/api";
import { onLive } from "@/lib/client/live";
import type { LedgerEntry, VerifyResult } from "@/lib/live/ledger";
import type { OpEvent } from "@/lib/live/types";

const TARGET = 42;
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
 * Demo 4: the Q-Ledger. Verify the whole chain, then edit entry #42 directly in SQLite (the way an
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

  useEffect(() => {
    void load();
    return onLive((e) => e.op === "LEDGER" && setCount((n) => n + 1));
  }, [load]);

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
  return (
    <DemoShell
      title="Demo 4 · Q-Ledger"
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
      console={<LiveConsole title="Live console · ledger and KMS" filter={consoleFilter} />}
      onAutoplay={() =>
        void (async () => {
          await doVerify();
          await new Promise((r) => setTimeout(r, 1500));
          await doTamper();
          await new Promise((r) => setTimeout(r, 1200));
          await doVerify();
        })()
      }
    >
      <div className="space-y-12">
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
                Press Verify to re-hash every entry and check every signature.
              </Text>
            )}
            {verify?.ok && (
              <div className="space-y-1">
                <p className="text-h2 font-medium text-fg">
                  <span className="text-accent">✓</span> Chain intact
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
                  <span className="text-warn">✗</span> Broken at entry #{broken.id}
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
            <Label as="p">What the insider ran, directly against SQLite</Label>
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
