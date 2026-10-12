import { MARK_PATHS } from "@/lib/brand/mark";
import { serverToken } from "@/lib/brand/tokens-server";

/** The site's OG card: --bg, a mono label, a large headline, the mark. Used by every page and scan. */
export function OgCard({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  const bg = serverToken("--bg");
  const fg = serverToken("--text");
  const fg3 = serverToken("--text-3");
  const line = serverToken("--line-strong");
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: bg,
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: fg, fontSize: 30 }}>
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke={fg}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {MARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        QuantumLedger
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            color: fg3,
            fontSize: 22,
            letterSpacing: 2,
            textTransform: "uppercase",
            fontFamily: "monospace",
          }}
        >
          {label}
        </div>
        <div
          style={{ color: fg, fontSize: 64, lineHeight: 1.08, letterSpacing: -2, maxWidth: 940 }}
        >
          {title}
        </div>
        {children}
      </div>
      <div
        style={{
          display: "flex",
          borderTop: `1px solid ${line}`,
          paddingTop: 20,
          color: fg3,
          fontSize: 22,
        }}
      >
        See your quantum risk. Fix it. Prove it.
      </div>
    </div>
  );
}
