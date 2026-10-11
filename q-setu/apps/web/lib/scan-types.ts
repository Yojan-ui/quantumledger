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
}

export const SUGGESTED_HOSTS = [
  "onlinesbi.sbi",
  "www.hdfcbank.com",
  "www.icicibank.com",
  "www.irctc.co.in",
  "www.digilocker.gov.in",
];

export const scanDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
