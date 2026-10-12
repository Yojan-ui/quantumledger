// Compact L2 ladder (10 levels a side). Bars show cumulative size. Clicking a
// level opens the packet inspector on a captured frame for that price.

import { useEffect, useMemo, useState } from "react";
import { px, qty } from "../fmt";
import { feed, useFeed } from "../state/feed";
import { scenario, type InspectTarget } from "../state/scenario";
import { useCryptoMode } from "../state/mode";
import type { L2Depth, Level } from "../types";

const DEPTH = 10;

function targetFor(lv: Level, side: "b" | "a", l2: L2Depth): InspectTarget | null {
  const label = `${side === "b" ? "BID" : "ASK"} ${px(lv.px)} · ${qty(lv.qty)}`;
  const touch = side === "b" ? l2.l3b : l2.l3a;
  if ((side === "b" ? l2.bids[0] : l2.asks[0])?.px === lv.px && touch.length) {
    return { oid: touch[0][0], title: `${label} · head of FIFO` };
  }
  const trades = feed.state.trades;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].px === lv.px) return { oid: trades[i].maker, title: `${label} · last fill maker` };
  }
  const last = trades.at(-1);
  return last ? { oid: last.taker, title: `${label} · latest execution`, representative: true } : null;
}

function Row({ lv, side, maxCum, touch, flash, onPick }: {
  lv: Level | undefined; side: "b" | "a"; maxCum: number; touch: boolean; flash: number | undefined;
  onPick: (lv: Level) => void;
}) {
  if (!lv) return <div className={`lrow ${side} empty`} />;
  return (
    <button key={flash} className={`lrow ${side}${touch ? " touch" : ""}${flash ? " flash" : ""}`} onClick={() => onPick(lv)}>
      <span className="bar" style={{ width: `${maxCum ? (lv.cum / maxCum) * 100 : 0}%` }} />
      <span className="p">{px(lv.px)}</span>
      <span>{qty(lv.qty)}</span>
      <span className="dim">{qty(lv.cum)}</span>
    </button>
  );
}

export function DepthLadder() {
  const l2 = useFeed((s) => s.l2);
  const mode = useCryptoMode();
  const [flash, setFlash] = useState<Map<number, number>>(new Map());

  // price → latest trade seq; rows re-key on a new seq, which restarts the flash
  useEffect(() => feed.onTrades((ts) => {
    setFlash((prev) => {
      const next = new Map(prev);
      for (const t of ts) next.set(t.px, t.seq);
      if (next.size > 200) for (const k of [...next.keys()].slice(0, next.size - 200)) next.delete(k);
      return next;
    });
  }), []);

  const maxCum = useMemo(() => {
    if (!l2) return 0;
    return Math.max(l2.bids[DEPTH - 1]?.cum ?? l2.bids.at(-1)?.cum ?? 0, l2.asks[DEPTH - 1]?.cum ?? l2.asks.at(-1)?.cum ?? 0);
  }, [l2]);

  const asks = l2?.asks ?? [];
  const bids = l2?.bids ?? [];
  const badge = mode === "CLASSICAL" ? "ECDSA*" : "ML-DSA";
  const pick = (side: "b" | "a") => (lv: Level) => {
    if (!l2) return;
    const t = targetFor(lv, side, l2);
    if (t) scenario.set({ inspect: t });
  };
  const spreadTicks = l2?.spread != null ? l2.spread / l2.tick : null;

  return (
    <section className="pane ladder">
      <div className="ph"><span>L2 · AETH/USD</span><span className={mode === "CLASSICAL" ? "ask" : "bid"}>sig {badge}</span></div>
      <div className="lhead"><span>PX</span><span>QTY</span><span>CUM</span></div>
      <div className="lbody">
        <div className="lside asks">
          {Array.from({ length: DEPTH }, (_, i) => {
            const lv = asks[DEPTH - 1 - i];
            return <Row key={i} lv={lv} side="a" maxCum={maxCum} touch={DEPTH - 1 - i === 0}
              flash={lv ? flash.get(lv.px) : undefined} onPick={pick("a")} />;
          })}
        </div>
        <div className="spread">
          <span className="mid num">{px(l2?.mid, 3)}</span>
          <span className="dim"><b className="num">{spreadTicks ?? "—"}</b> tk</span>
        </div>
        <div className="lside">
          {Array.from({ length: DEPTH }, (_, i) => {
            const lv = bids[i];
            return <Row key={i} lv={lv} side="b" maxCum={maxCum} touch={i === 0}
              flash={lv ? flash.get(lv.px) : undefined} onPick={pick("b")} />;
          })}
        </div>
      </div>
    </section>
  );
}

