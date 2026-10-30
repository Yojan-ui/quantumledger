/** The shape /api/scan/url returns (shared with the client; the server type lives in scan-service). */
export interface ScanView {
  probe: {
    host: string;
    address: string;
    protocol: string | null;
    cipher: string;
    group: string;
    hybridPq: boolean;
    certKey: string;
    certSigAlg: string;
    issuer: string;
  };
  score: number;
  grade: string;
  plain: string[];
  geo: { lat: number; lon: number; label: string; source: "lookup" | "fallback" };
  scannedAt: string;
  cached?: boolean;
  plan: { steps: { id: string; priority: string; title: string; fixer: string; effort: string }[] };
  /** The scanner's findings (what the plan and the CBOM are built from). */
  findings: {
    ruleId: string;
    line: number;
    algorithm: string;
    primitive: string;
    severity: string;
    quantumVulnerable: boolean;
    match: string;
  }[];
  /** CycloneDX CBOM for the probed host. */
  cbom: unknown;
}

export const SUGGESTED_HOSTS = [
  "onlinesbi.sbi",
  "www.hdfcbank.com",
  "www.icicibank.com",
  "www.npci.org.in",
  "www.axisbank.com",
];

export const scanDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
