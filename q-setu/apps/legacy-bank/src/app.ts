/**
 * A deliberately ordinary Express app standing in for a legacy core-banking / hospital / university
 * API. It has no Q-Setu code: Shield nodes in front of it make its traffic quantum-safe.
 */
import express from "express";

export function createLegacyApp(log: (line: string) => void = console.log) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    log(`[legacy-app] ${req.method} ${req.path} (plain HTTP, unaware of Q-Setu)`);
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

  // Healthcare: lab report hand-off
  app.post("/api/lab-reports", (req, res) => {
    res.json({ status: "RECEIVED", reportId: req.body?.reportId, facility: "Sahyadri Clinic" });
  });

  // Education: certificate issuance record
  app.post("/api/certificates", (req, res) => {
    res.json({ status: "RECORDED", certificateId: req.body?.certificateId });
  });

  return app;
}
