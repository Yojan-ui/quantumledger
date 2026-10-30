"use client";

/**
 * Proof Chain: Atlas's ML-DSA-65 signed, hash-chained ledger. Entries from /ledger with the server's live
 * verification; click an entry for its Merkle inclusion proof. "Tamper" calls /tamper-demo, which edits a
 * temporary COPY and verifies it; the real ledger is never touched. The 3D chain (LedgerChain, lazy via
 * LazyView) shows 12 blocks; a failure at entry i of N lights block ⌊12·i/N⌋.
 */
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useState } from "react";
import { LazyView } from "@/components/scenes/LazyView";
import { AtlasError, atlas } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import { AtlasErrorPanel, Chip, NotYetRun, Part, Skeleton, Table } from "../AtlasUI";
import { fmt } from "../useResults";

const LedgerChain = dynamic(() => import("@/components/scenes/LedgerChain"), { ssr: false });

type Tamper = {
  edited_index?: number;
  index?: number | null;
  reason?: string;
  note?: string;
  real_ledger_unchanged?: boolean;
};
type Proof = {
  index?: number;
  type?: string;
  tree_size?: number;
  root?: string;
  leaf_hash?: string;
  proof?: string[];
  verified?: boolean;
};

export function LedgerStep() {
  const { ws } = useParams<{ ws: string }>();
  const me = useAtlasMe();
  const L = useAtlas(`ledger:${ws}`, (signal) => atlas.ledger(ws, { signal }));
  const [tamper, setTamper] = useState<{ busy: boolean; out?: Tamper; err?: string }>({
    busy: false,
  });
  const [proof, setProof] = useState<{ n: number; out?: Proof; err?: string } | null>(null);
  if (L.error) return <AtlasErrorPanel error={L.error} onRetry={L.reload} />;
  if (!L.data) return <Skeleton className="mt-10 h-console" />;
  if (!L.data.available) return <NotYetRun what="Proof Chain" />;
  const led = L.data;
  const n = led.entries.length;
  const live = led.live_verification;
  const failAt = tamper.out?.index ?? null;
  const broken = failAt !== null && n > 0 ? Math.min(11, Math.floor((12 * failAt) / n)) : -1;
  const openProof = async (i: number) => {
    setProof({ n: i });
    try {
      setProof({ n: i, out: (await atlas.proof(ws, i)) as Proof });
    } catch (e) {
      setProof({ n: i, err: e instanceof AtlasError ? e.message : "proof unavailable" });
    }
  };
  return (
    <>
      <Part
        title="Signed, hash-chained Proof Chain"
        label={`${led.alg} · ${n} entries`}
        aside={
          live === null ? (
            <Chip status="pending">not checked</Chip>
          ) : live.ok === null ? (
            <Chip status="partially_verified">{live.status_text}</Chip>
          ) : (
            <Chip status={live.ok ? "PASS" : "FAIL"}>
              {live.ok ? `verified live · ${live.entries_checked} entries` : "verification failed"}
            </Chip>
          )
        }
      >
        <LazyView
          className="h-stage-sm w-full rounded-lg border border-line"
          label={`The Proof Chain as 12 linked blocks${broken >= 0 ? `; block ${broken + 1} broken by the tamper test` : ""}`}
        >
          {(on) => <LedgerChain brokenIndex={broken} still={false} active={on} />}
        </LazyView>
        <p className="mt-3 font-mono text-micro text-fg-3">
          Merkle root {led.root.slice(0, 16)}… · key {led.pubkey_fp.slice(0, 16)}… · {led.backend}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {me.user ? (
            <button
              type="button"
              disabled={tamper.busy || n === 0}
              onClick={async () => {
                setTamper({ busy: true });
                try {
                  setTamper({ busy: false, out: (await atlas.tamperDemo(ws)) as Tamper });
                } catch (e) {
                  setTamper({
                    busy: false,
                    err: e instanceof AtlasError ? e.message : "tamper test failed",
                  });
                }
              }}
              className="h-10 rounded-sm border border-danger px-4 font-mono text-micro uppercase text-danger disabled:opacity-40"
            >
              {tamper.busy ? "Editing a copy…" : "Tamper with a copy"}
            </button>
          ) : (
            <p className="text-small text-fg-3">Sign in to run the tamper test.</p>
          )}
          {tamper.err && (
            <span role="alert" className="text-small text-danger">
              {tamper.err}
            </span>
          )}
          {tamper.out && (
            <span role="status" className="text-small text-fg-2">
              Edited entry #{fmt(tamper.out.edited_index)} in a copy → verification fails at #
              {fmt(tamper.out.index)}: {tamper.out.reason}.{" "}
              {tamper.out.real_ledger_unchanged ? "The real ledger is unchanged." : ""}
            </span>
          )}
        </div>
      </Part>
      <Part title="Entries" label="click an entry for its Merkle proof">
        <Table
          caption="Proof Chain entries"
          head={["#", "Type", "Payload hash", "Time"]}
          rows={led.entries.map((e) => [
            <button
              key="i"
              type="button"
              onClick={() => void openProof(e.index)}
              className="font-mono text-micro text-fg underline-offset-2 hover:underline"
            >
              #{e.index}
            </button>,
            e.type,
            <span key="h" className="font-mono text-micro">
              {e.payload_hash.slice(0, 16)}…
            </span>,
            <span key="t" className="font-mono text-micro">
              {e.ts}
            </span>,
          ])}
        />
        {proof && (
          <div
            role="region"
            aria-label={`Merkle proof for entry ${proof.n}`}
            className="mt-6 rounded-lg border border-line p-4"
          >
            <p className="font-mono text-micro uppercase text-fg-3">
              Merkle inclusion proof · entry #{proof.n}
            </p>
            {proof.err && <p className="mt-2 text-small text-danger">{proof.err}</p>}
            {!proof.out && !proof.err && <p className="mt-2 text-small text-fg-3">Computing…</p>}
            {proof.out && (
              <div className="mt-2 space-y-1 font-mono text-micro text-fg-2">
                <p>
                  {proof.out.type} · tree size {fmt(proof.out.tree_size)} ·{" "}
                  <Chip status={proof.out.verified ? "PASS" : "FAIL"}>
                    {proof.out.verified ? "verified" : "not verified"}
                  </Chip>
                </p>
                <p className="break-all">leaf {proof.out.leaf_hash}</p>
                {(proof.out.proof ?? []).map((h, i) => (
                  <p key={i} className="break-all">
                    path {i + 1} {h}
                  </p>
                ))}
                <p className="break-all">root {proof.out.root}</p>
              </div>
            )}
          </div>
        )}
      </Part>
    </>
  );
}
