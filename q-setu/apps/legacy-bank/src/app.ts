/**
 * A deliberately ordinary Express app standing in for a legacy core-banking
 * API. It has no QuantumLedger code: Shield nodes in front of it make its traffic quantum-safe.
 */
import express from "express";

export function createLegacyApp(log: (line: string) => void = console.log) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    log(`[legacy-app] ${req.method} ${req.path} (plain HTTP, unaware of QuantumLedger)`);
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, app: "legacy-core", version: "1998.4" });
  });

  // Fintech: UPI-style transfer
  app.post("/api/transfer", (req, res) => {
    const { payerVPA, payeeVPA, amountINR } = req.body ?? {};
    res.json({
      status: "SUCCESS",
      rrn: String(Date.now()).slice(-12),
      payerVPA,
      payeeVPA,
      amountINR,
    });
  });

  return app;
}
