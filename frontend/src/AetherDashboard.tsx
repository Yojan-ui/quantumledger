import { useEffect, useState } from "react";
import { CommandBar } from "./components/CommandBar";
import { DepthLadder } from "./components/DepthLadder";
import { FixTape } from "./components/FixTape";
import { NetProfiler } from "./components/NetProfiler";
import { QlProbe } from "./components/QuantumLedger";
import { SurfacePane } from "./components/SurfacePane";
import { SystemBar } from "./components/SystemBar";
import { WireInspector } from "./components/WireInspector";
import { useScenario } from "./state/scenario";

const FLASH_MS = 900;

/** Whole-UI border state: muted crimson while breached, a 1 px emerald flash after a neutralized drill. */
function useBorderState(): string {
  const breached = useScenario((s) => s.breached);
  const atk = useScenario((s) => s.attack);
  const [flash, setFlash] = useState(false);
  const held = !!atk && atk.mode !== "CLASSICAL" && atk.phase === "done";
  useEffect(() => {
    if (!held) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [held, atk?.startedAt]);   // eslint-disable-line react-hooks/exhaustive-deps
  return breached ? "breached" : flash ? "held" : "";
}

export function AetherDashboard() {
  const border = useBorderState();
  return (
    <div className={`term ${border}`}>
      <SystemBar />
      <div className="col-l"><QlProbe /><FixTape /><DepthLadder /></div>
      <SurfacePane />
      <NetProfiler />
      <CommandBar />
      <WireInspector />
    </div>
  );
}
