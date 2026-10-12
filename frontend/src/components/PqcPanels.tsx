// PQC diagnostics rendered as bottom-panel tab content (never over the canvas).
//
// KemPanel: the latest real ML-KEM handshake (bridge → liboqs) with the
//   Module-LWE equation and its measured keygen / encaps / decaps split.
// HndlTerminal: after a classical CRQC drill, the real captured ciphertext and
//   the plaintext recovered after the (simulated, labelled) oracle step.

import { useEffect, useMemo, useState } from "react";
import { dur, int } from "../fmt";
import { useFeed } from "../state/feed";
import { useScenario } from "../state/scenario";

const KEM_K = { 768: 3, 1024: 4 } as const;

/** k × k module-matrix equation t = A·s + e in plain monospace ASCII. */
function latticeAscii(k: number): string {
  const rows: string[] = [];
  for (let i = 0; i < k; i++) {
    const a = Array.from({ length: k }, (_, j) => `a${i}${j}`).join(" ");
    const mid = i === Math.floor(k / 2);
    rows.push(`[ ${a} ]${mid ? " * " : "   "}[ s${i} ]${mid ? " + " : "   "}[ e${i} ]${mid ? " = " : "   "}[ t${i} ]`);
  }
  return rows.join("\n");
}

export function KemPanel() {
  const kem = useScenario((s) => s.kem);
  const tm = useFeed((s) => s.telemetry?.tel_match);
  if (!kem) return <div className="tab-empty">No ML-KEM session yet. Sessions come from Paranoid_MLKEM_Agent (every 4–8 s), a switch to NIST PQC, or RE-KEY.</div>;
  const r = kem.r, k = KEM_K[r.level];
  const total = r.keygen_ns + r.encaps_ns + r.decaps_ns;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="kem-panel">
      <pre className="kh-ascii">{latticeAscii(k)}{"\n"}{`Z_3329[X]/(X^256+1) · s,e <- CBD(eta=2) · k=${k}`}</pre>
      <div className="kem-side">
        <div className="kh-t">ML-KEM-{r.level}{r.agent ? ` · Paranoid_MLKEM_Agent #${r.session}` : " · on demand"}</div>
        <div className="kh-bar">
          <span className="kg" style={{ width: pct(r.keygen_ns) }} />
          <span className="en" style={{ width: pct(r.encaps_ns) }} />
          <span className="de" style={{ width: pct(r.decaps_ns) }} />
        </div>
        <div className="kh-leg">
          <span><i className="kg" />KEYGEN {dur(r.keygen_ns)}</span>
          <span><i className="en" />ENCAPS {dur(r.encaps_ns)}</span>
          <span><i className="de" />DECAPS {dur(r.decaps_ns)}</span>
        </div>
        <div className="kh-leg">
          <span>TOTAL {dur(total)}</span>
          <span className={r.match ? "bid" : "ask"}>{r.match ? "K = K'" : "MISMATCH"}</span>
          <span>pk {int(r.pk_bytes)} B · ct {int(r.ct_bytes)} B</span>
        </div>
        <div className="kh-hex">liboqs on bridge worker thread · C++ matcher p99 {dur(tm?.match_p99_ns)} (live) · K sha3 {r.k_fp}</div>
      </div>
    </div>
  );
}

/** offset · 16 hex bytes · ascii, like xxd */
function hexdump(hex: string): string[] {
  const out: string[] = [];
  for (let o = 0; o < hex.length / 2; o += 16) {
    const bytes = hex.slice(o * 2, o * 2 + 32).match(/../g) ?? [];
    const ascii = bytes.map((b) => { const c = parseInt(b, 16); return c >= 32 && c < 127 ? String.fromCharCode(c) : "."; }).join("");
    out.push(`${o.toString(16).padStart(8, "0")}  ${bytes.join(" ").padEnd(47, " ")}  |${ascii}|`);
  }
  return out;
}

type L = { t: string; cls?: string };

export function HndlTerminal() {
  const breached = useScenario((s) => s.breached);
  const attack = useScenario((s) => s.attack);
  const h = attack?.harvest && !("error" in attack.harvest) && attack.harvest.ok ? attack.harvest : null;
  const ch = h?.channels.find((c) => c.channel.startsWith("X25519"));

  const lines = useMemo<L[]>(() => {
    if (!h || !ch) return [];
    return [
      { t: `$ tap.replay --link x25519+aes-256-gcm --frames ${h.frames}`, cls: "cmd" },
      { t: `  captured ${int(ch.harvested_bytes)} B · handshake ${int(ch.handshake_bytes)} B · plaintext ${int(h.plaintext_bytes)} B (sealed)` },
      { t: `  -- ciphertext as stored by the adversary (first 256 B) --`, cls: "dim" },
      ...(ch.ct_dump ? hexdump(ch.ct_dump).map((t) => ({ t, cls: "ct" })) : []),
      { t: `$ qday.oracle --target x25519-scalar`, cls: "cmd" },
      { t: `  SIMULATED CRQC ORACLE: stands in for Shor's algorithm (no such machine exists)`, cls: "warn" },
      { t: `  scalar recovered -> HKDF -> AES-256-GCM key · tag verified · decrypt OK`, cls: "crit" },
      { t: `  -- recovered plaintext (first 256 B, real decryption) --`, cls: "dim" },
      ...(ch.pt_dump ? hexdump(ch.pt_dump).map((t) => ({ t, cls: "pt" })) : []),
      { t: `$ decode NEW_ORDER frames`, cls: "cmd" },
      ...(ch.qday.sample ?? []).map((o) => ({ t: `  #${String(o.id).padEnd(7)} ${o.desk}  ${o.side.padEnd(4)}  ${o.qty.padStart(6)} @ ${o.px}   ${o.alg}`, cls: o.side === "BUY" ? "bid" : "ask" })),
      { t: `  ${ch.qday.orders_recovered} dark-pool orders exposed · notional ${ch.qday.notional}`, cls: "crit" },
    ];
  }, [h, ch]);

  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!breached || !lines.length) { setShown(0); return; }
    setShown(0);
    const id = setInterval(() => setShown((n) => (n >= lines.length ? (clearInterval(id), n) : n + 1)), 28);
    return () => clearInterval(id);
  }, [breached, lines]);

  if (!breached || !lines.length) {
    return <div className="tab-empty">No breach. Set [ STATE: CLASSICAL ECDSA ] and run [ SIMULATE CRQC ADVERSARY ] to replay captured traffic here.</div>;
  }
  return (
    <pre className="hndl-body">
      {lines.slice(0, shown).map((l, i) => <div key={i} className={l.cls}>{l.t}</div>)}
      {shown < lines.length && <span className="cur">█</span>}
    </pre>
  );
}
