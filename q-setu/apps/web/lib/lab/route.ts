import "server-only";
import { fail } from "@/lib/server/api";
import { isDenied, STATUS } from "./access";
import { requestContext, type LabContext } from "./data";
import { EngineDown } from "./engine";

/**
 * Every Lab API route: the signed-in user and their scope from the request, checked on the server
 * before anything is read. `team: true` routes refuse customers.
 */
export async function withLab(
  req: Request,
  opts: { team?: boolean },
  fn: (ctx: LabContext) => Promise<Response>,
): Promise<Response> {
  try {
    const ctx = await requestContext(req);
    if (isDenied(ctx))
      return fail(
        ctx.denied === "not-found" ? "not_found" : "forbidden",
        ctx.message,
        STATUS[ctx.denied],
      );
    if (opts.team && ctx.user.role !== "team")
      return fail("forbidden", "Only the QuantumLedger team can do that.", 403);
    return await fn(ctx);
  } catch (e) {
    if (e instanceof EngineDown) return fail("unreachable", e.message, 503);
    return fail("internal", "Something went wrong in the Lab.", 500);
  }
}

export const denied = (d: { denied: "signed-out" | "forbidden" | "not-found"; message: string }) =>
  fail(d.denied === "not-found" ? "not_found" : "forbidden", d.message, STATUS[d.denied]);
