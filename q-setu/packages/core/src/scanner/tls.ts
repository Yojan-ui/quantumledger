/** Breaks a TLS cipher-suite name into its components and grades its quantum risk. */
import type { Severity } from "./rules";

export interface SuiteAnalysis {
  suite: string;
  keyExchange: string;
  authentication: string;
  cipher: string;
  severity: Severity;
  quantumVulnerable: boolean;
  why: string;
}

const RANK: Severity[] = ["info", "low", "medium", "high", "critical"];
const worst = (a: Severity, b: Severity) => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b);

export function analyzeSuite(suite: string): SuiteAnalysis {
  const s = suite.toUpperCase().replace(/-/g, "_");
  const isTls13 = /^TLS_(AES|CHACHA20|SM4)/.test(s);

  let keyExchange = "unknown";
  if (isTls13) keyExchange = "negotiated via supported_groups";
  else if (/(^|_)ECDHE?(_|$)/.test(s)) keyExchange = "ECDHE";
  else if (/(^|_)(DHE|EDH)(_|$)/.test(s)) keyExchange = "DHE";
  else if (/^(TLS|SSL)_RSA_|^(AES|DES|RC4|RSA|CAMELLIA)/.test(s)) keyExchange = "RSA key transport";

  let authentication = isTls13 ? "certificate (separate)" : "unknown";
  if (/ECDSA/.test(s)) authentication = "ECDSA";
  else if (/RSA/.test(s)) authentication = "RSA";
  else if (/DSS/.test(s)) authentication = "DSA";

  const cipher = /3DES|DES_EDE|DES_CBC3/.test(s)
    ? "3DES"
    : /RC4/.test(s)
      ? "RC4"
      : /(^|_)DES(_|$)/.test(s)
        ? "DES"
        : /AES_?256|AES256/.test(s)
          ? "AES-256"
          : /AES_?128|AES128/.test(s)
            ? "AES-128"
            : /CHACHA20/.test(s)
              ? "ChaCha20-Poly1305"
              : "unknown";

  let severity: Severity = "low";
  const reasons: string[] = [];
  if (isTls13) {
    reasons.push(
      "TLS 1.3 suite. The key exchange is chosen separately, so make sure the X25519MLKEM768 group is enabled.",
    );
  }
  if (keyExchange === "RSA key transport") {
    severity = worst(severity, "critical");
    reasons.push(
      "RSA key transport has no forward secrecy, and Shor's algorithm decrypts every recorded session.",
    );
  } else if (keyExchange === "ECDHE" || keyExchange === "DHE") {
    severity = worst(severity, "high");
    reasons.push(
      `${keyExchange} key exchange is breakable by Shor's algorithm (harvest now, decrypt later).`,
    );
  }
  if (["RSA", "ECDSA", "DSA"].includes(authentication)) {
    severity = worst(severity, "high");
    reasons.push(`${authentication} authentication is quantum-vulnerable.`);
  }
  if (["3DES", "RC4", "DES"].includes(cipher)) {
    severity = worst(severity, "critical");
    reasons.push(`${cipher} is classically broken.`);
  }
  if (/_SHA$/.test(s)) {
    severity = worst(severity, "medium");
    reasons.push("Uses an HMAC-SHA-1 record MAC.");
  }

  return {
    suite,
    keyExchange,
    authentication,
    cipher,
    severity,
    quantumVulnerable: !isTls13,
    why: reasons.join(" ") || "No quantum-relevant weakness identified.",
  };
}
