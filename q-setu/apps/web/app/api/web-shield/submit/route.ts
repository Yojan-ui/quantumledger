import { isSealed, openSealedBody, signResponse, HEADER_SIGNATURE } from "@qsetu/web-shield";
import { fail } from "@/lib/server/api";
import { getBus } from "@/lib/server/runtime";
import { getWebShieldKeys } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * POST /api/web-shield/submit: the demo form's endpoint. It accepts plain posts (no script tag) or
 * Q-Setu-sealed posts, and reports which arrived, so the before/after is visible.
 */
export async function POST(req: Request) {
  const t = performance.now();
  const raw = await req.text();
  if (raw.length > 256 * 1024) return fail("invalid_input", "Body too large (max 256 KB)", 413);
  const keys = getWebShieldKeys();
  let fields: Record<string, string> = {};
  let info: {
    sealed: boolean;
    sealedBytes: number;
    plainBytes: number;
    algIds?: unknown;
    ciphertextSha256?: string;
  } = {
    sealed: false,
    sealedBytes: 0,
    plainBytes: raw.length,
  };
  let nonce: Uint8Array | undefined;
  let contentType = req.headers.get("content-type") ?? "";
  let plain = raw;

  try {
    if (isSealed(contentType)) {
      const o = openSealedBody(raw, keys);
      nonce = o.nonce;
      contentType = o.contentType;
      plain = new TextDecoder().decode(o.bytes);
      info = {
        sealed: true,
        sealedBytes: o.sealedBytes,
        plainBytes: o.bytes.length,
        algIds: o.algIds,
        ciphertextSha256: o.ciphertextSha256,
      };
    }
  } catch (e) {
    getBus().publish({
      op: "REJECT",
      source: "web",
      alg: "ml-kem-768+x25519",
      ms: performance.now() - t,
      ok: false,
      detail: (e as Error).message,
    });
    return fail("invalid_input", `Rejected: ${(e as Error).message}`, 400);
  }
  if (info.sealed)
    getBus().publish({
      op: "OPEN",
      source: "web",
      alg: "ml-kem-768+x25519",
      ms: performance.now() - t,
      ok: true,
      bytes: info.sealedBytes,
      detail: "sealed form post opened",
    });

  if (contentType.includes("json")) fields = JSON.parse(plain || "{}");
  else if (contentType.includes("multipart")) {
    const fd = await new Response(plain, { headers: { "content-type": contentType } }).formData();
    fd.forEach((v, k) => (fields[k] = String(v)));
  } else fields = Object.fromEntries(new URLSearchParams(plain));

  const result = { ok: true, received: fields, transport: info, serverMs: performance.now() - t };
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  const out = wantsHtml ? page(result) : JSON.stringify(result);
  const bytes = new TextEncoder().encode(out);
  const headers: Record<string, string> = {
    "content-type": wantsHtml ? "text/html; charset=utf-8" : "application/json",
  };
  if (nonce) headers[HEADER_SIGNATURE] = signResponse(bytes, nonce, keys);
  return new Response(bytes, { headers });
}

function page(r: {
  received: Record<string, string>;
  transport: { sealed: boolean; sealedBytes: number; plainBytes: number };
}) {
  const rows = Object.entries(r.received)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("");
  const banner = r.transport.sealed
    ? `<p class="ok">Arrived sealed with Q-Setu (X25519 + ML-KEM-768). On the wire: ${r.transport.sealedBytes} bytes of ciphertext instead of ${r.transport.plainBytes} bytes of readable form data.</p>`
    : `<p class="bad">Arrived as plain form data. Anyone recording this connection's contents could read it at Q-Day.</p>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Application received</title>
<link rel="stylesheet" href="/tokens.css"><style>body{font:16px/26px system-ui;background:var(--bg);color:var(--text-2);max-width:560px;margin:96px auto;padding:0 20px}h1{color:var(--text);font-weight:500;font-size:28px;letter-spacing:-0.02em}.ok,.bad{font:14px/22px system-ui;color:var(--text)}table{border-collapse:collapse;width:100%;margin-top:32px}th,td{text-align:left;padding:12px 0;border-bottom:1px solid var(--line)}th{color:var(--text-3);font:400 12px/16px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}a{color:var(--text)}</style>
<h1>Application received</h1>${banner}<table>${rows}</table><p><a href="/web-shield-demo/">← Back to the form</a></p></html>`;
}
