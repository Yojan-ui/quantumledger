/**
 * Detection rules for the Quantum Readiness Scanner. Each rule is a regex plus advice.
 * Boundaries are hand-rolled (`B`/`E`) because `\b` treats "_" as a word character, and
 * TLS suite names like TLS_DHE_RSA_… must still match.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Primitive =
  "pke" | "signature" | "key-agree" | "kem" | "hash" | "block-cipher" | "protocol";

export interface Rule {
  id: string;
  algorithm: string;
  primitive: Primitive;
  severity: Severity;
  quantumVulnerable: boolean;
  /** Set to true for rules that detect already-quantum-safe crypto (reported as info). */
  quantumSafe?: boolean;
  pattern: RegExp;
  why: string;
  replacement: string;
  /** Optionally pull a parameter (key size, curve) out of the matched line. */
  parameter?: (line: string) => string | undefined;
}

const B = "(?<![A-Za-z0-9])";
const E = "(?![A-Za-z0-9])";
/** Case-sensitive by default: bare acronyms are uppercase in real configs, and lowercase
 * API spellings are listed explicitly. That keeps variable names like `ecdh` from matching. */
const re = (src: string, flags = "g") => new RegExp(src, flags);

const rsaBits = (line: string) =>
  /(?:RSA[^0-9\n]{0,24}|modulusLength\W{0,4}|keysize\W{0,4}|\()(1024|2048|3072|4096|8192)(?:\s*bit)?/i.exec(
    line,
  )?.[1];

const curveName = (line: string) =>
  /(secp256r1|prime256v1|secp384r1|secp521r1|secp256k1|P-256|P-384|P-521|X25519|Curve25519)/i.exec(
    line,
  )?.[1];

export const RULES: Rule[] = [
  {
    id: "rsa",
    algorithm: "RSA",
    primitive: "pke",
    severity: "critical",
    quantumVulnerable: true,
    pattern: re(
      `${B}RSA(?:[-_/]?(?:OAEP|PSS|SHA-?\\d+|PKCS1|ECB|\\d{3,4}))*${E}|rsaEncryption|[Ww]ith-?RSA(?:Encryption)?|ssh-rsa|['"]rsa(?:-sha\\d+)?['"]|${B}RS(?:256|384|512)${E}`,
    ),
    why: "RSA's security rests on integer factoring, which Shor's algorithm solves in polynomial time. Recorded traffic can be decrypted after Q-Day.",
    replacement: "ML-KEM-768 (FIPS 203) for key transport; ML-DSA-65 (FIPS 204) for signatures",
    parameter: rsaBits,
  },
  {
    id: "ecdsa",
    algorithm: "ECDSA",
    primitive: "signature",
    severity: "high",
    quantumVulnerable: true,
    pattern: re(
      `${B}ECDSA${E}|ecdsa-with-SHA\\d+|[Ww]ith-?ECDSA|id-ecPublicKey|BEGIN EC PRIVATE KEY|${B}ES(?:256|384|512)${E}|ecdsa-sha2-nistp\\d+|['"]ecdsa['"]`,
    ),
    why: "Elliptic-curve discrete logs fall to Shor's algorithm, so signatures can be forged once a quantum computer exists.",
    replacement: "ML-DSA-65 (FIPS 204); SLH-DSA (FIPS 205) for long-lived roots",
    parameter: curveName,
  },
  {
    id: "ecdh",
    algorithm: "ECDH",
    primitive: "key-agree",
    severity: "high",
    quantumVulnerable: true,
    pattern: re(
      `${B}ECDHE?${E}|${B}X25519${E}|${B}[Cc]urve25519${E}|createECDH|['"]x25519['"]|['"]ecdh['"]`,
    ),
    why: "ECDH key agreement is broken by Shor's algorithm, so session keys in harvested traffic can be recovered later.",
    replacement: "Hybrid X25519 + ML-KEM-768 (TLS group X25519MLKEM768)",
    parameter: curveName,
  },
  {
    id: "dh",
    algorithm: "Diffie-Hellman",
    primitive: "key-agree",
    severity: "high",
    quantumVulnerable: true,
    pattern: re(
      `${B}DHE?${E}|[Dd]iffie-?[Hh]ellman|createDiffieHellman|${B}ffdhe\\d+${E}|${B}modp\\d+${E}|dhparam`,
    ),
    why: "Finite-field Diffie-Hellman relies on discrete logs, which Shor's algorithm breaks.",
    replacement: "ML-KEM-768 (FIPS 203), deployed as a hybrid during transition",
  },
  {
    id: "dsa",
    algorithm: "DSA",
    primitive: "signature",
    severity: "high",
    quantumVulnerable: true,
    pattern: re(`(?<![A-Za-z0-9]|ML-|SLH-)DSA${E}(?!-\\d)|[Ww]ith-?DSA|ssh-dss|['"]dsa['"]`),
    why: "DSA is a discrete-log signature, quantum-vulnerable and already withdrawn by FIPS 186-5.",
    replacement: "ML-DSA-65 (FIPS 204)",
  },
  {
    id: "sha1",
    algorithm: "SHA-1",
    primitive: "hash",
    severity: "medium",
    quantumVulnerable: false,
    pattern: re(`${B}(?:SHA|sha)-?1${E}|sha1With|HmacSHA1`),
    why: "SHA-1 collisions are practical today (SHAttered, 2017). It is classically broken, not just a quantum risk.",
    replacement: "SHA-256 or SHA3-256",
  },
  {
    id: "3des",
    algorithm: "3DES",
    primitive: "block-cipher",
    severity: "medium",
    quantumVulnerable: false,
    pattern: re(`${B}3DES${E}|DES[-_]?EDE3?|[Dd]es-ede3|DESede|TripleDES|${B}TDEA${E}`),
    why: "3DES's 64-bit block is vulnerable to Sweet32, and NIST disallowed it after 2023. Grover's algorithm weakens it further.",
    replacement: "AES-256-GCM",
  },
  {
    id: "legacy-tls",
    algorithm: "Legacy TLS/SSL",
    primitive: "protocol",
    severity: "high",
    quantumVulnerable: true,
    pattern: re(`${B}SSLv[23]${E}|${B}TLSv1(?:\\.[01])?${E}(?!\\.[23])|${B}TLS1[._]?[01]${E}`),
    why: "SSL 3.0, TLS 1.0 and TLS 1.1 are deprecated (RFC 8996) and can't negotiate hybrid post-quantum key exchange.",
    replacement: "TLS 1.3 with the X25519MLKEM768 hybrid group",
  },
  {
    id: "pqc",
    algorithm: "Post-quantum algorithm",
    primitive: "kem",
    severity: "info",
    quantumVulnerable: false,
    quantumSafe: true,
    pattern: re(
      `ML[-_]?KEM(?:[-_]?\\d+)?|ML[-_]?DSA(?:[-_]?\\d+)?|SLH[-_]?DSA[\\w-]*|X25519MLKEM768|${B}Kyber\\d*${E}|${B}Dilithium\\d*${E}`,
      "gi",
    ),
    why: "Quantum-safe algorithm detected (NIST FIPS 203/204/205 family).",
    replacement: "No change needed. Confirm the parameter sets are NIST category 3 or higher.",
  },
];

/** TLS cipher suites (IANA and OpenSSL names) are analysed as one unit. */
export const TLS_SUITE =
  /(?<![A-Za-z0-9])(?:TLS|SSL)_[A-Z0-9_]{6,}|(?<![A-Za-z0-9-])(?:ECDHE|DHE|ECDH|EDH|AES\d{3}|RSA|DES|RC4)(?:-[A-Z0-9]+){2,}/g;
