import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Favicon drawn from the design tokens (colours are read from styles/tokens.css at build time). */
function token(name: string): string {
  const css = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");
  return new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? "";
}

export default function Icon() {
  const bg = token("--bg");
  const fg = token("--text");
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        borderRadius: 6,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8">
        <path d="M3 16c3-6 15-6 18 0" />
        <path d="M6 16v3M12 12.5V19M18 16v3" />
      </svg>
    </div>,
    size,
  );
}
