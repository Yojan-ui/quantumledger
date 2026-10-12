/** One-line plain explanations for the dotted-underlined terms (no acronyms in the answers). */
export const GLOSSARY = {
  "ml-kem":
    "ML-KEM: the new standard way for two computers to agree a secret key that a quantum computer can't recover (NIST FIPS 203).",
  "ml-dsa":
    "ML-DSA: the new standard digital signature, proof of who sent something, that a quantum computer can't forge (NIST FIPS 204).",
  hybrid:
    "Hybrid: today's proven lock and the new quantum-safe lock used together. An attacker has to break both.",
  "q-day":
    "Q-Day: the day a quantum computer becomes strong enough to break the locks most of the internet uses today.",
  hndl: "Harvest now, decrypt later: recording locked data today and keeping it until a quantum computer can open it.",
  tls: "TLS: the lock in the address bar. It protects the connection between your browser and a website.",
  rsa: "RSA-2048: a widely used key for proving identity and locking data. A large quantum computer could break it.",
  x25519:
    "X25519: today's standard way to agree a secret key. Fast and safe now, breakable by a future quantum computer.",
  aes: "AES-256-GCM: the fast lock for the data itself. Quantum computers don't meaningfully weaken it.",
  lattice:
    "Lattice: a huge grid of points in many dimensions. Finding the hidden point is hard even for quantum computers.",
} as const;

export type TermId = keyof typeof GLOSSARY;
