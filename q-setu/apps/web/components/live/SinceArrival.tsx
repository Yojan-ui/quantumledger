"use client";

import { useEffect, useState } from "react";
import { Odometer } from "@/components/ui/Odometer";
import { onLive } from "@/lib/client/live";

/** Real packets sealed on the demo network since this page was opened. Harvest-now, made concrete. */
export function SinceArrival() {
  const [n, setN] = useState(0);
  useEffect(
    () => onLive((e) => e.op === "SEAL" && e.source !== "browser" && setN((x) => x + 1)),
    [],
  );
  return (
    <p className="mt-6 flex items-baseline gap-3 border-t border-line pt-4">
      <span className="tabular font-mono text-h3 text-fg">
        <Odometer value={n.toLocaleString("en-IN")} />
      </span>
      <span className="font-mono text-label uppercase text-fg-3">
        packets crossed this demo network since you arrived. Each one could be copied.
      </span>
    </p>
  );
}
