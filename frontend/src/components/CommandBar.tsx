// Bottom command bar: QuantumLedger FR-4 console + a tabbed drawer
// (Merkle proof ledger, ML-KEM handshake, HNDL terminal).

import { useEffect, useState } from "react";
import { int } from "../fmt";
import { useFeed } from "../state/feed";
import { useScenario } from "../state/scenario";
import { HndlTerminal, KemPanel } from "./PqcPanels";
import { LedgerPanel, QlConsole } from "./QuantumLedger";

type BTab = "ledger" | "kem" | "hndl";

/** Bottom drawer: the Merkle proof ledger, the latest ML-KEM handshake, and the HNDL terminal, as tabs. */
function Drawer() {
  const [tab, setTab] = useState<BTab>("ledger");
  const kemAt = useScenario((s) => s.kem?.at ?? 0);
  const breached = useScenario((s) => s.breached);
  const [seenKem, setSeenKem] = useState(0);
  const rejects = useFeed((s) => s.status?.rejects);
  const breaches = useFeed((s) => s.status?.breaches ?? 0);
  const blocked = Object.entries(rejects ?? {}).filter(([k]) => k !== "UNKNOWN_ORDER").reduce((a, [, v]) => a + v, 0);
  useEffect(() => { if (breached) setTab("hndl"); }, [breached]);      // the drill the user just ran
  useEffect(() => { if (tab === "kem") setSeenKem(kemAt); }, [tab, kemAt]);
  const T = (k: BTab, label: string, dot?: string) => (
    <button role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
      {label}{dot && <i className={`dot ${dot}`} />}
    </button>
  );
  return (
    <div className="evlog">
      <div className="tabs btabs" role="tablist">
        {T("ledger", "SHA-256 MERKLE PROOF LEDGER")}
        {T("kem", "ML-KEM HANDSHAKE", kemAt > seenKem && tab !== "kem" ? "cyan" : undefined)}
        {T("hndl", "HNDL TERMINAL", breached ? "red" : undefined)}
        <span className="btabs-meta">blocked <b className="ask">{int(blocked)}</b> · breaches <b className={breaches ? "ask" : "bid"}>{breaches}</b></span>
      </div>
      <div className="tab-body">{tab === "ledger" ? <LedgerPanel /> : tab === "kem" ? <KemPanel /> : <HndlTerminal />}</div>
    </div>
  );
}

export function CommandBar() {
  return (
    <footer className="cmdbar">
      <QlConsole />
      <Drawer />
    </footer>
  );
}
