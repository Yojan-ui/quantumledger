import { base64ToBytes, bytesToBase64, getKem, getSig, keyId, utf8ToBytes } from "@qsetu/core";
import { z } from "zod";
import { fail, parseBody } from "@/lib/server/api";
import { take, tooMany } from "@/lib/server/limits";
import { siteIdentity } from "@/lib/server/site-identity";
import {
  headlineId,
  headlineKey,
  headlinesSignedBytes,
  type SealedBundle,
} from "@/lib/trust/format";
import { SEALED_HEADLINES } from "@/lib/trust/headlines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HYBRID = getKem("hybrid-x25519-mlkem768");
const Body = z.object({ publicKey: z.string().max(4096) });
const LIMITS = [{ name: "trust-headlines", limit: 30, windowMs: 60_000, per: "ip" as const }];

/**
 * POST /api/trust/headlines { publicKey: base64 X25519 + ML-KEM-768 public key (1,216 bytes) }
 *
 * One hybrid handshake per page view: encapsulate once to the visitor's key, seal every homepage
 * headline with AES-256-GCM under keys derived from that shared secret, and sign the bundle with
 * the site's ML-DSA-65 key (lib/trust/format). Only the visitor's browser can open it; the
 * signature lets it check, against the key pinned in its bundle, that this server sealed it.
 */
export async function POST(req: Request) {
  const verdict = await take(req, LIMITS);
  if (!verdict.ok) return tooMany(verdict);
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  let recipient: Uint8Array;
  try {
    recipient = base64ToBytes(b.data.publicKey);
  } catch {
    return fail("invalid_input", "publicKey must be base64.", 400);
  }
  if (recipient.length !== HYBRID.sizes.publicKey)
    return fail("invalid_input", `publicKey must be ${HYBRID.sizes.publicKey} bytes.`, 400);

  const t0 = performance.now();
  const { ciphertext: kemCt, sharedSecret } = HYBRID.encapsulate(recipient);
  const encapsMs = performance.now() - t0;

  const items = await Promise.all(
    SEALED_HEADLINES.map(async (text) => {
      const id = headlineId(text);
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const key = await headlineKey(sharedSecret, nonce, id, "encrypt");
      const ct = new Uint8Array(
        await crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv: nonce as BufferSource,
            additionalData: utf8ToBytes(id) as BufferSource,
          },
          key,
          utf8ToBytes(text) as BufferSource,
        ),
      );
      return { id, nonce, ct };
    }),
  );
  sharedSecret.fill(0);

  const site = siteIdentity();
  const ts = Date.now();
  const signature = getSig("ml-dsa-65").sign(
    headlinesSignedBytes(ts, recipient, kemCt, items),
    site.secretKey,
  );
  const bundle: SealedBundle = {
    v: 1,
    kem: "X25519MLKEM768",
    sig: "ML-DSA-65",
    aead: "AES-256-GCM",
    keyId: keyId(site.publicKey),
    ts,
    encapsMs,
    kemCt: bytesToBase64(kemCt),
    items: items.map((i) => ({ id: i.id, nonce: bytesToBase64(i.nonce), ct: bytesToBase64(i.ct) })),
    signature: bytesToBase64(signature),
  };
  return Response.json(bundle, { headers: { "cache-control": "no-store" } });
}
