/** Story copy. Titles stay under ~8 words; bodies under two lines at 560px. */
export type Accent = "accent" | "warn";

export interface Chapter {
  id: string;
  label: string;
  title: string;
  body: string;
  /** The one accent colour this chapter is allowed to show (globe arcs and pulses follow it). */
  accent: Accent;
}

export const HERO = {
  title: "Bank migration, backed by evidence.",
  /** The brief's subline, shown in both copy modes (its one acronym, NIST, is deliberate). */
  body: "Find vulnerable cryptography, compare migration plans and verify the evidence. Follow the banking pipeline from scan to signed review.",
  technical:
    "Find vulnerable cryptography, compare migration plans and verify the evidence. Follow the banking pipeline from scan to signed review.",
};

/** "How it works": three pinned steps. `chapter` is the director pose each step uses on the globe. */
export const STEPS: (Chapter & {
  chapter: number;
  role: "warn" | "kem" | "ok";
  simpleTitle: string;
  simpleBody: string;
})[] = [
  {
    id: "recorded",
    label: "Step 1 · Recorded today",
    title: "Encrypted today, recorded today.",
    body: "Adversaries copy encrypted traffic now and wait. Each pulse is a real packet on this network.",
    simpleTitle: "Copied today, kept for later.",
    simpleBody:
      "Someone can copy locked messages as they travel and keep them. Each pulse is a real message on this network.",
    accent: "warn",
    chapter: 2.3,
    role: "warn",
  },
  {
    id: "opened",
    label: "Step 2 · Opened at Q-Day",
    title: "At Q-Day, the recordings open.",
    body: "Shor’s algorithm breaks RSA and elliptic curves. Watch recorded classical traffic decrypt in your browser.",
    simpleTitle: "One day, the copies open.",
    simpleBody:
      "When a big enough quantum computer exists, those copies can be unlocked. Watch it happen to old-style locks, in your browser.",
    accent: "warn",
    chapter: 3.3,
    role: "warn",
  },
  {
    id: "sealed",
    label: "Step 3 · Sealed with QuantumLedger",
    title: "With QuantumLedger, they stay noise.",
    body: "A hybrid X25519 + ML-KEM-768 handshake, once per session. Every message after it is AES-256-GCM.",
    simpleTitle: "With QuantumLedger, the copies stay useless.",
    simpleBody:
      "QuantumLedger adds a new lock that even a quantum computer can't open, once per connection. Everything sent after it stays scrambled.",
    accent: "accent",
    chapter: 7.3,
    role: "kem",
  },
];

/** @deprecated kept for the sr-only summary and older imports. */
export const CHAPTERS: Chapter[] = [
  {
    id: "hero",
    label: "Post-quantum security for India",
    title: HERO.title,
    body: HERO.body,
    accent: "accent",
  },
  ...STEPS,
];

export const ADAPTERS = [
  {
    id: "shield",
    name: "Shield",
    desc: "Sidecar proxy for any server or API. Zero code change.",
    code: "npx qsetu-shield --upstream http://localhost:4000 --listen 8443",
  },
  {
    id: "web",
    name: "Web",
    desc: "One script tag seals forms and fetch calls in the browser.",
    code: '<script src="/qsetu.js" data-key="af29da952c68ee32" data-endpoint="/api/"></script>',
  },
  {
    id: "sdk",
    name: "SDK",
    desc: "Sessions, envelopes and signatures for Node and the browser.",
    code: "npm i @qsetu/sdk",
  },
  {
    id: "edge",
    name: "Edge",
    desc: "ML-KEM-512 and ML-DSA-44 for meters, monitors and POS.",
    code: 'new EdgeDevice("meter-17", key, gateway, { ramBytes: 65_536 })',
  },
  {
    id: "vault",
    name: "Vault",
    desc: "Per-record keys wrapped with ML-KEM; records signed with ML-DSA.",
    code: "await vault.put(paymentRecord)",
  },
] as const;

export const SECTOR_NOTES: Record<string, { kem: string; dsa: string }> = {
  fintech: {
    kem: "bank-to-switch links and app-to-bank APIs",
    dsa: "transaction signing and mandates",
  },
};
