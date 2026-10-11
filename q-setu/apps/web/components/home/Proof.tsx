"use client";

import { useState } from "react";
import { Button, Grid, Label, Section, Text, TextLink } from "@/components/ui";
import { CountUp } from "@/components/ui/CountUp";
import { MaskHeading } from "@/components/ui/MaskHeading";
import { Odometer } from "@/components/ui/Odometer";
import { BENCH_NOTE } from "@/data/facts";
import { errText } from "@/lib/client/api";
import { useMetrics } from "@/lib/client/live";
import { useBench } from "@/lib/client/useBench";
import { ms } from "@/lib/format";

interface Verify {
  ok: boolean;
  checked: number;
  ms: number;
  broken?: { id: number; reason: string };
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const d = (await r.json()) as T;
  if (!r.ok) throw new Error(errText(d));
  return d;
}

function Measure({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="tabular text-h2 font-medium text-fg">{value}</p>
      <Label as="p" className="mt-1">
        {label}
      </Label>
    </div>
  );
}

/** 07: is it fast, and does it work? Live measurements, and a tamper you can trigger. */
export function Proof() {
  const bench = useBench()?.sessions.find((s) => s.profile === "standard");
  const live = useMetrics();
  const seal = live?.byOp.SEAL;
  const [v, setV] = useState<Verify>();
  const [tampered, setTampered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const step = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const verify = () => step(async () => setV(await post<Verify>("/api/ledger/verify")));
  const tamper = () =>
    step(async () => {
      await post("/api/ledger/tamper", { id: 42 });
      setTampered(true);
      setV(await post<Verify>("/api/ledger/verify"));
    });
  const restore = () =>
    step(async () => {
      await post("/api/ledger/tamper", { id: 42, restore: true });
      setTampered(false);
      setV(await post<Verify>("/api/ledger/verify"));
    });

  return (
    <Section id="proof" index="07" label="Proof">
      <MaskHeading
        text="Fast enough to forget. Strict enough to catch an insider."
        className="max-w-text"
      />
      <Grid className="mt-12 gap-y-16">
        <div className="col-span-12 lg:col-span-5">
          <Label as="p" tone="strong">
            Compute meter · measured on this server{" "}
            <a
              href={`#fact-${BENCH_NOTE}`}
              className="text-fg-3 underline decoration-line-strong underline-offset-4"
            >
              [{BENCH_NOTE}]
            </a>
          </Label>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8">
            <Measure
              value={
                bench ? (
                  <CountUp to={bench.handshakeMs} format={(n) => `${n.toFixed(1)} ms`} />
                ) : (
                  "…"
                )
              }
              label="PQC handshake, once per session"
            />
            <Measure
              value={
                bench ? (
                  <CountUp
                    to={Math.max(0.1, bench.perMessageUs - bench.baselineMessageUs)}
                    format={(n) => `${n.toFixed(1)} µs`}
                  />
                ) : (
                  "…"
                )
              }
              label="Added per message"
            />
            <Measure value={seal ? ms(seal.p50) : "…"} label="Live seal, p50" />
            <Measure
              value={live ? <Odometer value={live.opsPerSec.toFixed(1)} /> : "…"}
              label="Live operations per second"
            />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <Label as="p" tone="strong">
            Q-Ledger · tamper with the audit log
          </Label>
          <div className="mt-6 min-h-panel space-y-6 border-t border-line pt-6" aria-live="polite">
            {!v && (
              <Text>
                Every entry is hash-chained with SHA3-256 and signed with ML-DSA-65. Verify it, then
                edit entry #42 directly in the database.
              </Text>
            )}
            {v?.ok && (
              <p className="text-h2 font-medium text-fg">
                <span className="text-accent">✓</span> Chain intact ·{" "}
                <span className="tabular">{v.checked.toLocaleString("en-IN")}</span> entries ·{" "}
                <span className="tabular">{v.ms.toFixed(0)} ms</span>
              </p>
            )}
            {v && !v.ok && v.broken && (
              <div className="animate-reveal space-y-2">
                <p className="text-h2 font-medium text-fg">
                  <span className="text-warn">✗</span> Broken at entry #{v.broken.id}
                </p>
                <Text size="small">
                  Someone edited that row after it was written. Its SHA3-256 hash no longer matches,
                  and the
                  {` ${v.checked - 1}`} entries before it still verify.
                </Text>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={verify} disabled={busy}>
                Verify the chain
              </Button>
              {!tampered ? (
                <Button onClick={tamper} disabled={busy}>
                  Tamper with entry #42
                </Button>
              ) : (
                <Button onClick={restore} disabled={busy}>
                  Restore
                </Button>
              )}
            </div>
            {error && (
              <p className="text-small text-fg-2" role="alert">
                That didn’t work: {error}.{" "}
                <button
                  type="button"
                  onClick={verify}
                  className="text-fg underline underline-offset-4"
                >
                  Try again
                </button>
              </p>
            )}
            <TextLink href="/demo/ledger">Open the full Q-Ledger demo →</TextLink>
          </div>
        </div>
      </Grid>
    </Section>
  );
}
