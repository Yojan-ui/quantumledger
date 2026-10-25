import "server-only";
import { cookies } from "next/headers";
import { isDenied, scopeFor, siteOf, inScope, type Denied, type Scope } from "./access";
import { LAB_COOKIE, readSession, sessionFromCookieHeader, type LabUser } from "./auth";
import { engine, EngineMissing } from "./engine";
import type { Customer, EngineOverview, IncidentDetail, Pattern } from "./types";

/**
 * What the Lab pages and API routes read, always through a scope from lib/lab/access. Pages and
 * routes share these functions, so a page can never show what its API route would refuse.
 */
export interface LabContext {
  user: LabUser;
  scope: Scope;
  /** Every customer for the team; only their own for a customer. */
  customers: Customer[];
}

export async function customersFromEngine(): Promise<Customer[]> {
  return (await engine<{ customers: Customer[] }>("/api/customers")).customers;
}

/** The context for a user (or a denial), narrowed to `requested` if given. */
export async function contextFor(
  user: LabUser | undefined,
  requested?: string | null,
): Promise<LabContext | Denied> {
  if (!user) return { denied: "signed-out", message: "Sign in to use the Lab." };
  const all = await customersFromEngine();
  const scope = scopeFor(user, all, requested);
  if (isDenied(scope)) return scope;
  return {
    user,
    scope,
    customers: user.role === "team" ? all : scope.kind === "customer" ? [scope.customer] : [],
  };
}

/** For API routes: the context from the request's cookie and ?customer=. */
export async function requestContext(req: Request): Promise<LabContext | Denied> {
  const user = sessionFromCookieHeader(req.headers.get("cookie"));
  return contextFor(user, new URL(req.url).searchParams.get("customer"));
}

/** For pages: the signed-in user from the cookie store. */
export async function pageUser(): Promise<LabUser | undefined> {
  return readSession((await cookies()).get(LAB_COOKIE)?.value);
}

const q = (s: Scope) => {
  const site = siteOf(s);
  return site ? `?site=${encodeURIComponent(site)}` : "";
};

export async function overviewFor(s: Scope): Promise<EngineOverview> {
  return engine<EngineOverview>(`/api/overview${q(s)}`);
}

export async function patternsFor(s: Scope): Promise<Pattern[]> {
  return (await engine<{ patterns: Pattern[] }>(`/api/patterns${q(s)}`)).patterns;
}

/** One incident, or not-found if it doesn't exist or belongs to a site outside the scope. */
export async function incidentFor(s: Scope, id: string): Promise<IncidentDetail | Denied> {
  const notFound: Denied = { denied: "not-found", message: "No such incident." };
  if (!/^inc_\d{1,10}$/.test(id)) return notFound;
  try {
    const d = await engine<IncidentDetail>(`/api/incidents/${id}`);
    return inScope(s, d.incident.site) ? d : notFound;
  } catch (e) {
    if (e instanceof EngineMissing) return notFound;
    throw e;
  }
}

/**
 * Share of TLS connections that used a post-quantum key exchange over the last 30 days, from the
 * website's own Shield stats for the customers' linked Shield sites (read-only). Only Shield Edge
 * sees the handshake, so without it (or without a linked site) there is no figure.
 */
export async function quantumSafe(
  customers: Customer[],
): Promise<{ share: number | null; connections: number; linked: number }> {
  const ids = customers.map((c) => c.shieldSiteId).filter((x): x is string => !!x);
  if (!ids.length) return { share: null, connections: 0, linked: 0 };
  try {
    const { live } = await import("@/lib/server/runtime");
    const { repos } = await live();
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    let pq = 0;
    let classical = 0;
    for (const id of ids)
      for (const d of await repos.shieldStats.range(id, from, to)) {
        pq += Number(d.pq);
        classical += Number(d.classical);
      }
    const n = pq + classical;
    return { share: n ? pq / n : null, connections: n, linked: ids.length };
  } catch {
    return { share: null, connections: 0, linked: ids.length };
  }
}
