import type { Config } from "tailwindcss";

/**
 * Design system. `theme` (not `extend`) replaces Tailwind's defaults, so only these colours, sizes,
 * weights, spaces, radii and durations exist. Values live in styles/tokens.css.
 */
const px = (n: number) => `${n}px`;
const space = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 24, 32, 40].map((k) => [k, px(k * 4)]),
);

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: { md: "768px", lg: "1024px", xl: "1280px" },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      base: "var(--bg)",
      raised: "var(--bg-raised)",
      inset: "var(--bg-inset)",
      nav: "var(--bg-nav)",
      line: "var(--line)",
      "line-strong": "var(--line-strong)",
      fg: "var(--text)",
      "fg-2": "var(--text-2)",
      "fg-3": "var(--text-3)",
      accent: "var(--accent)",
      warn: "var(--warn)",
    },
    fontFamily: {
      sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
    },
    fontSize: {
      display: [px(72), { lineHeight: px(76), letterSpacing: "-0.035em" }],
      "display-sm": [px(44), { lineHeight: px(48), letterSpacing: "-0.035em" }],
      h1: [px(48), { lineHeight: px(52), letterSpacing: "-0.03em" }],
      "h1-sm": [px(34), { lineHeight: px(38), letterSpacing: "-0.03em" }],
      h2: [px(28), { lineHeight: px(34), letterSpacing: "-0.02em" }],
      h3: [px(18), { lineHeight: px(26), letterSpacing: "-0.01em" }],
      body: [px(16), { lineHeight: px(26) }],
      small: [px(14), { lineHeight: px(22) }],
      label: [px(12), { lineHeight: px(16), letterSpacing: "0.08em" }],
    },
    fontWeight: { normal: "400", medium: "500" },
    spacing: { px: "1px", ...space },
    borderRadius: { none: "0", sm: px(6), lg: px(12), full: "9999px" },
    borderWidth: { 0: "0", DEFAULT: "1px" },
    boxShadow: { none: "none" },
    backdropBlur: { nav: px(12) },
    transitionDuration: { 150: "var(--dur-hover)", 300: "var(--dur-ui)", 700: "var(--dur-reveal)" },
    transitionTimingFunction: { DEFAULT: "var(--ease)" },
    extend: {
      maxWidth: { container: px(1200), text: px(560) },
      /** The 6px LIVE dot. */
      width: { dot: px(6), console: px(360) },
      height: {
        stage: px(560),
        "stage-sm": px(360),
        globe: px(300),
        nav: px(56),
        svh: "100svh",
        story: "calc(100svh - 56px)",
        dot: px(6),
        console: px(560),
      },
      minHeight: { svh: "100svh", stage: px(560), panel: px(320), story: "calc(100svh - 56px)" },
      minWidth: { panel: px(640) },
      maxHeight: { "stage-sm": px(360) },
      gridTemplateColumns: {
        demo: "320px minmax(0, 1fr)",
        "demo-console": "320px minmax(0, 1fr) 360px",
        split: "minmax(0, 1fr) 360px",
      },
      keyframes: {
        reveal: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "none" },
        },
        /** Headline lines rise out of a mask. */
        "mask-up": { from: { transform: "translateY(105%)" }, to: { transform: "none" } },
        /** Ticker lines slide in from below. */
        "tick-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        /** The LIVE dot: a slow opacity breath, never a scale. */
        live: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: {
        reveal: "reveal var(--dur-reveal) var(--ease) both",
        "mask-up": "mask-up var(--dur-reveal) var(--ease) both",
        "tick-in": "tick-in var(--dur-ui) var(--ease) both",
        live: "live 2s var(--ease) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
