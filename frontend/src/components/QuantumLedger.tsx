// QuantumLedger: an external PQC-migration auditor probing the AetherPool
// order-entry endpoint. CII probe (CBOM + Mosca), FR-4 hybrid remediation
// console, and the SHA-256 Merkle proof ledger.

import { useEffect, useState } from "react";
import { dur, int } from "../fmt";
import { runBreachDrill, resetBreach } from "../state/drill";
import { useFeed } from "../state/feed";
import { useCryptoMode } from "../state/mode";
import { deployHybrid, loadLedger, setLegacy, useQl } from "../state/ql";
import { useScenario } from "../state/scenario";

// ---------------------------------------------------------------- CII probe --
interface CbomStatus { assets: number; serial: string; sha: string; at: string; posture: string }

/** Mosca: data is exposed if migration time X + data shelf life Y exceeds time to a CRQC Z. Inputs are assumptions. */
export function QlProbe() {
  const phase = useQl((s) => s.phase);
  const legacy = phase !== "patched";
  const [x, setX] = useState(3), [y, setY] = useState(7), [z, setZ] = useState(8);
  const [cbom, setCbom] = useState<CbomStatus | null>(null);
  const [doc, setDoc] = useState<unknown>(null);
  const posture = legacy ? "legacy" : "hybrid";

  useEffect(() => {
    let live = true;
    fetch(`/api/ql/cbom?posture=${posture}`).then((r) => r.json()).then((r) => {
      if (!live) return;
      setDoc(r.cbom);
      setCbom({ assets: r.cbom.components.length, serial: r.cbom.serialNumber.slice(-12), sha: r.sha256, at: r.cbom.metadata.timestamp.slice(11, 19), posture });
    }).catch(() => undefined);
    return () => { live = false; };
  }, [posture]);

  const download = async () => {
    const r = await fetch(`/api/ql/cbom?posture=${posture}&record=true`).then((x) => x.json()).catch(() => null);
    if (!r) return;                                     // recorded export: appended to the proof ledger
    setCbom({ assets: r.cbom.components.length, serial: r.cbom.serialNumber.slice(-12), sha: r.sha256, at: r.cbom.metadata.timestamp.slice(11, 19), posture });
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.cbom, null, 2)], { type: "application/vnd.cyclonedx+json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `aetherpool-cbom-${posture}.cdx.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const X = legacy ? x : 0;
  const exposure = X + y - z;
  const vuln = exposure > 0;
  const num = (v: number, set: (n: number) => void) => (
    <input className="mosca-in num" type="number" min={0} max={50} value={v} onChange={(e) => set(Math.max(0, Math.min(50, +e.target.value || 0)))} />
  );
  return (
    <section className="pane qlp">
      <div className="ph"><span>QUANTUMLEDGER // CII PROBE</span><span className="dim">target aetherpool-order-entry</span></div>
      <div className="qlp-row">
        <i>CBOM</i>
        <span>{cbom ? <>CycloneDX 1.6 · {cbom.posture} · {cbom.assets} assets · sha256 {cbom.sha.slice(0, 12)} · {cbom.at}Z</> : "generating…"}</span>
        <button className="qbtn" disabled={!doc} onClick={download}>EXPORT</button>
      </div>
      <div className="qlp-row">
        <i>LINK</i>
        <span className={legacy ? "ask" : "bid"}>{legacy ? "RSA-2048 · TLS 1.2 (legacy terminator, modelled)" : "X25519MLKEM768 + ML-DSA-65 · TLS 1.3 (hybrid, modelled)"}</span>
      </div>
      <div className="qlp-row mosca">
        <i>MOSCA</i>
        <span>X {legacy ? num(x, setX) : <b className="bid">0</b>} + Y {num(y, setY)} {vuln ? ">" : "≤"} Z {num(z, setZ)} yrs</span>
        <b className={`mosca-v ${vuln ? "bad" : "ok"}`}>{vuln ? `VULNERABLE +${exposure}y` : `SAFE ${-exposure}y margin`}</b>
      </div>
      <div className="fine">X migration time · Y data shelf life · Z years to a CRQC: assumptions, edit to test. X = 0 once migrated.</div>
    </section>
  );
}

// -------------------------------------------------------------- FR-4 console --
export function QlConsole() {
  const phase = useQl((s) => s.phase);
  const lines = useQl((s) => s.lines);
  const m = useQl((s) => s.metrics);
  const mode = useCryptoMode();
  const online = useFeed((s) => !!s.status?.connected);
  const atk = useScenario((s) => s.attack);
  const breached = useScenario((s) => s.breached);
  const running = atk?.phase === "running";
  const drill = !atk || running ? "—" : breached ? "EXPOSED · session keys recovered (sim. CRQC oracle)"
    : atk.mode === "CLASSICAL" ? "no captured traffic" : "MODULE-LWE HARDNESS INTACT. THREAT NEUTRALIZED.";
  return (
    <div className="qlc">
      <div className="ph"><span>FR-4 HYBRID REMEDIATION</span><span className="dim">measured on this host · medians of {m?.runs ?? 15}</span></div>
      <div className="qlc-body">
        <div className="seg3 sys">
          <button className={phase !== "patched" ? "on vuln" : ""} disabled={phase === "patching"} onClick={setLegacy}>[ LEGACY: RSA-2048 ]</button>
          <button className={phase === "patched" ? "on" : ""} disabled={phase !== "legacy" || !online} onClick={deployHybrid}>
            {phase === "patching" ? "[ DEPLOYING… ]" : phase === "patched" ? "[ HYBRID ACTIVE ]" : "[ DEPLOY HYBRID PATCH ]"}
          </button>
        </div>
        <pre className="qlc-term">
          {lines.length ? lines.map((l, i) => <div key={i} className={l.cls}>{l.t}</div>) : <div className="dim">target on legacy terminator · awaiting FR-4</div>}
        </pre>
        <div className="qlc-grid">
          <div><i>KEY EXCHANGE</i><b>{m ? `${(m.kex_ns / 1e6).toFixed(2)} ms` : "—"}</b><small>X25519MLKEM768</small></div>
          <div><i>SIGN + VERIFY</i><b>{m ? `${(m.sign_verify_ns / 1e6).toFixed(2)} ms` : "—"}</b><small>ML-DSA-65</small></div>
          <div><i>WIRE (SIG)</i><b>{m ? `${(m.sig_bytes / 1024).toFixed(1)} KB` : "—"}</b><small>{m ? `${int(m.sig_bytes)} B · pk ${int(m.pk_bytes)} B` : ""}</small></div>
          <div><i>KEX SHARES</i><b>{m ? `${int(m.client_share + m.server_share)} B` : "—"}</b><small>{m ? `${int(m.client_share)} + ${int(m.server_share)}` : ""}</small></div>
        </div>
        <div className="qlc-drill">
          {breached
            ? <button className="sq go" onClick={resetBreach}>[ RESET ]</button>
            : <button className="sq red" disabled={!online || running} onClick={() => runBreachDrill(mode)}>{running ? "[ RUNNING ]" : "[ SIMULATE CRQC ADVERSARY ]"}</button>}
          <span className={breached ? "ask" : atk && !running ? "bid" : "dim"}>{drill}</span>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- proof ledger --
export function LedgerPanel() {
  const entries = useQl((s) => s.entries);
  const root = useQl((s) => s.root);
  const size = useQl((s) => s.size);
  useEffect(() => { loadLedger(); }, []);
  const rows = entries.slice().reverse();
  return (
    <div className="ledger">
      <div className="ledger-head">
        <span>RFC 6962 SHA-256 · {int(size)} leaves</span>
        <span>ROOT <b>{root ? `${root.slice(0, 24)}…` : "—"}</b></span>
        <span>DUAL-SIGNED Ed25519 + ML-DSA-65</span>
      </div>
      <div className="ledger-body">
        {rows.map((e) => (
          <div key={e.index} className="lg-row" title={`leaf ${e.leaf}\nroot ${e.root}\nEd25519 ${e.ed25519.head}… · ML-DSA-65 ${e.mldsa65.head}…`}>
            <span className="mute">#{String(e.index).padStart(4, "0")}</span>
            <span className="mute">{e.ts.slice(11, 23)}</span>
            <span className="lg-hash">{e.leaf.slice(0, 16)}</span>
            <span className={e.ed25519.ok ? "bid" : "ask"}>Ed25519 {e.ed25519.ok ? "✓" : "✗"} {e.ed25519.bytes}B</span>
            <span className={e.mldsa65.ok ? "bid" : "ask"}>ML-DSA-65 {e.mldsa65.ok ? "✓" : "✗"} {int(e.mldsa65.bytes)}B · {dur(e.mldsa65.sign_ns)}</span>
            <span className={e.inclusion_ok ? "bid" : "ask"}>INCL {e.inclusion_ok ? "✓" : "✗"}</span>
            <span className="lg-sum">{e.kind} · {e.summary}</span>
          </div>
        ))}
        {!rows.length && <div className="tab-empty">Ledger empty.</div>}
      </div>
    </div>
  );
}
