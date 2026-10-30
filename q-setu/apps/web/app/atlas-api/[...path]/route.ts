import { proxy } from "@/lib/server/atlas-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /atlas-api/* -> the Q-Shield Atlas backend (${ATLAS_URL}/api/*). Logic and rules: lib/server/atlas-proxy.ts. */
export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
