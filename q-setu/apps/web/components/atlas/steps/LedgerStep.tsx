"use client";

/**
 * Proof Chain: Atlas's ML-DSA-65 signed, hash-chained ledger. Entries from /ledger with the server's live
 * verification; click an entry for its Merkle inclusion proof. "Tamper" calls /tamper-demo, which edits a
 * temporary COPY and verifies it; the real ledger is never touched. The 3D chain (LedgerChain, lazy via
 * LazyView) shows 12 blocks; a failure at entry i of N lights block ⌊12·i/N⌋.
 */
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LazyView } from "@/components/scenes/LazyView";
import { AtlasError, atlas } from "@/lib/client/atlas";
import { useAtlas, useAtlasMe } from "@/lib/client/useAtlas";
import {
  AtlasErrorPanel,
  Chip,
  Details,
  KeyStats,
  NotYetRun,
  Part,
  Skeleton,
  Table,
} from "../AtlasUI";
import { fmt, useResults } from "../useResults";

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
  const { results } = useResults();
  const want = useSearchParams().get("section");
  // ?section=2 / ?section=6 open step 2 or step 6 of the pipeline (Atlas's sidebar links do the same).
  useEffect(() => {
    if (want && L.data)
      document.getElementById(`section-${want}`)?.scrollIntoView({ block: "start" });
  }, [want, L.data]);
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
  // The two pipeline steps the chain proves (Atlas views/ledger.js sections 2 and 6), worded as Atlas does.
  const e0 = led.entries.find((e) => e.type === "detect.run");
  const pq = (
    (
      results?.handshake_evidence as {
        sessions?: { service_id: string; negotiated_group?: string }[];
      } | null
    )?.sessions ?? []
  ).filter((x) => /MLKEM/i.test(x.negotiated_group ?? ""));
  const okLive = live !== null && live.ok === true;
  const checked = live && "entries_checked" in live ? live.entries_checked : led.entry_count;
  return (
    <>
      <Part title="Proof Chain at a glance">
        <KeyStats
          items={[
            {
              label: "signed records",
              value: fmt(led.entry_count),
              unit: `${led.alg}, hash-chained`,
            },
            {
              label: "chain check",
              value:
                live === null
                  ? "not checked"
                  : live.ok === null
                    ? "not verified"
                    : live.ok
                      ? "verified"
                      : "failed",
              unit:
                live && live.ok !== null
                  ? `${fmt(checked)} records re-checked`
                  : live?.ok === null
                    ? live.status_text
                    : "no live check",
            },
            {
              label: "signing key",
              value: (
                <span className="font-mono text-small">
                  {led.pubkey_fp.slice(0, 12)}…{led.pubkey_fp.slice(-4)}
                </span>
              ),
              unit: "public key fingerprint",
            },
          ]}
        />
      </Part>
      <section id="section-2" className="scroll-mt-20">
        <Part
          title="2 · Proof: findings signed"
          aside={<Chip status={e0 ? "PASS" : "pending"}>{e0 ? "signed" : "not yet run"}</Chip>}
        >
          <p className="text-body text-fg-2">
            {e0
              ? `Detect findings signed as entry #${e0.index}, before planning.`
              : "not yet run: no detect.run entry in this ledger"}
          </p>
          {e0 && (
            <Details>
              <p>
                The RSA / ECC / DH findings (detect.run) were signed with ML-DSA-65 as entry #
                {e0.index} at {e0.ts}, before planning; the existing chain was verified first.
              </p>
            </Details>
          )}
        </Part>
      </section>
      <section id="section-6" className="scroll-mt-20">
        <Part
          title="6 · Proof: post-quantum verified"
          aside={
            <Chip status={okLive ? "PASS" : live?.ok === false ? "FAIL" : "pending"}>
              {okLive ? "verified" : live?.ok === false ? "failed" : "not verified"}
            </Chip>
          }
        >
          <p className="text-body text-fg-2">
            {okLive
              ? `${checked} signatures verified${pq.length ? `; ML-KEM evidence signed (${pq.length})` : ""}.`
              : live?.ok === false
                ? `Verification fails at #${String((live as { first_failure?: { index?: number } }).first_failure?.index ?? "?")}.`
                : `not verified: ${live && live.ok === null ? live.status_text : "no check"}`}
          </p>
          <Details>
            <p>
              {okLive
                ? pq.length
                  ? `Every entry's ML-DSA-65 signature verified across the chain (${checked} entries); ML-KEM evidence signed: ${pq.map((x) => `${x.service_id} negotiated ${x.negotiated_group}`).join(", ")}.`
                  : `Signatures verified (${checked} entries); no post-quantum handshake recorded.`
                : live?.ok === false
                  ? `Verification fails at #${String((live as { first_failure?: { index?: number } }).first_failure?.index ?? "?")}.`
                  : `not verified: ${live && live.ok === null ? live.status_text : "no check"}`}
            </p>
          </Details>
        </Part>
      </section>
      <Part
        title="Hash chain: every block links to the one before"
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
