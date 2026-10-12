"use client";

/**
 * Live "PROOF" elements for the Problem → Fix → Proof blocks. Each one runs the real thing (a
 * request through Shield, a sealed form post, a Vault write, a TLS probe, a ledger verification)
 * or shows a number measured on this server. Nothing here is a canned result.
 */
import {
  SEALED_CONTENT_TYPE,
  HEADER_SIGNATURE,
  sealBody,
  verifyResponse,
  type ServerPublicKeys,
} from "@qsetu/web-shield";
import { utf8ToBytes } from "@qsetu/core";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Label } from "@/components/ui";
import { CountUp } from "@/components/ui/CountUp";
import { Odometer } from "@/components/ui/Odometer";
import { errText } from "@/lib/client/api";
import { onLive, pushLocal } from "@/lib/client/live";
import { useBench } from "@/lib/client/useBench";
import { bytes, ms, us } from "@/lib/format";

/** One proof line: mono, with ✓ in the accent. */
function Result({ ok = true, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <p className="font-mono text-small text-fg-2">
      <span className={ok ? "text-ok" : "text-danger"}>{ok ? "✓" : "✗"}</span> {children}
    </p>
  );
}

function useRun<T>(fn: () => Promise<T>) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<T>();
  const [error, setError] = useState<string>();
  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setOut(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, out, error, run };
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await r.json()) as T;
  if (!r.ok) throw new Error(errText(data, `Request failed (${r.status})`));
  return data;
}

export function ShieldProof() {
  const r = useRun(() =>
    post<{
      before: { ms: number };
      after: {
        ms: number;
        session: string | null;
        epoch: string | null;
        response: { status?: string };
      };
      frames: { bytes?: number }[];
    }>("/api/shield/run", { sector: "fintech" }),
  );
  return (
    <div className="space-y-3">
      <Button onClick={r.run} disabled={r.busy}>
        {r.busy ? "Sending…" : "Send a payment through Shield"}
      </Button>
      {r.out && (
        <Result>
          legacy app answered {r.out.after.response.status ?? "OK"} · tunnelled over session{" "}
          {r.out.after.session?.slice(0, 8)} · +{ms(Math.max(0, r.out.after.ms - r.out.before.ms))}{" "}
          vs direct
        </Result>
      )}
      {r.error && <Result ok={false}>{r.error}</Result>}
    </div>
  );
}

export function WebProof() {
  const r = useRun(async () => {
    const keys = (await (await fetch("/api/qsetu/key")).json()) as ServerPublicKeys;
    const form = JSON.stringify({ name: "Kavya Nair", pan: "ABCDE1234F", income: "1240000" });
    const s = sealBody(utf8ToBytes(form), "application/json", keys);
    pushLocal({
      op: "SEAL",
      alg: "ml-kem-768+x25519",
      ms: s.ms,
      bytes: s.sealedBytes,
      ok: true,
      detail: "form sealed in this browser",
    });
    const res = await fetch("/api/web-shield/submit", {
      method: "POST",
      headers: { "content-type": SEALED_CONTENT_TYPE },
      body: s.body,
    });
    const body = new Uint8Array(await res.arrayBuffer());
    if (!res.ok) throw new Error("Server rejected the sealed form");
    const signed = verifyResponse(body, res.headers.get(HEADER_SIGNATURE), s.nonce, keys);
    return { ...s, signed };
  });
  return (
    <div className="space-y-3">
      <Button onClick={r.run} disabled={r.busy}>
        {r.busy ? "Sealing…" : "Seal a tax form in this browser"}
      </Button>
      {r.out && (
        <Result ok={r.out.signed}>
          {bytes(r.out.plainBytes)} of form data → {bytes(r.out.sealedBytes)} sealed in{" "}
          {ms(r.out.ms)} · server opened it · reply signature{" "}
          {r.out.signed ? "verified" : "invalid"}
        </Result>
      )}
      {r.error && <Result ok={false}>{r.error}</Result>}
    </div>
  );
}

export function SdkProof() {
  const s = useBench()?.sessions.find((x) => x.profile === "standard");
  return (
    <div className="flex gap-12">
      <Measured
        value={s?.handshakeMs}
        format={(n) => `${n.toFixed(1)} ms`}
        label="Handshake, once"
      />
      <Measured value={s?.perMessageUs} format={us} label="Per message after it" />
    </div>
  );
}

export function EdgeProof() {
  const s = useBench()?.sessions.find((x) => x.profile === "edge");
  return (
    <div className="flex gap-12">
      <Measured
        value={s?.handshakeMs}
        format={(n) => `${n.toFixed(1)} ms`}
        label="Edge handshake"
      />
      <Measured value={s?.handshakeBytes} format={(n) => bytes(n)} label="On the wire, once" />
    </div>
  );
}

function Measured({
  value,
  format,
  label,
}: {
  value?: number;
  format: (n: number) => string;
  label: string;
}) {
  return (
    <div>
      <p className="tabular text-h2 font-medium text-fg">
        {value === undefined ? "…" : <CountUp to={value} format={format} />}
      </p>
      <Label as="p" className="mt-1">
        {label} · measured on this server
      </Label>
    </div>
  );
}

export function VaultProof() {
  const r = useRun(() =>
    post<{ put: { id: string }; stored?: { ct: string; wrappedKey?: string } }>("/api/vault", {
      sector: "healthcare",
    }),
  );
  return (
    <div className="space-y-3">
      <Button onClick={r.run} disabled={r.busy}>
        {r.busy ? "Storing…" : "Store a lab report"}
      </Button>
      {r.out && (
        <Result>
          record {r.out.put.id} stored as {r.out.stored ? bytes(atob(r.out.stored.ct).length) : "?"}{" "}
          of ciphertext · its key wrapped with ML-KEM-768 · signed with ML-DSA-65
        </Result>
      )}
      {r.error && <Result ok={false}>{r.error}</Result>}
    </div>
  );
}

interface UrlScan {
  probe: { host: string; group: string; hybridPq: boolean; protocol: string; certKey: string };
  score: number;
  grade: string;
  plan: { steps: { priority: string; title: string }[] };
}

export function ScanProof() {
  const [url, setUrl] = useState("");
  const r = useRun(() => post<UrlScan>("/api/scan/url", { url }));
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) void r.run();
        }}
        className="flex gap-2"
      >
        <label htmlFor="proof-url" className="sr-only">
          Website to scan
        </label>
        <input
          id="proof-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="your-bank.in"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-inset px-3 font-mono text-small text-fg outline-none transition-colors duration-150 placeholder:text-fg-3 focus:border-line-strong"
        />
        <Button type="submit" disabled={r.busy || !url.trim()}>
          {r.busy ? "Scanning…" : "Scan"}
        </Button>
      </form>
      {r.out && (
        <>
          <Result ok={r.out.probe.hybridPq}>
            {r.out.probe.host}: {r.out.probe.protocol} · key exchange {r.out.probe.group} ·{" "}
            {r.out.probe.hybridPq ? "hybrid post-quantum" : "classical, harvestable"} ·{" "}
            {r.out.grade} ({r.out.score})
          </Result>
          {r.out.plan.steps[0] && (
            <p className="font-mono text-small text-fg-3">
              First step: {r.out.plan.steps[0].priority} · {r.out.plan.steps[0].title} ·{" "}
              <Link
                href={`/demo/scanner?url=${encodeURIComponent(r.out.probe.host)}#url`}
                className="text-fg underline decoration-line-strong underline-offset-4"
              >
                full plan
              </Link>
            </p>
          )}
        </>
      )}
      {r.error && <Result ok={false}>{r.error}</Result>}
    </div>
  );
}

export function LedgerProof() {
  const [count, setCount] = useState<number>();
  const r = useRun(() => post<{ ok: boolean; checked: number; ms: number }>("/api/ledger/verify"));
  useEffect(() => {
    void fetch("/api/ledger?limit=1")
      .then((x) => x.json())
      .then((d: { count: number }) => setCount(d.count));
    return onLive((e) => e.op === "LEDGER" && setCount((n) => (n ?? 0) + 1));
  }, []);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-6">
        <p className="tabular text-h2 font-medium text-fg">
          {count === undefined ? "…" : <Odometer value={count.toLocaleString("en-IN")} />}
        </p>
        <Label as="p">Entries, chained and signed</Label>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Button onClick={r.run} disabled={r.busy}>
          {r.busy ? "Verifying…" : "Verify the whole chain"}
        </Button>
        <Link
          href="/demo/ledger"
          className="text-small text-fg-2 transition-colors duration-150 hover:text-fg"
        >
          Tamper with it in Demo 4 →
        </Link>
      </div>
      {r.out && (
        <Result ok={r.out.ok}>
          {r.out.checked} entries re-hashed (SHA3-256) and signatures checked (ML-DSA-65) in{" "}
          {ms(r.out.ms)}
        </Result>
      )}
    </div>
  );
}
