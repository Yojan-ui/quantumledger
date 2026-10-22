import { Panel } from "@/components/ui";
import { Copy } from "@/components/ui/Copy";
import type { Verdict } from "@/lib/lab/types";
import { LABEL_WORDS, RESPONSE_WORDS } from "@/lib/lab/words";

const TONE = { safe: "text-ok", suspicious: "text-warn", attack: "text-danger" } as const;
const BAR = { safe: "bg-ok", suspicious: "bg-warn", attack: "bg-danger" } as const;

/** The threat model's verdict on an incident's riskiest request, with its top three reasons. */
export function ModelVerdict({ v, signed }: { v: Verdict; signed: boolean }) {
  const pct = Math.round(v.score * 100);
  return (
    <Panel>
      <p className="font-mono text-label uppercase text-fg-3">
        <Copy simple="What the threat model thinks" technical="Threat model verdict" />
      </p>
      <p className={`mt-3 text-h3 font-medium ${TONE[v.label]}`}>
        <Copy
          simple={LABEL_WORDS[v.label]}
          technical={`${v.label} · risk ${v.score.toFixed(2)} · confidence ${Math.round(v.confidence * 100)}%`}
        />
      </p>
      <span className="mt-3 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={`block h-full ${BAR[v.label]}`} style={{ width: `${pct}%` }} />
      </span>
      <p className="mt-3 text-small text-fg-2">
        <Copy
          simple={`Risk ${pct} out of 100. Its advice: ${RESPONSE_WORDS[v.response]}.`}
          technical={`Mapped response: ${v.response} (allow < 0.40 ≤ slow < 0.70 ≤ challenge < 0.90 ≤ block).`}
        />
      </p>
      {v.reasons.length > 0 && (
        <>
          <p className="mt-4 font-mono text-label uppercase text-fg-3">
            <Copy simple="Why" technical="Top features (occlusion)" />
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-body text-fg-2">
            {v.reasons.map((r) => (
              <li key={r.feature}>
                <Copy simple={r.text} technical={`${r.feature}: ${r.text}`} />
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-4 text-small text-fg-3">
        <Copy
          simple={
            signed
              ? "This verdict is part of the tamper-proof record."
              : "Scored by today's model (this record was written before the model existed)."
          }
          technical={
            signed
              ? `Verdict signed with the event record (ML-DSA-65) · model ${v.version}`
              : `Computed now with model ${v.version}; not in the signed record`
          }
        />
      </p>
    </Panel>
  );
}
