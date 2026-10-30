"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { AtlasResults } from "@/lib/client/atlas";
import { endpointError, endpointHosts, scanEndpoints } from "@/lib/client/endpoint-intake";
import { useAtlasMe } from "@/lib/client/useAtlas";
import { Button } from "@/components/ui";

type Live = {
  handshake_ok?: boolean;
  protocol?: string;
  group?: string;
  kex_family?: string;
  error?: string;
  chain?: { key: string; signature_algorithm: string; not_after: string }[];
};

/** One line per host from the run's Detect probes (recorded handshake fields only). */
function ScanResult({ results }: { results: AtlasResults }) {
  const probes = (
    (results.detect as { probes?: { endpoint: string; live: Live }[] } | null)?.probes ?? []
  ).filter((p) => p.live.chain || p.live.error);
  if (!probes.length) return null;
  return (
    <ul aria-label="Handshake per host" className="space-y-1 text-small text-fg-2">
      {probes.map(({ endpoint, live }) => (
        <li key={endpoint} className="break-words">
          <strong className="font-medium text-fg">{endpoint}</strong>:{" "}
          {live.handshake_ok
            ? `${live.protocol} · ${live.group ?? "RSA key transport"} (${live.kex_family === "PQC" ? "hybrid post-quantum" : "classical"}) · cert ${live.chain?.[0]?.key ?? "–"}, ${live.chain?.[0]?.signature_algorithm ?? "–"}, expires ${live.chain?.[0]?.not_after.slice(0, 10) ?? "–"}`
            : `no handshake (${live.error ?? "timed out or refused"})`}
        </li>
      ))}
    </ul>
  );
}

export function EndpointScan({ results }: { results?: AtlasResults | null }) {
  const me = useAtlasMe();
  const router = useRouter();
  const locked = useRef(false);
  const [hosts, setHosts] = useState("");
  const [authorised, setAuthorised] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const scan = async () => {
    if (locked.current) return;
    setError("");
    try {
      endpointHosts(hosts);
    } catch (e) {
      setError(endpointError(e));
      return;
    }
    if (!authorised) {
      setError("Confirm that you own or are authorised to assess these hosts.");
      return;
    }
    if (!me.canOperate) {
      setError("Sign in with an Atlas operator account to scan an endpoint.");
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      const { id, run_id } = await scanEndpoints(hosts, setMessage);
      router.push(`/atlas/${encodeURIComponent(id)}?run=${encodeURIComponent(run_id)}`);
    } catch (e) {
      setError(endpointError(e));
      setMessage("");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <section id="endpoint" className="scroll-mt-16 space-y-3 rounded-lg border border-line p-4">
      <h2 className="text-h3 font-medium text-fg">Scan a live endpoint</h2>
      <p className="text-small text-fg-2">
        Public hosts only, one ordinary TLS handshake each. A new workspace keeps your scan separate
        from the bank demo.
      </p>
      <form
        className="flex flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void scan();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Public hostnames</span>
          <input
            aria-describedby="endpoint-help"
            value={hosts}
            onChange={(e) => setHosts(e.target.value)}
            required
            placeholder="example.com, api.example.com:8443"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            className="h-10 w-full rounded-sm border border-line bg-inset px-3 text-body text-fg"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Working…" : "Scan and run"}
        </Button>
      </form>
      <label className="flex items-start gap-2 text-small text-fg-2">
        <input
          type="checkbox"
          checked={authorised}
          onChange={(e) => setAuthorised(e.target.checked)}
          disabled={busy}
          className="mt-1"
        />
        <span>Scan only hosts you own or are authorised to assess. I confirm that I am.</span>
      </label>
      <p id="endpoint-help" className="text-small text-fg-3">
        host or host:port (default 443), up to 10. Atlas refuses localhost and private addresses,
        records the TLS version, key exchange, cipher and certificate chain, and plans ML-KEM for
        key exchange and ML-DSA for certificates. No port scanning.
      </p>
      {!me.loading && !me.user && (
        <Link
          href="/atlas/signin?next=/atlas/demo%23endpoint"
          className="inline-block text-small underline underline-offset-4"
        >
          Sign in to scan
        </Link>
      )}
      {me.error && (
        <p role="alert" className="text-small text-danger">
          {endpointError(me.error)}
        </p>
      )}
      {message && (
        <p role="status" className="break-words text-small text-fg-2">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      {results && <ScanResult results={results} />}
    </section>
  );
}
