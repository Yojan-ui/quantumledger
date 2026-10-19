/**
 * Security alerts: one structured log line, and a POST to ALERT_WEBHOOK_URL if it is set (Slack,
 * Discord, PagerDuty or any endpoint that takes JSON). Best effort: an alert that can't be delivered
 * never affects the request that caused it. Carries no secrets and no raw IPs (hashed, as in logs).
 */
export async function alert(kind: string, detail: Record<string, unknown>): Promise<void> {
  const event = { t: new Date().toISOString(), alert: kind, ...detail };
  process.stdout.write(`${JSON.stringify(event)}\n`);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || !/^https:\/\//.test(url)) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `QuantumLedger security alert: ${kind}`, ...event }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // delivery is best effort
  }
}
