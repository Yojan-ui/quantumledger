import "server-only";
import type { LabUser } from "./auth";
import type { Customer } from "./types";

/**
 * Who may see what in the Lab. Every Lab page and API route goes through these, on the server:
 *
 * - Team admins see every customer, can narrow to one, and can replay.
 * - A customer sees only their own site's incidents and patterns, read-only. Asking for another
 *   customer is refused; asking for an incident on another site answers "not found", the same as
 *   an incident that doesn't exist, so ids can't be probed.
 */
export type Scope =
  { kind: "all"; customers: Customer[] } | { kind: "customer"; customer: Customer };

export type Denied = { denied: "signed-out" | "forbidden" | "not-found"; message: string };

const deny = (denied: Denied["denied"], message: string): Denied => ({ denied, message });

/** The user's current customer record, re-checked on every request (removed members lose access). */
export function customerOf(user: LabUser, customers: Customer[]): Customer | undefined {
  if (user.role !== "customer") return undefined;
  const c = customers.find((x) => x.id === user.customerId);
  return c && c.emails.includes(user.email) ? c : undefined;
}

/** The scope for this user, optionally narrowed to `requested` (a customer id). */
export function scopeFor(
  user: LabUser | undefined,
  customers: Customer[],
  requested?: string | null,
): Scope | Denied {
  if (!user) return deny("signed-out", "Sign in to use the Lab.");
  if (user.role === "team") {
    if (!requested) return { kind: "all", customers };
    const c = customers.find((x) => x.id === requested);
    return c ? { kind: "customer", customer: c } : deny("not-found", "No such customer.");
  }
  const own = customerOf(user, customers);
  if (!own) return deny("forbidden", "This account no longer has access to the Lab.");
  if (requested && requested !== own.id)
    return deny("forbidden", "You can only see your own organisation's data.");
  return { kind: "customer", customer: own };
}

/** The engine's site filter for a scope (undefined = every site). */
export const siteOf = (s: Scope) => (s.kind === "customer" ? s.customer.site : undefined);

/** Whether an incident on `site` is inside the scope. */
export const inScope = (s: Scope, site: string) => s.kind === "all" || s.customer.site === site;

export const isTeam = (u: LabUser | undefined) => u?.role === "team";

export const isDenied = (x: unknown): x is Denied =>
  typeof x === "object" && x !== null && "denied" in x;

export const STATUS: Record<Denied["denied"], number> = {
  "signed-out": 401,
  forbidden: 403,
  "not-found": 404,
};
