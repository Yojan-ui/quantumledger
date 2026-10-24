import type { Config } from "tailwindcss";

/**
 * Design system. `theme` (not `extend`) replaces Tailwind's defaults, so only these colours, sizes,
 * weights, spaces, radii and durations exist. Values live in styles/tokens.css.
 */
const px = (n: number) => `${n}px`;
/** Type sizes scale with --type-scale (1 normally; 1.15 in presenter mode), layout doesn't. */
const tpx = (n: number) => `calc(${n}px * var(--type-scale, 1))`;
// An 8px rhythm (the 4px half-steps are kept for borders and fine alignment). Sections sit
// 160 / 120 / 80 px apart by breakpoint: each pads half of that above and below (spacing 20/15/10).
const space = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 24, 30, 32, 40].map((k) => [k, px(k * 4)]),
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
      glass: "var(--glass)",
      "line-strong": "var(--line-strong)",
      fg: "var(--text)",
      "fg-2": "var(--text-2)",
      "fg-3": "var(--text-3)",
      accent: "var(--accent)",
      warn: "var(--warn)",
      kem: "var(--kem)",
      sig: "var(--sig)",
      ok: "var(--ok)",
      danger: "var(--danger)",
    },
    fontFamily: {
      sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
    },
    /**
     * One modular scale, ratio 1.25 from an 18px body: 14 · 18 · 22 · 28 · 35 · 44 · 56 · 88 (display).
     * Display steps track -0.03em at line-height 1.0 and stop at 88px. `lead` is the subhead step
     * between a headline and body copy.
     */
    fontSize: {
      /** The homepage hero headline: 48 px on phones to 88 px on wide screens. */
      hero: [
        "calc(clamp(48px, 6.4vw, 88px) * var(--type-scale, 1))",
        { lineHeight: "1", letterSpacing: "-0.03em" },
      ],
      /** One key number per section, set huge (the sentence sits beside it). */
      mega: [tpx(160), { lineHeight: "0.86", letterSpacing: "-0.055em" }],
      "mega-sm": [tpx(96), { lineHeight: "0.9", letterSpacing: "-0.05em" }],
      display: [tpx(88), { lineHeight: tpx(88), letterSpacing: "-0.03em" }],
      "display-sm": [tpx(56), { lineHeight: tpx(56), letterSpacing: "-0.03em" }],
      h1: [tpx(56), { lineHeight: tpx(58), letterSpacing: "-0.03em" }],
      "h1-sm": [tpx(35), { lineHeight: tpx(38), letterSpacing: "-0.03em" }],
      h2: [tpx(44), { lineHeight: tpx(48), letterSpacing: "-0.03em" }],
      h3: [tpx(28), { lineHeight: tpx(34), letterSpacing: "-0.015em" }],
      /** The subhead step: between a headline and body copy. */
      lead: [tpx(22), { lineHeight: tpx(32), letterSpacing: "-0.01em" }],
      body: [tpx(18), { lineHeight: tpx(28) }],
      small: [tpx(14), { lineHeight: tpx(22) }],
      label: [tpx(12), { lineHeight: tpx(16), letterSpacing: "0.08em" }],
      /** HUD readouts: 11px mono, uppercase. */
      micro: [tpx(11), { lineHeight: tpx(16), letterSpacing: "0.08em" }],
    },
    fontWeight: { normal: "400", medium: "500" },
    spacing: { px: "1px", ...space },
    borderRadius: { none: "0", sm: px(4), lg: px(8), full: "9999px" },
    borderWidth: { 0: "0", DEFAULT: "1px" },
    boxShadow: { none: "none" },
    transitionDuration: { 150: "var(--dur-hover)", 300: "var(--dur-ui)", 700: "var(--dur-reveal)" },
    // Hover and focus ease out; the spring stays for motion that should overshoot (spring-*).
    transitionTimingFunction: {
      DEFAULT: "var(--ease)",
      ease: "var(--ease)",
      spring: "var(--ease-spring)",
    },
    extend: {
      /** text: a headline or text column (5 of 12 columns); prose: body copy, 62 characters. */
      maxWidth: { container: px(1200), text: px(600), prose: "62ch", label: px(320) },
      /** The 6px LIVE dot. */
      width: { dot: px(6), console: px(360), socket: px(120) },
      height: {
        stage: px(560),
        /** A demo's full-width stage: 70% of the screen (at least the stage height). */
        "stage-full": "70svh",
        /** The diagnostics stage on phones: the top 60% of the screen. */
        "hud-stage": "60svh",
        /** The compact HUD in the homepage hero. */
        "hud-compact": px(720),
        "stage-sm": px(360),
        globe: px(300),
        nav: px(56),
        svh: "100svh",
        story: "calc(100svh - 56px)",
        /** The homepage hero: the whole first screen under the nav. */
        hero: "calc(100svh - 56px)",
        dot: px(6),
        console: px(560),
        socket: px(120),
      },
      minHeight: {
        svh: "100svh",
        stage: px(560),
        panel: px(320),
        story: "calc(100svh - 56px)",
        hero: px(640),
      },
      minWidth: { panel: px(640) },
      maxHeight: { "stage-sm": px(360) },
      gridTemplateColumns: {
        demo: "320px minmax(0, 1fr)",
        "demo-console": "320px minmax(0, 1fr) 360px",
        split: "minmax(0, 1fr) 360px",
        /** The diagnostics HUD: diagnostics · stage · terminal and risk. */
        hud: "300px minmax(0, 1fr) 340px",
        "hud-compact": "260px minmax(0, 1fr) 300px",
        /** A key column and its value (the Proof Chain's entry panel). */
        entry: "96px minmax(0, 1fr)",
        keys: "128px minmax(0, 1fr)",
        /** The HUD terminal: time · verb · subject · value. */
        term: "56px 64px minmax(0, 1fr) auto",
      },
      keyframes: {
        reveal: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "none" },
        },
        /** Headline lines rise out of a mask. */
        "mask-up": { from: { transform: "translateY(105%)" }, to: { transform: "none" } },
        /** A --bg cover lifts off text that is already painted (keeps LCP at first paint). */
        uncover: { from: { transform: "none" }, to: { transform: "translateY(-101%)" } },
        /** Ticker lines slide in from below. */
        "tick-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        /** The scan score ring fills from empty. */
        ring: { from: { strokeDashoffset: "var(--ring-from)" } },
        /** Skeleton shimmer: an opacity breath on placeholder blocks. */
        skeleton: { "0%, 100%": { opacity: "0.5" }, "50%": { opacity: "1" } },
        /** The LIVE dot: a slow opacity breath, never a scale. */
        live: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        /** The terminal's block cursor. */
        blink: { "0%, 49%": { opacity: "1" }, "50%, 100%": { opacity: "0" } },
      },
      animation: {
        reveal: "reveal var(--dur-reveal) var(--ease) both",
        "mask-up": "mask-up var(--dur-reveal) var(--ease) both",
        "tick-in": "tick-in var(--dur-ui) var(--ease) both",
        uncover: "uncover var(--dur-reveal) var(--ease) both",
        // A few pulses when it appears, then still (nothing loops while the reader reads).
        live: "live 2s var(--ease) 3",
        blink: "blink 1s steps(1) infinite",
        ring: "ring var(--dur-reveal) var(--ease) both",
        skeleton: "skeleton 1.4s var(--ease) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
