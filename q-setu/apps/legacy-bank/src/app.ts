/**
 * A deliberately ordinary Express app standing in for a legacy core-banking / hospital / university
 * API. It has no QuantumLedger code: Shield nodes in front of it make its traffic quantum-safe.
 */
import express, { type RequestHandler } from "express";

/**
 * The bank's one page: an account overview, served as a 2000s-era site would serve it. Fictional
 * bank, fictional people; no sign-in form. The Shield scene shows a capture of it on its browser window.
 */
const HOME = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ledgerwood Co-operative Bank · NetBanking</title>
<style>body{margin:0;font:14px/1.45 Verdana,Geneva,sans-serif;color:#1d2433;background:#e9edf3}
header{background:#1f3b6d;color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
header b{font:bold 20px Georgia,serif}nav{background:#d7deea;padding:8px 24px;font-size:13px}nav a{color:#1f3b6d;margin-right:18px}
main{max-width:880px;margin:20px auto;background:#fff;border:1px solid #b9c3d3;padding:20px 24px}
h1{font:bold 17px Georgia,serif;margin:0 0 12px}table{width:100%;border-collapse:collapse;margin-top:8px}
td,th{border-bottom:1px solid #dde3ec;padding:7px 4px;text-align:left}th{background:#f1f4f9;font-size:12px}
.amt{text-align:right;font-family:Courier New,monospace}.bal{font:bold 26px Georgia,serif;color:#1f3b6d}
footer{text-align:center;font-size:11px;color:#5b6576;padding:16px}</style></head><body>
<header><b>Ledgerwood Co-operative Bank</b><span>NetBanking · Savings</span></header>
<nav><a href="#">Accounts</a><a href="#">Transfer funds</a><a href="#">UPI</a><a href="#">Statements</a><a href="#">Help</a></nav>
<main><h1>Account overview</h1><p>Savings account XXXX-XXXX-4417 · Kalyani Nagar branch</p>
<p class="bal">₹ 2,48,310.50</p>
<table><tr><th>Date</th><th>Description</th><th class="amt">Amount (₹)</th></tr>
<tr><td>12-10</td><td>UPI · grocer@okledgerwood</td><td class="amt">-1,240.00</td></tr>
<tr><td>11-10</td><td>Salary credit · NEFT</td><td class="amt">+86,500.00</td></tr>
<tr><td>09-10</td><td>Electricity bill · BBPS</td><td class="amt">-2,315.00</td></tr>
<tr><td>07-10</td><td>UPI · school-fees@ledgerwood</td><td class="amt">-18,000.00</td></tr></table></main>
<footer>Ledgerwood Co-operative Bank is a fictional bank in the QuantumLedger demo. Core system version 1998.4.</footer>
</body></html>`;

export function createLegacyApp(
  log: (line: string) => void = console.log,
  /**
   * Middleware installed in front of every route: how "one line of code" adds Shield
   * (`app.use(shield(...))`) without touching anything else in the app.
   */
  opts: { use?: RequestHandler[] } = {},
) {
  const app = express();
  for (const m of opts.use ?? []) app.use(m);
  app.use(express.json());
  app.use((req, _res, next) => {
    log(`[legacy-app] ${req.method} ${req.path} (plain HTTP, unaware of QuantumLedger)`);
    next();
  });

  app.get("/", (_req, res) => {
    res.type("html").send(HOME);
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
