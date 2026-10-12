import type { Solution } from "@/data/solutions";

/** A sector workflow: the hops one record takes, left to right, with the adapter guarding each hop. */
export function Workflow({ s }: { s: Solution }) {
  const n = s.flow.length;
  const W = 960;
  const gap = 40;
  const w = (W - gap * (n - 1)) / n;
  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} 150`}
        className="w-full min-w-panel"
        role="img"
        aria-label={`${s.name} workflow: ${s.flow.map((f) => `${f.node} (protected by ${f.adapter})`).join(", then ")}.`}
        fontFamily="var(--font-geist-sans), sans-serif"
      >
        <defs>
          <marker
            id={`arrow-${s.id}`}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8" fill="none" stroke="var(--text-3)" />
          </marker>
        </defs>
        {s.flow.map((f, i) => {
          const x = i * (w + gap);
          return (
            <g key={f.node}>
              <rect
                x={x + 0.5}
                y={20}
                width={w - 1}
                height={84}
                rx={12}
                fill="var(--bg-raised)"
                stroke="var(--line-strong)"
              />
              <text x={x + 18} y={56} fill="var(--text)" fontSize={17} fontWeight={500}>
                {f.node}
              </text>
              <text
                x={x + 18}
                y={84}
                fill="var(--text-3)"
                fontSize={12}
                letterSpacing="0.08em"
                fontFamily="var(--font-geist-mono), monospace"
              >
                {`QUANTUMLEDGER ${f.adapter.toUpperCase()}`}
              </text>
              {i < n - 1 && (
                <line
                  x1={x + w + 4}
                  y1={62}
                  x2={x + w + gap - 6}
                  y2={62}
                  stroke="var(--text-3)"
                  markerEnd={`url(#arrow-${s.id})`}
                />
              )}
            </g>
          );
        })}
        <text x={0} y={140} fill="var(--text-3)" fontSize={13}>
          Every arrow is a hybrid X25519 + ML-KEM-768 session; every record is signed with
          ML-DSA-65.
        </text>
      </svg>
    </figure>
  );
}
