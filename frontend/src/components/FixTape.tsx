// Order-flow tape: the live inbound flow parsed into FIX 5.0 business fields.
//
// Inbound orders (MsgType 35=D, New) and cancels (35=F, Cxl) come from the
// bridge's ORDER_FLOW stream; fills (35=8, Exec) from EXECUTION_TICK. Columns
// map to FIX tags: TIME ← 60 TransactTime, SIDE ← 54, QTY ← 38 / 32 LastQty,
// PRICE ← 44 / 31 LastPx. The engine's own wire format is binary
// (engine/include/aether/Wire.hpp); FIX is the rendering, not the transport.
//
// Arb rows (amber) are modelled, not traffic: a classical competitor sending
// the same order signed with ECDSA-P256. Its edge = measured verify gap
// (engine benchmark) + extra line-rate wire time at the selected MTU
// (src/net.ts). Shown only while the posture is PQC.

import { useEffect, useRef, useState } from "react";
import { dur, int, px, qty } from "../fmt";
import { profile } from "../net";
import { feed } from "../state/feed";
import { scenario, useScenario } from "../state/scenario";
import type { FlowMsg, Trade } from "../types";

const MAX_ROWS = 64;
const ARB_EVERY_MS = 1500;
const ECDSA_FRAME = 59 + 64;

interface Row {
  key: string; ts: number; type: "New" | "Exec" | "Cxl" | "Arb"; oid: number;
  side: "Buy" | "Sell" | null; qty: number | null; px: number | null; edge?: string;
  agt?: string; cs?: string;          // agent tag + FIX 5000=CRYPTO_STATE (scheme / signature bytes)
}

const AGENT_TAG: Record<string, string> = { NIST_MLDSA: "DSA", PARANOID_MLKEM: "KEM", MARKET: "MKT" };
const ORDER_FIXED = 59, CANCEL_FIXED = 42;   // frame bytes before the signature (Wire.hpp)

/** Modelled ECDSA competitor for a real inbound PQC order, or null if the inputs aren't available. */
function arbFor(o: FlowMsg): Row | null {
  if (o.k !== "N" || scenario.state.classical) return null;
  const sig = feed.state.telemetry?.comparison?.sig;
  const mine = sig?.find((r) => r.name === o.alg), ecdsa = sig?.find((r) => r.name === "ECDSA-P256");
  if (!mine || !ecdsa) return null;
  const mtu = scenario.state.mtu;
  const edge = (mine.verify_ns - ecdsa.verify_ns) + (profile(o.wire, mtu).serNs - profile(ECDSA_FRAME, mtu).serNs);
  return { key: `A${o.id}`, ts: o.ts, type: "Arb", oid: o.id, side: o.side === 0 ? "Buy" : "Sell", qty: o.qty, px: o.px,
    edge: `ECDSA +${dur(edge)}` };
}

const p2 = (n: number, w = 2) => String(n).padStart(w, "0");
/** HH:MM:SS.mmm from a ns timestamp */
function hms(ns: number): string {
  const d = new Date(Math.floor(ns / 1e6));
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}.${p2(d.getUTCMilliseconds(), 3)}`;
}

const fromFlow = (o: FlowMsg): Row => {
  const agt = o.agent ? AGENT_TAG[o.agent] ?? o.agent.slice(0, 3) : undefined;
  const cs = `${o.alg}/${o.wire - (o.k === "N" ? ORDER_FIXED : CANCEL_FIXED)}B`;
  return o.k === "N"
    ? { key: `D${o.id}`, ts: o.ts, type: "New", oid: o.id, side: o.side === 0 ? "Buy" : "Sell", qty: o.qty, px: o.px, agt, cs }
    : { key: `F${o.id}-${o.ts}`, ts: o.ts, type: "Cxl", oid: o.id, side: null, qty: null, px: null, agt, cs };
};

const fromTrade = (t: Trade): Row =>
  ({ key: `X${t.seq}`, ts: t.ts, type: "Exec", oid: t.taker, side: t.aggr === "B" ? "Buy" : "Sell", qty: t.qty, px: t.px });

const FRAG_HOLD_MS = 1000;

/** TCP segmentation warning for the latest ML-DSA order on the tape: its real frame split at the selected MTU. */
function FragWarning({ wire, alg }: { wire: number; alg: string }) {
  const mtu = useScenario((s) => s.mtu);
  const p = profile(wire, mtu);
  if (p.segments.length < 2) return <span className="frag ok">{alg} {int(wire)} B · 1 PKT @ MTU {mtu}</span>;
  return (
    <span className="frag">
      TCP FRAGMENTATION · {int(wire)} B → {p.segments.length} × IP
      <span className="frag-bar">{p.segments.map((g) => <i key={g.index} style={{ width: `${(g.payload / p.mss) * 22}px` }} />)}</span>
      +{dur(p.reassemblyNs)}
    </span>
  );
}

export function FixTape() {
  const buf = useRef<Row[]>([]);
  const counts = useRef({ n: 0, t0: performance.now() });
  const [rows, setRows] = useState<Row[]>([]);
  const [rate, setRate] = useState(0);
  const lastPq = useRef<{ wire: number; alg: string; at: number } | null>(null);
  const [frag, setFrag] = useState<{ wire: number; alg: string } | null>(null);

  useEffect(() => {
    let raf = 0;
    const flush = () => {
      raf = 0;
      setRows(buf.current.slice());
      const c = counts.current, now = performance.now();
      const lp = lastPq.current;
      setFrag(lp && now - lp.at < FRAG_HOLD_MS ? { wire: lp.wire, alg: lp.alg } : null);
      if (now - c.t0 > 1000) { setRate((c.n * 1000) / (now - c.t0)); c.n = 0; c.t0 = now; }
    };
    const push = (rs: Row[]) => {
      buf.current = rs.reverse().concat(buf.current).slice(0, MAX_ROWS);
      if (!raf) raf = requestAnimationFrame(flush);
    };
    let lastArb = 0;
    const offF = feed.onFlow((os, n) => {
      counts.current.n += n;
      for (let i = os.length - 1; i >= 0; i--) {
        const o = os[i];
        if (o.k === "N" && o.alg.startsWith("ML-")) { lastPq.current = { wire: o.wire, alg: o.alg, at: performance.now() }; break; }
      }
      const rows = os.slice(-16).map(fromFlow);
      const now = performance.now();
      if (now - lastArb > ARB_EVERY_MS) {
        const o = [...os].reverse().find((x) => x.k === "N");
        const a = o && arbFor(o);
        if (a) { rows.push(a); lastArb = now; }
      }
      push(rows);
    });
    const offT = feed.onTrades((ts) => push(ts.slice(-6).map(fromTrade)));
    return () => { offF(); offT(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="pane flow">
      <div className="ph"><span>ORDER FLOW · FIX 5.0 · <b className="num">{int(rate)}</b>/s</span>{frag ? <FragWarning {...frag} /> : <span className="dim">—</span>}</div>
      <div className="flow-head"><span>TIME</span><span>AGT</span><span>TYPE</span><span>SIDE</span><span>QTY</span><span>PX</span></div>
      <div className="flow-body">
        {rows.map((r) => (
          <div key={r.key} className={`flow-row t-${r.type}`}
            title={r.type === "Arb" ? "Modelled ECDSA competitor for this order: measured verify gap + extra wire time at the selected MTU"
              : r.cs ? `5000=${r.cs}` : undefined}
            onClick={r.type !== "Cxl" && r.type !== "Arb" ? () => scenario.set({ inspect: { oid: r.oid, title: `ClOrdID ${r.oid}` } }) : undefined}>
            <span className="mute">{hms(r.ts)}</span>
            <span className={`agt a-${r.agt ?? "none"}`}>{r.type === "Arb" ? "ECD" : r.type === "Exec" ? "—" : r.agt ?? "—"}</span>
            <span className="ty">{r.type}</span>
            <span className={r.side === "Buy" ? "bid" : r.side === "Sell" ? "ask" : "mute"}>{r.side ?? "—"}</span>
            <span>{r.qty != null ? qty(r.qty) : "—"}</span>
            <span>{r.px != null ? px(r.px) : "—"}{r.edge && <em className="edge">{r.edge}</em>}</span>
          </div>
        ))}
        {!rows.length && <div className="flow-row"><span className="mute">awaiting order flow</span></div>}
      </div>
    </section>
  );
}
