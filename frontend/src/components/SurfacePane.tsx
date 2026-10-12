import { LiquiditySurface } from "../LiquiditySurface";
import { dur } from "../fmt";
import { useFeed } from "../state/feed";
import { useCryptoMode } from "../state/mode";
import { MODE_ALG, useScenario } from "../state/scenario";

const IMB_LEVELS = 10;

/** Spread, top-10 depth imbalance and live engine latency, from the same feed as the heatmap. */
function Hud() {
  const l2 = useFeed((s) => s.l2);
  const tm = useFeed((s) => s.telemetry?.tel_match);
  const tin = useFeed((s) => s.telemetry?.tel_in);
  const bid = l2?.bids[0]?.px, ask = l2?.asks[0]?.px;
  const spread = bid != null && ask != null && l2?.mid ? ((ask - bid) / l2.mid) * 1e4 : null;
  const b = l2?.bids.slice(0, IMB_LEVELS).reduce((a, v) => a + v.qty, 0) ?? 0;
  const a = l2?.asks.slice(0, IMB_LEVELS).reduce((x, v) => x + v.qty, 0) ?? 0;
  const imb = b + a ? (b - a) / (b + a) : null;
  return (
    <div className="hm-hud">
      <div><i>SPREAD</i><b>{spread != null ? `${spread.toFixed(1)} bps` : "—"}</b></div>
      <div><i>IMBALANCE</i><b className={imb == null ? "" : imb >= 0 ? "bid" : "ask"}>{imb != null ? `${imb >= 0 ? "+" : ""}${imb.toFixed(2)}` : "—"}</b><small>top {IMB_LEVELS}</small></div>
      <div><i>WIRE→BOOK</i><b>{dur(tm?.e2e_p50_ns)}</b><small>p50</small></div>
      <div><i>VERIFY</i><b>{dur(tin?.verify_p50_ns)}</b><small>{tin?.policy ?? ""}</small></div>
    </div>
  );
}

function StateChip() {
  const mode = useCryptoMode();
  const breached = useScenario((s) => s.breached);
  const atk = useScenario((s) => s.attack);
  const [cls, txt] = breached ? ["ask", "BREACHED · classical keys recovered (sim)"]
    : atk && atk.mode !== "CLASSICAL" && atk.phase === "done" ? ["bid", "HELD · forged orders rejected"]
      : ["dim", "NOMINAL"];
  return <span className="dim">SIG <b className={mode === "CLASSICAL" ? "ask" : "bid"}>{MODE_ALG[mode]}{mode === "CLASSICAL" ? "*" : ""}</b> · STATE <b className={cls}>{txt}</b></span>;
}

export function SurfacePane() {
  const link = useFeed((s) => s.link);
  const engine = useFeed((s) => s.status?.connected);
  return (
    <section className="pane surf">
      <div className="ph"><span>LIQUIDITY SURFACE · AETH/USD · PX × QTY × T (9.6 S)</span><StateChip /></div>
      <div className="surf-body">
        <LiquiditySurface />
        <Hud />
        {(link !== "open" || !engine) && <div className="offline">{link !== "open" ? "BRIDGE OFFLINE :8000" : "ENGINE OFFLINE :9001"}</div>}
      </div>
    </section>
  );
}
