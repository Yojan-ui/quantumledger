/** @type {import('tailwindcss').Config} */
// Tailwind sits on top of the hand-written terminal stylesheet (src/styles.css),
// so preflight is off: it would reset the existing table / button / type rules.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        obsidian: "#08090C",
        panel: "#0D1117",
        hairline: "#1F242C",
        hairline2: "#2A313B",
        ink: { DEFAULT: "#C9D1D9", hi: "#E6EDF3", dim: "#7D8590", mute: "#4B535D" },
        secure: "#10B981",
        breach: "#EF4444",
        telemetry: "#06B6D4",
      },
      fontFamily: { mono: ['"JetBrains Mono"', '"Geist Mono"', "ui-monospace", "Menlo", "monospace"] },
    },
  },
  plugins: [],
};
