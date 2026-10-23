import "server-only";
import { notFound, redirect } from "next/navigation";
import { isDenied } from "./access";
import { contextFor, pageUser, type LabContext } from "./data";
import { EngineDown } from "./engine";

/**
 * For Lab pages: the signed-in user's context for `?customer=`, or a redirect to sign-in. A
 * customer asking for another customer's view gets a 404 page, as the API answers them.
 */
export async function labPage(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  opts: { team?: boolean } = {},
): Promise<(LabContext & { scopeName: string; customerParam?: string }) | "offline"> {
  const user = await pageUser();
  if (!user) redirect("/lab/sign-in");
  if (opts.team && user.role !== "team") notFound();
  const raw = (await searchParams).customer;
  const requested = typeof raw === "string" ? raw : undefined;
  let ctx;
  try {
    ctx = await contextFor(user, requested);
  } catch (e) {
    if (e instanceof EngineDown) return "offline";
    throw e;
  }
  if (isDenied(ctx)) {
    if (ctx.denied === "signed-out") redirect("/lab/sign-in");
    notFound();
  }
  return {
    ...ctx,
    scopeName: ctx.scope.kind === "customer" ? ctx.scope.customer.name : "All customers",
    ...(requested ? { customerParam: requested } : {}),
  };
}
