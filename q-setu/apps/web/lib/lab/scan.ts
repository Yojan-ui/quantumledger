import "server-only";
import { promises as dns } from "node:dns";
import { request } from "node:https";
import { hostFromInput, isPrivateAddress, ScanError } from "@/lib/live/tls";
import { isOffline } from "@/lib/server/env";
import { scanHost, type ScanRecord } from "@/lib/server/scan-service";

/**
 * The Lab's "Scan a site": a passive, read-only readiness check of public information.
 *
 *  - A website: the existing TLS probe (DNS-pinned, public addresses only, no request sent), then
 *    ONE ordinary GET of the home page, pinned to the same checked public address, no redirects
 *    followed, 5 s and 300 KB at most, to read its security headers and the login/API links any
 *    visitor can see.
 *  - An email address: public DNS records of its domain (MX, SPF, DKIM at common selectors, DMARC).
 *    Nothing is sent to the domain at all.
 *
 * It never sends attack traffic anywhere: only the local sandbox replay does that, behind the
 * engine's host guard.
 */

const HEADERS = [
  ["strict-transport-security", "Forces secure connections (HSTS)"],
  ["content-security-policy", "Limits which scripts can run (CSP)"],
  ["x-frame-options", "Stops the site being framed by others"],
  ["x-content-type-options", "Stops browsers guessing file types"],
  ["referrer-policy", "Controls what the site leaks in links"],
  ["permissions-policy", "Limits camera, mic and location access"],
] as const;

export interface WebScan {
  kind: "website";
  host: string;
  tls: Pick<ScanRecord, "score" | "grade" | "plain" | "cached"> & {
    protocol: string | null;
    group: string;
    hybridPq: boolean;
    certKey: string;
  };
  /** Absent when the home page couldn't be read (offline, timeout, refused). */
  http?: {
    status: number;
    redirect?: string;
    headers: { name: string; plain: string; present: boolean }[];
    login: string[];
    api: string[];
  };
  httpNote?: string;
  readiness: number;
}

export interface EmailScan {
  kind: "email";
  domain: string;
  mx: string[];
  spf?: { record: string; strength: "strict" | "soft" | "weak" };
  dkim: string[];
  dmarc?: { record: string; policy: "reject" | "quarantine" | "none" };
  spoofable: "protected" | "partly" | "spoofable";
  plain: string;
}

const timeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

/** One GET of the home page, pinned to a checked public address. Read-only. */
async function homepage(host: string) {
  const addrs = await timeout(dns.lookup(host, { all: true }), 4000);
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address)))
    throw new ScanError("blocked_target", "not a public address");
  const address = addrs[0]!.address;
  return new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>((resolve, reject) => {
    const req = request(
      {
        host: address,
        servername: host,
        port: 443,
        path: "/",
        method: "GET",
        headers: {
          host,
          "user-agent": "QuantumLedger-Readiness/1.0 (read-only public check)",
          accept: "text/html",
        },
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => {
          body += c;
          if (body.length > 300_000) res.destroy();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
        res.on("close", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

const LOGIN = /\b(log-?in|sign-?in|account|my-?account|admin|wp-admin|auth|password)\b/i;
const API = /(\/api\b|\/graphql\b|\/swagger|\/openapi|\/v[0-9]+\/)/i;

function surface(body: string) {
  const links = [...body.matchAll(/(?:href|action)\s*=\s*["']([^"'#\s]{1,200})["']/gi)].map(
    (m) => m[1]!,
  );
  const pick = (re: RegExp) => [...new Set(links.filter((l) => re.test(l)))].slice(0, 5);
  const login = pick(LOGIN);
  if (/<input[^>]+type\s*=\s*["']?password/i.test(body))
    login.unshift("(a password field on the home page)");
  return { login: login.slice(0, 5), api: pick(API) };
}

export async function scanWebsite(input: string): Promise<WebScan> {
  const host = hostFromInput(input);
  const rec = await scanHost(host);
  const tls = {
    score: rec.score,
    grade: rec.grade,
    plain: rec.plain,
    ...(rec.cached ? { cached: true } : {}),
    protocol: rec.probe.protocol,
    group: rec.probe.group,
    hybridPq: rec.probe.hybridPq,
    certKey: rec.probe.certKey,
  };
  let http: WebScan["http"];
  let httpNote: string | undefined;
  if (isOffline())
    httpNote = "Offline: the home page wasn't read, so headers and links weren't checked.";
  else
    try {
      const r = await homepage(rec.probe.host);
      const get = (n: string) => r.headers[n];
      http = {
        status: r.status,
        ...(typeof get("location") === "string"
          ? { redirect: String(get("location")).slice(0, 200) }
          : {}),
        headers: HEADERS.map(([name, plain]) => ({
          name,
          plain,
          present: get(name) !== undefined,
        })),
        ...surface(r.body),
      };
    } catch {
      httpNote =
        "The home page didn't answer within 5 seconds, so headers and links weren't checked.";
    }
  const headerShare = http ? http.headers.filter((h) => h.present).length / HEADERS.length : 0;
  const readiness = Math.round(rec.score * (http ? 0.7 : 1) + headerShare * 30 * (http ? 1 : 0));
  return {
    kind: "website",
    host: rec.probe.host,
    tls,
    ...(http ? { http } : {}),
    ...(httpNote ? { httpNote } : {}),
    readiness,
  };
}

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const SELECTORS = ["default", "google", "selector1", "selector2", "k1", "s1", "s2", "mail", "dkim"];

const txt = async (name: string) => {
  try {
    return (await timeout(dns.resolveTxt(name), 4000)).map((r) => r.join(""));
  } catch {
    return [];
  }
};

export async function scanEmail(input: string): Promise<EmailScan> {
  const domain = input.split("@").pop()!.trim().toLowerCase().replace(/\.$/, "");
  if (!DOMAIN.test(domain)) throw new ScanError("invalid_input", "not an email domain");
  if (isOffline()) throw new ScanError("unreachable", "offline");
  const [mx, root, dmarcTxt, ...dkimTxt] = await Promise.all([
    timeout(dns.resolveMx(domain), 4000)
      .then((r) => r.sort((a, b) => a.priority - b.priority).map((m) => m.exchange))
      .catch(() => [] as string[]),
    txt(domain),
    txt(`_dmarc.${domain}`),
    ...SELECTORS.map((s) => txt(`${s}._domainkey.${domain}`)),
  ]);
  const spfRec = root.find((r) => /^v=spf1\b/i.test(r));
  const spf = spfRec && {
    record: spfRec.slice(0, 300),
    strength: (/-all\b/.test(spfRec) ? "strict" : /~all\b/.test(spfRec) ? "soft" : "weak") as
      "strict" | "soft" | "weak",
  };
  const dmarcRec = dmarcTxt.find((r) => /^v=DMARC1\b/i.test(r));
  const p = dmarcRec?.match(/\bp=(reject|quarantine|none)\b/i)?.[1]?.toLowerCase() as
    "reject" | "quarantine" | "none" | undefined;
  const dmarc = dmarcRec ? { record: dmarcRec.slice(0, 300), policy: p ?? "none" } : undefined;
  const dkim = SELECTORS.filter((_, i) => dkimTxt[i]!.some((r) => /v=DKIM1|k=rsa|p=/i.test(r)));
  const spoofable: EmailScan["spoofable"] =
    dmarc?.policy === "reject"
      ? "protected"
      : dmarc?.policy === "quarantine"
        ? "partly"
        : "spoofable";
  const plain =
    spoofable === "protected"
      ? `Hard to fake. Mail servers are told to reject email that pretends to come from @${domain} but fails its checks.`
      : spoofable === "partly"
        ? `Partly protected. Fake email pretending to come from @${domain} should land in spam, but it still arrives.`
        : dmarc
          ? `Easy to fake. @${domain} publishes a policy but asks mail servers to take no action, so convincing fakes reach inboxes.`
          : `Easy to fake. @${domain} has no DMARC policy, so mail servers have no instruction to stop email pretending to be from it.`;
  return {
    kind: "email",
    domain,
    mx: mx.slice(0, 5),
    ...(spf ? { spf } : {}),
    dkim,
    ...(dmarc ? { dmarc } : {}),
    spoofable,
    plain,
  };
}
