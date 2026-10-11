/**
 * Architecture diagram: one core (registry → hybrid KEM, sessions, envelopes, signatures), five
 * adapters around it, and where each one sits in a real system. Pure SVG in token colours.
 */
const ADAPTERS = [
  { name: "Shield", where: "Sidecar beside any server" },
  { name: "Web", where: "One script tag in the page" },
  { name: "SDK", where: "Inside new apps" },
  { name: "Edge", where: "On meters and POS" },
  { name: "Vault", where: "In front of the database" },
];
const CORE = [
  "Algorithm registry",
  "Hybrid KEM (X25519 + ML-KEM)",
  "Sessions (AES-256-GCM)",
  "Envelopes · ML-DSA signatures",
];

export function Architecture() {
  const W = 960;
  const colW = W / ADAPTERS.length;
  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} 420`}
        className="w-full min-w-panel"
        role="img"
        aria-label="Five adapters (Shield, Web, SDK, Edge, Vault) all built on one Q-Setu core: algorithm registry, hybrid KEM, sessions, envelopes and signatures."
        fontFamily="var(--font-geist-sans), sans-serif"
      >
        {/* adapters */}
        {ADAPTERS.map((a, i) => {
          const x = i * colW + 8;
          return (
            <g key={a.name}>
              <rect
                x={x}
                y={8}
                width={colW - 16}
                height={92}
                rx={12}
                fill="var(--bg-raised)"
                stroke="var(--line-strong)"
              />
              <text x={x + 16} y={44} fill="var(--text)" fontSize={18} fontWeight={500}>
                Q-Setu {a.name}
              </text>
              <text x={x + 16} y={72} fill="var(--text-3)" fontSize={13}>
                {a.where}
              </text>
              <line
                x1={x + (colW - 16) / 2}
                y1={100}
                x2={x + (colW - 16) / 2}
                y2={168}
                stroke="var(--line-strong)"
                strokeDasharray="3 4"
              />
            </g>
          );
        })}
        {/* core */}
        <rect
          x={8}
          y={168}
          width={W - 16}
          height={160}
          rx={12}
          fill="var(--bg-inset)"
          stroke="var(--line-strong)"
        />
        <text
          x={28}
          y={200}
          fill="var(--text-3)"
          fontSize={12}
          letterSpacing="0.08em"
          fontFamily="var(--font-geist-mono), monospace"
        >
          @QSETU/CORE · ONE CORE
        </text>
        {CORE.map((c, i) => {
          const cw = (W - 56) / CORE.length;
          const x = 28 + i * cw;
          return (
            <g key={c}>
              <rect
                x={x}
                y={218}
                width={cw - 12}
                height={86}
                rx={6}
                fill="var(--bg-raised)"
                stroke="var(--line)"
              />
              <text x={x + 14} y={252} fill="var(--text)" fontSize={14}>
                {c.split(" (")[0]}
              </text>
              {c.includes("(") && (
                <text x={x + 14} y={276} fill="var(--text-3)" fontSize={12}>
                  {`(${c.split(" (")[1]}`}
                </text>
              )}
            </g>
          );
        })}
        {/* libraries */}
        <rect x={8} y={352} width={W - 16} height={56} rx={12} fill="none" stroke="var(--line)" />
        <text x={28} y={386} fill="var(--text-2)" fontSize={14}>
          @noble/post-quantum · @noble/curves · @noble/hashes · @noble/ciphers (open-source
          primitives; audit status on /security)
        </text>
      </svg>
      <figcaption className="mt-3 font-mono text-label uppercase text-fg-3">
        Switching algorithms is a registry change. Every adapter follows.
      </figcaption>
    </figure>
  );
}
