"use client";

import { Stat } from "@/components/ui";
import { CountUp } from "@/components/ui/CountUp";
import { BENCH_NOTE } from "@/data/facts";
import { useBench } from "@/lib/client/useBench";
import { ms, us } from "@/lib/format";

/** Step 3: what sealing costs, measured on this server. */
export function SealedCost() {
  const bench = useBench();
  const s = bench?.sessions.find((x) => x.profile === "standard");
  return (
    <Stat
      value={s ? <CountUp to={s.perMessageUs} format={us} /> : "…"}
      label={s ? `Per message, after one ${ms(s.handshakeMs)} handshake` : "Per message"}
      footnote={
        <a
          href={`#fact-${BENCH_NOTE}`}
          className="underline decoration-line-strong underline-offset-4"
        >
          [{BENCH_NOTE}]
        </a>
      }
    />
  );
}
