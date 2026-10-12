import "server-only";

/** Optional confirmation email via Resend's HTTP API. A no-op unless RESEND_API_KEY is set. */
export async function sendConfirmation(to: string, name: string, kind: "early-access" | "contact") {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.RESEND_FROM ?? "QuantumLedger <hello@quantumledger.example>";
  const subject =
    kind === "contact" ? "We got your message" : "You're on the QuantumLedger early-access list";
  const text = `Hi ${name},\n\nThanks for writing to QuantumLedger. We read every request ourselves and will reply within two working days.\n\nQuantumLedger`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
    signal: AbortSignal.timeout(5000),
  });
}
