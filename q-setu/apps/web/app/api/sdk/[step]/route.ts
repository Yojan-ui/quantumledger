import { fail, parseParams } from "@/lib/server/api";
import { getBus } from "@/lib/server/runtime";
import { SdkStepParams } from "@/lib/server/schemas";
import { getSdkServer } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = async (req: Request) => {
  try {
    return { ok: true as const, value: (await req.json()) as unknown };
  } catch {
    return { ok: false as const };
  }
};

/**
 * POST /api/sdk/{hello|finish|message}: a Q-Setu session server for the SDK ("Mobile app") demo.
 * It's what `createSession({ url: "/api/sdk", serverKey })` talks to. Handshake and message bodies
 * are checked by the SDK's own codec, which rejects anything malformed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ step: string }> }) {
  const p = parseParams(await ctx.params, SdkStepParams);
  if (!p.ok) return p.res;
  const { step } = p.data;
  const server = getSdkServer();
  const bus = getBus();
  if (step === "identity")
    return Response.json({ publicKey: Buffer.from(server.identity.publicKey).toString("base64") });
  const b = await json(req);
  if (!b.ok || typeof b.value !== "object" || b.value === null)
    return fail("invalid_input", "Body must be a JSON object", 400);
  const t = performance.now();
  try {
    if (step === "hello") {
      const r = server.hello(b.value as never);
      bus.publish({
        op: "HANDSHAKE",
        source: "sdk",
        alg: "ml-kem-768+x25519 · ml-dsa-65",
        ms: performance.now() - t,
        ok: true,
        detail: "server hello signed",
      });
      return Response.json(r);
    }
    if (step === "finish") {
      const r = server.finish(b.value as never);
      bus.publish({
        op: "HANDSHAKE",
        source: "sdk",
        alg: "ml-kem-768+x25519",
        ms: performance.now() - t,
        ok: true,
        detail: "session established",
      });
      return Response.json(r);
    }
    const r = await server.message(b.value as never, (request, session) => ({
      status: "ACCEPTED",
      echo: request,
      epoch: session.epoch,
    }));
    bus.publish({
      op: "OPEN",
      source: "sdk",
      alg: "ml-kem-768+x25519",
      ms: performance.now() - t,
      ok: true,
      detail: "app request opened, reply sealed",
    });
    return Response.json(r);
  } catch (e) {
    bus.publish({
      op: "REJECT",
      source: "sdk",
      alg: "ml-kem-768+x25519",
      ms: performance.now() - t,
      ok: false,
      detail: (e as Error).message,
    });
    return fail("invalid_input", (e as Error).message, 400);
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ step: string }> }) {
  const { step } = await ctx.params;
  if (step !== "identity") return fail("not_found", "Unknown step", 404);
  return Response.json({
    profile: "standard",
    publicKey: Buffer.from(getSdkServer().identity.publicKey).toString("base64"),
  });
}
