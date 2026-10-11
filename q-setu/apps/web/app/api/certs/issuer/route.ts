import { issuerPublicKey } from "@/lib/server/certs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    university: "Deccan University",
    alg: "ml-dsa-65",
    publicKey: issuerPublicKey(),
  });
}
