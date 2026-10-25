/**
 * The DNS install route, in two steps the site owner does at their DNS provider:
 *
 *   1. Prove ownership:  TXT  _qsetu-challenge.www.example.com  "qsetu-verify=<token>"
 *   2. Switch traffic:   CNAME www.example.com  →  edge.quantumledger.app   (or the edge's A/AAAA)
 *
 * Step 1 must pass before the edge will request a certificate or accept traffic for the name, so
 * nobody can put someone else's domain behind their account. Both checks query DNS directly; the
 * token is random per site and compared in constant time.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { promises as dns } from "node:dns";
import { validDomain } from "./certs";

export const CHALLENGE_LABEL = "_qsetu-challenge";
export const DEFAULT_EDGE_TARGET = "edge.quantumledger.app";

export interface DnsLike {
  resolveTxt(name: string): Promise<string[][]>;
  resolveCname(name: string): Promise<string[]>;
  resolve4(name: string): Promise<string[]>;
}

export function newVerificationToken(): string {
  return randomBytes(18).toString("base64url");
}

export function instructions(domain: string, token: string, target = DEFAULT_EDGE_TARGET) {
  return {
    txt: { type: "TXT", name: `${CHALLENGE_LABEL}.${domain}`, value: `qsetu-verify=${token}` },
    cname: { type: "CNAME", name: domain, value: target },
  };
}

const eq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type OwnershipResult =
  { ok: true } | { ok: false; reason: "invalid_domain" | "no_record" | "mismatch" | "dns_error" };

export async function verifyOwnership(
  domain: string,
  token: string,
  r: DnsLike = dns,
): Promise<OwnershipResult> {
  domain = domain.toLowerCase();
  if (!validDomain(domain) || domain.startsWith("*."))
    return { ok: false, reason: "invalid_domain" };
  let records: string[][];
  try {
    records = await r.resolveTxt(`${CHALLENGE_LABEL}.${domain}`);
  } catch (e) {
    const code = (e as { code?: string }).code;
    return {
      ok: false,
      reason: code === "ENOTFOUND" || code === "ENODATA" ? "no_record" : "dns_error",
    };
  }
  const values = records.map((parts) => parts.join(""));
  if (!values.length) return { ok: false, reason: "no_record" };
  return values.some((v) => eq(v.trim(), `qsetu-verify=${token}`))
    ? { ok: true }
    : { ok: false, reason: "mismatch" };
}

export type RoutingResult =
  { ok: true; via: "cname" | "a" } | { ok: false; reason: "not_pointed" | "dns_error" };

/** Is the domain's traffic coming to the edge yet (CNAME to the target, or the same A records)? */
export async function verifyRouting(
  domain: string,
  target = DEFAULT_EDGE_TARGET,
  r: DnsLike = dns,
): Promise<RoutingResult> {
  try {
    const cnames = await r.resolveCname(domain).catch(() => [] as string[]);
    if (cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === target))
      return { ok: true, via: "cname" };
    const [mine, edge] = await Promise.all([
      r.resolve4(domain).catch(() => [] as string[]),
      r.resolve4(target).catch(() => [] as string[]),
    ]);
    if (mine.length && mine.every((ip) => edge.includes(ip))) return { ok: true, via: "a" };
    return { ok: false, reason: "not_pointed" };
  } catch {
    return { ok: false, reason: "dns_error" };
  }
}
