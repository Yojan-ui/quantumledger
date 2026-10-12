/**
 * "Phone in the room": where audience messages appear to come from on the globe, the node they fly
 * to, the visitor colours and the emoji a visitor may pick. No three.js here (the server uses it).
 * The cities are only a visual: a visitor's real location is never asked for or inferred.
 */
export const ROOM_HUB = "QuantumLedger node · Mumbai";
export const HUB: [number, number] = [19.08, 72.88];

export const ROOM_CITIES = [
  { id: "delhi", label: "New Delhi", at: [28.61, 77.21] },
  { id: "bengaluru", label: "Bengaluru", at: [12.97, 77.59] },
  { id: "chennai", label: "Chennai", at: [13.08, 80.27] },
  { id: "hyderabad", label: "Hyderabad", at: [17.39, 78.49] },
  { id: "kolkata", label: "Kolkata", at: [22.57, 88.36] },
  { id: "pune", label: "Pune", at: [18.52, 73.86] },
  { id: "ahmedabad", label: "Ahmedabad", at: [23.02, 72.57] },
  { id: "jaipur", label: "Jaipur", at: [26.91, 75.79] },
  { id: "lucknow", label: "Lucknow", at: [26.85, 80.95] },
  { id: "patna", label: "Patna", at: [25.59, 85.14] },
  { id: "guwahati", label: "Guwahati", at: [26.14, 91.74] },
  { id: "bhubaneswar", label: "Bhubaneswar", at: [20.3, 85.82] },
  { id: "kochi", label: "Kochi", at: [9.93, 76.27] },
  { id: "thiruvananthapuram", label: "Thiruvananthapuram", at: [8.52, 76.94] },
  { id: "chandigarh", label: "Chandigarh", at: [30.73, 76.78] },
  { id: "srinagar", label: "Srinagar", at: [34.08, 74.8] },
  { id: "indore", label: "Indore", at: [22.72, 75.86] },
  { id: "nagpur", label: "Nagpur", at: [21.15, 79.09] },
  { id: "visakhapatnam", label: "Visakhapatnam", at: [17.69, 83.22] },
  { id: "bhopal", label: "Bhopal", at: [23.26, 77.41] },
  { id: "shillong", label: "Shillong", at: [25.58, 91.89] },
  { id: "panaji", label: "Panaji", at: [15.49, 73.83] },
] as const satisfies readonly { id: string; label: string; at: readonly [number, number] }[];

export const roomCity = (id: string) => ROOM_CITIES.find((c) => c.id === id) ?? ROOM_CITIES[0];

/**
 * Visitor colours: role tokens and the gradients between them (encryption → signature → verified).
 * `a`→`b` is the arc's gradient on the globe; the phone's swatch is the mix at `mix` (0 = all `a`).
 */
export const VISITOR_COLOURS = [
  { a: "kem", b: "sig", mix: 0 },
  { a: "sig", b: "kem", mix: 0 },
  { a: "ok", b: "kem", mix: 0 },
  { a: "kem", b: "sig", mix: 0.5 },
  { a: "sig", b: "ok", mix: 0.5 },
  { a: "ok", b: "sig", mix: 0.35 },
] as const satisfies readonly { a: "kem" | "sig" | "ok"; b: "kem" | "sig" | "ok"; mix: number }[];

/** CSS colour for a visitor (role tokens only). */
export function visitorCss(i: number): string {
  const c = VISITOR_COLOURS[i % VISITOR_COLOURS.length]!;
  if (!c.mix) return `var(--${c.a})`;
  return `color-mix(in oklab, var(--${c.a}) ${Math.round((1 - c.mix) * 100)}%, var(--${c.b}))`;
}

/** The fixed emoji a visitor can send. Only these are ever shown on the big screen. */
export const ROOM_EMOJI = ["🔐", "🛡️", "🇮🇳", "🚀", "✅", "🧠", "⚛️", "🔑"] as const;
