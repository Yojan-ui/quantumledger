// Network Layer Profiler: how one signed order maps onto IP packets at a
// given MTU, and what that costs before the engine can even start verifying.

import { useState } from "react";
import { post } from "../api";
import { bytes, dur, int } from "../fmt";
import { profile, LINK_GBPS, type LinkProfile } from "../net";
import { useFeed } from "../state/feed";
import { runKemHandshake } from "../state/kem";
import { useCryptoMode } from "../state/mode";
import { MODE_ALG, scenario, useScenario, type CryptoMode } from "../state/scenario";

const ECDSA_RAW = 64;   // r ‖ s; the benchmark reports the DER encoding
const MTUS = [1500, 9000] as const;

interface AlgRow { alg: string; mode: CryptoMode; sig: number; frame: number; verify: number | null; pq: boolean }

function useAlgRows(): AlgRow[] {
  const c = useFeed((s) => s.telemetry?.comparison);
  const fixed = c?.order_fixed_bytes ?? 59;
  const def: [string, CryptoMode, number][] = [["ECDSA-P256", "CLASSICAL", ECDSA_RAW], ["ML-DSA-65", "L3", 3309], ["ML-DSA-87", "L5", 4627]];
  return def.map(([alg, mode, fallback]) => {
    const r = c?.sig.find((x) => x.name === alg);
    const sig = alg === "ECDSA-P256" ? ECDSA_RAW : r?.sig_bytes ?? fallback;
    return { alg, mode, sig, frame: fixed + sig, verify: r?.verify_ns ?? null, pq: alg.startsWith("ML-") };
  });
}

function AlgSelect() {
  const mode = useCryptoMode();
  const level = useFeed((s) => s.status?.controls.nist_level);
  const online = useFeed((s) => !!s.status?.connected);
  const [pending, setPending] = useState(false);
  const pick = async (m: CryptoMode) => {
    if (m === mode) return;
    scenario.set({ classical: m === "CLASSICAL", breached: false, attack: null });
    const want = m === "L5" ? 5 : 3;
    if (m === "CLASSICAL") return;
    runKemHandshake(want === 5 ? 1024 : 768);          // new posture → new session key
    if (level === want) return;
    setPending(true);
    try { await post("/api/control", { nist_level: want }); } catch { /* status stream shows truth */ }
    finally { setPending(false); }
  };
  return (
    <div className="seg3">
      {(["CLASSICAL", "L3", "L5"] as CryptoMode[]).map((m) => (
        <button key={m} className={`${mode === m ? "on" : ""} ${m === "CLASSICAL" ? "vuln" : ""}`}
          disabled={pending || (!online && m !== "CLASSICAL")} onClick={() => pick(m)}>
          {MODE_ALG[m]}{m === "CLASSICAL" ? "*" : m === "L3" ? " L3" : " L5"}
        </button>
      ))}
    </div>
  );
}

/** One IP packet drawn to scale against its MTU: IP+TCP headers, order header, signature, unused capacity. */
function Packet({ seg, p, pq }: { seg: LinkProfile["segments"][number]; p: LinkProfile; pq: boolean }) {
  const pct = (b: number) => `${(b / p.mtu) * 100}%`;
  const hdrInSeg = Math.max(0, Math.min(seg.to, 59) - seg.from);
  const sigInSeg = seg.payload - hdrInSeg;
  return (
    <div className="pkt">
      <div className="pkt-k">
        <span>PKT {seg.index + 1}</span>
        <span className="dim">bytes {int(seg.from)}–{int(seg.to - 1)}</span>
        <span>{int(seg.payload + 40)} / {int(p.mtu)}</span>
      </div>
      <div className="pkt-bar">
        <span className="b-ip" style={{ width: pct(40) }} />
        {hdrInSeg > 0 && <span className="b-hdr" style={{ width: pct(hdrInSeg) }} />}
        <span className={pq ? "b-sig" : "b-sig vuln"} style={{ width: pct(sigInSeg) }} />
      </div>
    </div>
  );
}

/** The problem statement, followed by the figures this panel computes for it. */
function MtuSummary({ rows }: { rows: AlgRow[] }) {
  const ml = rows.find((r) => r.alg === "ML-DSA-65")!;
  const std = profile(ml.frame, 1500);
  return (
    <div className="mtu-sum">
      <p><b>The PQC MTU Problem:</b> Standard ethernet cuts off at 1,500 Bytes. ML-DSA signatures are 3,309 Bytes, forcing
        packet fragmentation and destroying tick-to-trade speed. Jumbo Frames (MTU 9000) resolve this.</p>
      <p className="calc">
        Here: {int(ml.frame)} B order → <b className="ask">{std.segments.length} packets</b> @ MTU 1500,
        +{dur(std.reassemblyNs)} reassembly at {LINK_GBPS} GbE · <b className="bid">1 packet</b> @ MTU 9000
      </p>
    </div>
  );
}

function NetworkTab() {
  const mode = useCryptoMode();
  const rows = useAlgRows();
  const mtu = useScenario((s) => s.mtu);
  const setMtu = (m: (typeof MTUS)[number]) => scenario.set({ mtu: m });
  const live = useFeed((s) => s.telemetry?.tel_in);
  const active = rows.find((r) => r.mode === mode) ?? rows[1];
  const p = profile(active.frame, mtu);
  const segmented = p.segments.length > 1;
  const gate = active.verify != null ? p.reassemblyNs + active.verify : null;

  return (
    <>
      <MtuSummary rows={rows} />
      <div className="prof-ctl">
        <span className="k">SIG</span><AlgSelect />
        <button className="rekey" disabled={mode === "CLASSICAL"} title="Run one real ML-KEM handshake (liboqs) and show it on the canvas"
          onClick={() => runKemHandshake(mode === "L5" ? 1024 : 768)}>RE-KEY</button>
      </div>

      <div className={`prof-status ${segmented ? "bad" : "ok"}`}>
        {segmented
          ? <>TCP SEGMENTATION · {p.segments.length} IP PACKETS · MSS {int(p.mss)}</>
          : <>1 PACKET · NO SEGMENTATION</>}
      </div>

      <div className="pkts">
        {p.segments.map((s) => <Packet key={s.index} seg={s} p={p} pq={active.pq} />)}
        <div className="pkt-legend"><i className="b-ip" />IP+TCP 40 B<i className="b-hdr" />ORDER HDR 59 B<i className={active.pq ? "b-sig" : "b-sig vuln"} />{active.alg} SIG {int(active.sig)} B</div>
      </div>

      <div className="kv2">
        <div><span>payload</span><b>{int(p.payload)} B</b></div>
        <div><span>ip packets</span><b className={segmented ? "ask" : "bid"}>{p.segments.length}</b></div>
        <div><span>on-wire</span><b>{int(p.wireBytes)} B</b></div>
        <div><span>hdr+L1/L2 ovh</span><b>{int(p.overheadBytes)} B</b></div>
        <div><span>serialise</span><b>{dur(p.serNs)}</b></div>
        <div className={`hl ${segmented ? "bad" : ""}`}><span>reassembly penalty</span><b>{segmented ? `+${dur(p.reassemblyNs)}` : "0 ns"}</b></div>
        <div><span>sig verify</span><b>{dur(active.verify)}</b></div>
        <div><span>reasm + verify</span><b>{dur(gate)}</b></div>
      </div>

      <div className="prof-ctl">
        <span className="k">MTU</span>
        <div className="seg3">
          {MTUS.map((m) => (
            <button key={m} className={mtu === m ? "on" : ""} onClick={() => setMtu(m)}>
              {m === 1500 ? "ETHERNET 1500" : "JUMBO 9000"}
            </button>
          ))}
        </div>
      </div>

      <table className="grid dense">
        <thead><tr><th>ALG @ MTU {mtu}</th><th>FRAME</th><th>PKTS</th><th>WIRE</th><th>REASM</th><th>VERIFY</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const q = profile(r.frame, mtu);
            return (
              <tr key={r.alg} className={`${r.mode === mode ? "active" : ""}${r.pq ? "" : " classical"}`}>
                <td>{r.alg}</td>
                <td>{int(r.frame)}</td>
                <td className={q.segments.length > 1 ? "ask" : "bid"}>{q.segments.length}</td>
                <td>{int(q.wireBytes)}</td>
                <td>{q.segments.length > 1 ? `+${dur(q.reassemblyNs)}` : "—"}</td>
                <td>{dur(r.verify)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="fine">
        MSS = MTU − 40 (IPv4+TCP, no options) · 38 B L1/L2 per frame · reassembly = line-rate time of packets 2..n ·
        verify = engine benchmark median · live engine ingress is loopback, avg frame {live ? `${int(live.wire_avg)} B` : "—"}, {live ? bytes((live.bytes * 1e9) / live.window_ns) : "—"}/s
        {mode === "CLASSICAL" ? " · * what-if: engine enforces ML-DSA" : ""}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ hardware --
const CMD_RING_CAP = 1 << 15;     // engine/src/Bridge.cpp: SpscRing<Cmd> cmds{1u << 15}

function Meter({ k, v, frac, note }: { k: string; v: string; frac: number | null; note?: string }) {
  return (
    <div className="meter">
      <div className="meter-k"><span>{k}</span><b>{v}</b></div>
      <div className="meter-bar"><span style={{ width: `${Math.min(100, Math.max(frac ?? 0, 0) * 100)}%` }} /></div>
      {note && <div className="meter-n">{note}</div>}
    </div>
  );
}

/** Engine memory / hot-path profile, all from live TEL_IN / TEL_MATCH / HB / HELLO. */
function HardwareTab() {
  const tin = useFeed((s) => s.telemetry?.tel_in);
  const tm = useFeed((s) => s.telemetry?.tel_match);
  const hello = useFeed((s) => s.hello);
  const st = useFeed((s) => s.status);
  const c = useFeed((s) => s.telemetry?.comparison);
  const rows: [string, string][] = [
    ["verify p50", tin && tin.verify_n ? `${dur(tin.verify_p50_ns)} · ${int(tin.verify_ticks_p50)} ticks` : "—"],
    ["est. cycles / verify", tin && tin.verify_n ? `~${int(tin.verify_est_cycles_p50)}` : "—"],
    ["timer", c ? `${c.counter} @ ${(c.counter_hz / 1e6).toFixed(0)} MHz · ${c.est_core_ghz} GHz est.` : "—"],
    ["match p50 / p99", tm ? `${dur(tm.match_p50_ns)} / ${dur(tm.match_p99_ns)}` : "—"],
    ["wire→book p50 / p99", tm ? `${dur(tm.e2e_p50_ns)} / ${dur(tm.e2e_p99_ns)}` : "—"],
    ["event drops (egress)", st?.evt_drops != null ? int(st.evt_drops) : "—"],
    ["resident memory", bytes(tm?.rss)],
    ["hot-path heap allocs", "0 by construction"],
    ["L1 / LLC misses", "n/a: PMU not exposed to user space on macOS"],
  ];
  return (
    <>
      <div className="hw-sum">
        Insert, cancel and match never touch the heap: orders live in a pre-allocated pool, prices index a
        fixed tick array, and threads hand off through cache-line-padded SPSC rings.
      </div>
      <div className="meters">
        <Meter k="INGRESS → MATCH RING" v={tin ? `${int(tin.ring_depth)} / ${int(CMD_RING_CAP)}` : "—"} frac={tin ? tin.ring_hwm / CMD_RING_CAP : null}
          note={tin ? `high-water ${int(tin.ring_hwm)} this window · SPSC, 64 B line-padded` : undefined} />
        <Meter k="ORDER POOL" v={tm ? `${int(tm.resting)} / ${int(tm.pool_cap)}` : "—"} frac={tm ? tm.resting / tm.pool_cap : null}
          note="intrusive FIFO slots, no per-order allocation" />
        <Meter k="BOOK ARENA" v={bytes(tm?.book_bytes)} frac={tm && tm.rss ? tm.book_bytes / tm.rss : null}
          note={hello ? `${int(hello.levels)} ticks/side · ${int(hello.max_orders)} order slots · share of RSS` : undefined} />
      </div>
      <table className="grid dense hwt"><tbody>
        {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td className={v.startsWith("n/a") ? "mute" : ""}>{v}</td></tr>)}
      </tbody></table>
      <div className="fine">Cycles = timer ticks × published peak P-core clock (estimate). Live 500 ms window.</div>
    </>
  );
}

type Tab = "net" | "hw";

export function NetProfiler() {
  const [tab, setTab] = useState<Tab>("net");
  return (
    <section className="pane prof">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "net"} className={tab === "net" ? "on" : ""} onClick={() => setTab("net")}>L4 NETWORK (MTU)</button>
        <button role="tab" aria-selected={tab === "hw"} className={tab === "hw" ? "on" : ""} onClick={() => setTab("hw")}>L1 HARDWARE (MEMORY)</button>
      </div>
      <div className="tab-body">{tab === "net" ? <NetworkTab /> : <HardwareTab />}</div>
    </section>
  );
}
