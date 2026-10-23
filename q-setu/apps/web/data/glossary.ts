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
  hndl: "HNDL (harvest now, decrypt later): data stolen today and decrypted later by a quantum computer.",
  tls: "TLS: the lock in the address bar. It protects the connection between your browser and a website.",
  rsa: "RSA-2048: a widely used key for proving identity and locking data. A large quantum computer could break it.",
  x25519:
    "X25519: today's standard way to agree a secret key. Fast and safe now, breakable by a future quantum computer.",
  aes: "AES-256-GCM: the fast lock for the data itself. Quantum computers don't meaningfully weaken it.",
  lattice:
    "Lattice: a huge grid of points in many dimensions. Finding the hidden point is hard even for quantum computers.",
  kem: "KEM (key encapsulation): how two computers agree a secret key over an open network. ML-KEM is the quantum-safe kind.",
  cbom: "CBOM: a cryptography bill of materials, a list of every lock and key a system uses, so you know what to replace.",
  mosca:
    "Mosca’s rule: if the years your data must stay secret plus the years you need to upgrade add up to more than the years until a quantum computer arrives, you are already late.",
  sid: "SID: the session ID, a short name for one secure connection so you can find it in the logs.",
  nodes: "Nodes: how many live network links are running under the current security setting.",
  l1: "L1: the lightest quantum-safe setting (ML-KEM-512), about as hard to break as a 128-bit key. Made for small devices.",
  l3: "L3: the standard quantum-safe setting (ML-KEM-768), about as hard to break as a 192-bit key.",
  l5: "L5: the strongest quantum-safe setting (ML-KEM-1024), about as hard to break as a 256-bit key.",
} as const;

export type TermId = keyof typeof GLOSSARY;
