// Packet Inspector slide-over.
//
// Leads with the plain-English story (classical vs lattice signature size),
// then the real captured frame: a NEW_ORDER fetched exactly as the passive tap
// recorded it, broken down field by field (layout: engine/include/aether/Wire.hpp).

import { useEffect, useState } from "react";
import { dur, int } from "../fmt";
import { useFeed } from "../state/feed";
import { scenario, useScenario, type InspectTarget } from "../state/scenario";

interface Frame { id: number; wire: number; hex: string; alg: string | null; fixed: number }

const SEGMENTS: { name: string; from: number; to: number; cls: string }[] = [
  { name: "length + type", from: 0, to: 5, cls: "s-frame" },
  { name: "order: id · desk · side · price · qty · time", from: 5, to: 40, cls: "s-body" },
  { name: "algorithm · key fingerprint · sig length", from: 40, to: 59, cls: "s-key" },
];
const ECDSA_RAW = 64;   // r ‖ s; DER encoding adds 6–8 B
const SIG_PREVIEW = 40;

const wireNs = (bytes: number, gbps: number) => (bytes * 8) / gbps;

function SizeStory() {
  const rows = useFeed((s) => s.telemetry?.comparison?.sig) ?? [];
  const fixed = useFeed((s) => s.telemetry?.comparison?.order_fixed_bytes) ?? 59;
  const ml65 = rows.find((r) => r.name === "ML-DSA-65")?.sig_bytes ?? 3309;
  const rsa = rows.find((r) => r.name === "RSA-2048")?.sig_bytes ?? 256;
  const bars = [
    { name: "Classical ECDSA", bytes: ECDSA_RAW, cls: "vuln" },
    { name: "Classical RSA-2048", bytes: rsa, cls: "vuln" },
    { name: "Lattice ML-DSA-65", bytes: ml65, cls: "safe" },
  ];
  return (
    <div className="story">
      {bars.map((b) => (
        <div className="story-row" key={b.name}>
          <div className="story-lab"><span className={b.cls === "safe" ? "bid" : "ask"}>{b.name}</span><b className="num">{int(b.bytes)} B</b></div>
          <div className="story-track">
            <span className={`fill ${b.cls}`} style={{ width: `${(b.bytes / ml65) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="story-note">
        ML-DSA-65 sig = {(ml65 / ECDSA_RAW).toFixed(1)}× ECDSA · frame {((fixed + ml65) / (fixed + ECDSA_RAW)).toFixed(1)}× · MLWE/MSIS: no known quantum attack · ECDLP/RSA: Shor
      </div>
    </div>
  );
}

function FrameDetail({ target }: { target: InspectTarget }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = useFeed((s) => s.telemetry?.comparison?.sig) ?? [];
  const fixed = useFeed((s) => s.telemetry?.comparison?.order_fixed_bytes) ?? 59;

  useEffect(() => {
    setFrame(null); setErr(null);
    fetch(`/api/frame/${target.oid}`)
      .then(async (r) => (r.ok ? setFrame(await r.json()) : setErr((await r.json().catch(() => ({}))).detail ?? `${r.status}`)))
      .catch((e) => setErr(String(e)));
  }, [target.oid]);

  const bytes = frame ? frame.hex.match(/../g)! : [];
  const sigLen = frame ? frame.wire - frame.fixed : 0;
  const cmp = ["RSA-2048", "ECDSA-P256", "ML-DSA-65", "ML-DSA-87"].map((name) => {
    const r = rows.find((x) => x.name === name);
    const sig = name === "ECDSA-P256" ? ECDSA_RAW : r?.sig_bytes ?? 0;
    return { name, frame: fixed + sig, verify: r?.verify_ns ?? null, pq: name.startsWith("ML-") };
  });

  return (
    <>
      <div className="wi-k">THIS ORDER ON THE WIRE · {target.title}{target.representative ? " · representative" : ""}</div>
      {err && <div className="dim">order #{target.oid}: {err}</div>}
      {frame && (
        <>
          <div className="wi-total"><span>#{frame.id}</span><b className="num">{int(frame.wire)} B</b><span className="bid">{frame.alg}</span></div>
          <div className="seg-bar">
            {SEGMENTS.map((s) => <span key={s.name} className={s.cls} style={{ flex: s.to - s.from }} />)}
            <span className="s-sig" style={{ flex: sigLen }} />
          </div>
          <table className="grid">
            <tbody>
              {SEGMENTS.map((s) => <tr key={s.name}><td><i className={s.cls} />{s.name}</td><td>{s.to - s.from} B</td></tr>)}
              <tr><td><i className="s-sig" />{frame.alg} signature</td><td className="bid">{int(sigLen)} B</td></tr>
              <tr><td className="dim">signature share of packet</td><td>{((sigLen / frame.wire) * 100).toFixed(1)}%</td></tr>
            </tbody>
          </table>
          <div className="hexdump">
            {SEGMENTS.map((s) => <span key={s.name} className={s.cls}>{bytes.slice(s.from, s.to).join(" ")} </span>)}
            <span className="s-sig">{bytes.slice(frame.fixed, frame.fixed + SIG_PREVIEW).join(" ")}</span>
            <span className="mute"> … +{int(sigLen - SIG_PREVIEW)} B</span>
          </div>
        </>
      )}
      <div className="wi-k" style={{ marginTop: 14 }}>COST PER ORDER AT THE GATE</div>
      <table className="grid">
        <thead><tr><th>ALGORITHM</th><th>PACKET</th><th>@10 GbE</th><th>VERIFY</th></tr></thead>
        <tbody>
          {cmp.map((c) => (
            <tr key={c.name} className={c.pq ? "" : "classical"}>
              <td>{c.name}</td><td>{int(c.frame)} B</td><td>{dur(wireNs(c.frame, 10))}</td><td>{dur(c.verify)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="wi-note">Verify = engine benchmark median on this machine; wire time = line-rate serialisation only. SHA3-256 order digest is recomputed by the engine, never sent.</div>
    </>
  );
}

export function WireInspector() {
  const target = useScenario((s) => s.inspect);
  const close = () => scenario.set({ inspect: null });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    target && (
      <>
        <div className="scrim" onClick={close} />
        <aside className="wire-inspector">
          <div className="ph"><span>PACKET INSPECTOR</span><button className="xbtn" onClick={close}>ESC</button></div>
          <div className="wi-body">
            <SizeStory />
            <FrameDetail target={target} />
          </div>
        </aside>
      </>
    )
  );
}
