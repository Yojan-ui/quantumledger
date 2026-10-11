import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/lib/brand/mark";
import { serverToken } from "@/lib/brand/tokens-server";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Favicon: the monogram on --bg, colours read from styles/tokens.css at build time. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: serverToken("--bg"),
        borderRadius: 7,
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke={serverToken("--text")}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>,
    size,
  );
}
