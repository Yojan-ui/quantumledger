import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/lib/brand/mark";
import { serverToken } from "@/lib/brand/tokens-server";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** apple-touch-icon: the monogram, full bleed on --bg (iOS rounds the corners). */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: serverToken("--bg"),
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 24 24"
        fill="none"
        stroke={serverToken("--text")}
        strokeWidth="1.4"
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
