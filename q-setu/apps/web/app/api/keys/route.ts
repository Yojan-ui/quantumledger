import { live } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/keys: KMS key metadata (active and retired). Public keys only; secrets never leave the KMS. */
export function GET() {
  const { keys } = live();
  return Response.json({
    store: keys.storeKind,
    keys: keys.list().map(({ publicKey, ...k }) => ({
      ...k,
      publicKeyBytes: Buffer.from(publicKey, "base64").length,
    })),
  });
}
