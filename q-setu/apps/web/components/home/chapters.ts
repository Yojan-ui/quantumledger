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

export const CHAPTERS: Chapter[] = [
  {
    id: "hero",
    label: "Post-quantum security for India",
    title: "Make anything in India quantum\u2011safe. In one line.",
    body: "Your data is being harvested today. Q-Setu makes any system in India quantum-safe in one line, before Q-Day.",
    accent: "accent",
  },
  {
    id: "seal",
    label: "Seal it yourself",
    title: "Seal a message in your browser.",
    body: "Type anything. It is encrypted here with X25519 + ML-KEM-768, then leaves as a single pulse.",
    accent: "accent",
  },
  {
    id: "harvest",
    label: "Harvest now",
    title: "Encrypted today, recorded today.",
    body: "Adversaries copy traffic now and wait. Each pulse on the arcs is a real packet being recorded.",
    accent: "warn",
  },
  {
    id: "qday",
    label: "Decrypt later",
    title: "At Q-Day, recordings open.",
    body: "Shor’s algorithm breaks RSA and elliptic curves. This is recorded classical traffic, decrypted in your browser.",
    accent: "warn",
  },
  {
    id: "sockets",
    label: "One line, anywhere",
    title: "Five adapters. One core.",
    body: "A sidecar, a script tag, an SDK, a device profile and a vault. Each takes one line to adopt.",
    accent: "accent",
  },
  {
    id: "india",
    label: "India, protected",
    title: "Banks to substations, one by one.",
    body: "Each node switches to hybrid ML-KEM and ML-DSA. Hover a node to see what it protects.",
    accent: "accent",
  },
  {
    id: "cost",
    label: "Cost, measured",
    title: "Pay once per session.",
    body: "The post-quantum handshake runs once. Every message after it is AES-256-GCM.",
    accent: "accent",
  },
  {
    id: "close",
    label: "Every arc, sealed",
    title: "Recorded traffic stays noise.",
    body: "When every link speaks Q-Setu, there is nothing left worth harvesting.",
    accent: "accent",
  },
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
    code: "await vault.put(labReport)",
  },
] as const;

export const SECTOR_NOTES: Record<string, { kem: string; dsa: string }> = {
  fintech: {
    kem: "bank-to-switch links and app-to-bank APIs",
    dsa: "transaction signing and mandates",
  },
  healthcare: {
    kem: "hospital-to-exchange transfers and records at rest",
    dsa: "signed lab reports and prescriptions",
  },
  education: { kem: "student-data transfers", dsa: "university-signed certificates" },
};
