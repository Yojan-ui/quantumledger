import { useEffect, useRef } from "react";
import { int, utc } from "../fmt";
import { useFeed } from "../state/feed";
import { useCryptoMode } from "../state/mode";
import { MODE_ALG } from "../state/scenario";

function Clock() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const id = setInterval(() => { if (ref.current) ref.current.textContent = utc(); }, 47);
    return () => clearInterval(id);
  }, []);
  return <span ref={ref} className="num" />;
}

function Badge({ k, v, tone, title }: { k: string; v: string; tone: "ok" | "bad" | "info"; title?: string }) {
  return <span className={`badge ${tone}`} title={title}><i>{k}:</i> {v}</span>;
}

export function SystemBar() {
  const status = useFeed((s) => s.status);
  const link = useFeed((s) => s.link);
  const tin = useFeed((s) => s.telemetry?.tel_in);
  const c = useFeed((s) => s.telemetry?.comparison);
  const mode = useCryptoMode();
  const up = link === "open" && !!status?.connected && (status.hb_age_ms ?? 1e9) < 1500;
  const cycles = tin && tin.verify_n && tin.verify_est_cycles_p50 ? `~${int(tin.verify_est_cycles_p50 / 1000)}k cycles` : "—";

  return (
    <header className="sysbar">
      <span className="brand"><b>AETHERPOOL</b></span>
      <Badge k="ENGINE" v={up ? "LIVE" : link !== "open" ? "BRIDGE DOWN" : "DOWN"} tone={up ? "ok" : "bad"}
        title={up ? `heartbeat ${status?.hb_age_ms} ms ago` : undefined} />
      <Badge k="CRYPTO" v={mode === "CLASSICAL" ? "CLASSICAL ECDSA (WHAT-IF)" : `NIST ${MODE_ALG[mode]}`} tone={mode === "CLASSICAL" ? "bad" : "ok"} />
      <Badge k="THROUGHPUT" v={cycles} tone="info"
        title={c ? `CPU cycles per ML-DSA verify (live gate median) · timer ticks × est. ${c.est_core_ghz} GHz (${c.cpu})` : undefined} />
      <span className="sp" />
      <span className="clock"><Clock /> UTC</span>
    </header>
  );
}
