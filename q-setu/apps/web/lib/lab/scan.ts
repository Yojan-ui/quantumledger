import "server-only";
import { promises as dns } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { scan } from "@qsetu/core";
import { explain } from "@/lib/live/explain";
import {
  hostFromInput,
  isPrivateAddress,
  probeTls,
  ScanError,
  serverCrypto,
  type ServerCrypto,
} from "@/lib/live/tls";

/**
 * The Lab's "Scan a site": a live, passive, read-only readiness check of public information. Always
 * live (no cached or demo answers); every step it tried is reported, including the one that failed.
 *
 *  - A website: DNS lookup (public addresses only), the existing TLS probe (DNS-pinned, offers
 *    X25519MLKEM768 first, no request sent), then one ordinary GET of the home page over HTTPS and
 *    one over plain HTTP (to see whether it redirects to HTTPS), both pinned to the checked public
 *    address, no redirects followed, a few seconds and 300 KB at most.
 *  - An email address (or "@domain"): the domain's public DNS records (MX, SPF, DKIM at common
 *    selectors, DMARC). Nothing is sent to the domain.
 *
 * It never sends attack traffic anywhere: only the local sandbox replay does that, behind the
 * engine's host guard.
 */

export interface Step {
  step: string;
  ok: boolean;
  detail: string;
}

/** A scan that couldn't finish: what failed, in plain words, and every step tried. */
export class ScanFailed extends Error {
  constructor(
    message: string,
    readonly target: string,
    readonly steps: Step[],
  ) {
    super(message);
    this.name = "ScanFailed";
  }
}

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
  steps: Step[];
  tls: {
    score: number;
    grade: string;
    plain: string[];
    protocol: string | null;
    cipher: string;
    group: string;
    hybridPq: boolean;
    pqOffered: boolean;
    certKey: string;
  };
  /** What this server's Node/OpenSSL can do (so the UI can say whether PQ is possible here). */
  health: ServerCrypto;
  /** Absent when the home page couldn't be read (the step says why). */
  http?: {
    status: number;
    headers: { name: string; plain: string; present: boolean }[];
    login: string[];
    api: string[];
  };
  /** Whether plain http:// sends visitors to https:// (null: couldn't tell). */
  httpsRedirect: boolean | null;
  readiness: number;
}

export interface EmailScan {
  kind: "email";
  domain: string;
  steps: Step[];
  mx: string[];
  spf?: { record: string; strength: "strict" | "soft" | "weak" };
  dkim: string[];
  dmarc?: { record: string; policy: "reject" | "quarantine" | "none" };
  spoofable: "protected" | "partly" | "spoofable";
  plain: string;
}

/** Cleans what was typed: trims, drops spaces; "a@b.com" or "@b.com" is an email domain. */
export function classifyInput(
  input: string,
): { kind: "email"; domain: string } | { kind: "website"; target: string } {
  const raw = input.trim().replace(/\s+/g, "");
  if (raw.includes("@") && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return { kind: "email", domain: raw.split("@").pop()!.toLowerCase().replace(/\.$/, "") };
  }
  return { kind: "website", target: /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}` };
}

const withTimeout = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([
    p,
    new Promise<never>((_, r) =>
      setTimeout(() => r(new Error(`${what} timed out after ${ms / 1000} s`)), ms),
    ),
  ]);

type Fetched = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

/** One GET of `/`, pinned to a checked public address. Read-only; no redirects followed. */
function getPinned(host: string, address: string, secure: boolean, ms: number): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const opts = {
      host: address,
      port: secure ? 443 : 80,
      path: "/",
      method: "GET",
      headers: {
        host,
        "user-agent": "QuantumLedger-Readiness/1.0 (read-only public check)",
        accept: "text/html",
      },
      timeout: ms,
      ...(secure ? { servername: host } : {}),
    };
    const done = (res: import("node:http").IncomingMessage) => {
      let body = "";
      res.setEncoding("utf8");
      const finish = () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
      res.on("data", (c: string) => {
        body += c;
        if (body.length > 300_000) res.destroy();
      });
      res.on("end", finish);
      res.on("close", finish);
    };
    const req = secure ? httpsRequest(opts, done) : httpRequest(opts, done);
    req.on("timeout", () => req.destroy(new Error(`no answer within ${ms / 1000} s`)));
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

const reason = (e: unknown) =>
  e instanceof ScanError ? e.message : e instanceof Error ? e.message : "unknown error";

/** Live website check. `steps` is filled as it goes, so a caller's timeout can still show them. */
export async function scanWebsite(target: string, steps: Step[] = []): Promise<WebScan> {
  let host: string;
  try {
    host = hostFromInput(target);
  } catch (e) {
    steps.push({ step: "Read the address", ok: false, detail: reason(e) });
    throw new ScanFailed(`"${target}" isn't a public website address.`, target, steps);
  }
  steps.push({ step: "Read the address", ok: true, detail: host });

  let address: string;
  try {
    const addrs = await withTimeout(dns.lookup(host, { all: true }), 3000, "DNS lookup");
    if (!addrs.length) throw new Error("no addresses");
    if (addrs.some((a) => isPrivateAddress(a.address))) {
      steps.push({
        step: "Look up the address (DNS)",
        ok: false,
        detail: "points inside a private network",
      });
      throw new ScanFailed(
        `${host} points inside a private network, so it can't be checked. Only public sites can.`,
        host,
        steps,
      );
    }
    address = addrs[0]!.address;
    steps.push({
      step: "Look up the address (DNS)",
      ok: true,
      detail: addrs
        .map((a) => a.address)
        .slice(0, 3)
        .join(", "),
    });
  } catch (e) {
    if (e instanceof ScanFailed) throw e;
    steps.push({ step: "Look up the address (DNS)", ok: false, detail: reason(e) });
    throw new ScanFailed(
      `Couldn't find ${host}. Check the spelling; the name doesn't resolve to an address.`,
      host,
      steps,
    );
  }

  let probe;
  try {
    probe = await probeTls(host);
    steps.push({
      step: "Secure connection (TLS handshake on port 443)",
      ok: true,
      detail: `${probe.protocol ?? "?"} · ${probe.cipher} · ${probe.group}`,
    });
  } catch (e) {
    steps.push({
      step: "Secure connection (TLS handshake on port 443)",
      ok: false,
      detail: reason(e),
    });
    throw new ScanFailed(
      `Couldn't reach ${host}: it may be down, not serve HTTPS, or be blocking automated checks.`,
      host,
      steps,
    );
  }
  const result = scan(probe.report, probe.host);

  const [page, plain] = await Promise.allSettled([
    getPinned(host, address, true, 4000),
    getPinned(host, address, false, 3000),
  ]);
  let http: WebScan["http"];
  if (page.status === "fulfilled") {
    const get = (n: string) => page.value.headers[n];
    http = {
      status: page.value.status,
      headers: HEADERS.map(([name, label]) => ({
        name,
        plain: label,
        present: get(name) !== undefined,
      })),
      ...surface(page.value.body),
    };
    steps.push({
      step: "Read the home page (HTTPS)",
      ok: true,
      detail: `HTTP ${page.value.status}`,
    });
  } else steps.push({ step: "Read the home page (HTTPS)", ok: false, detail: reason(page.reason) });
  let httpsRedirect: boolean | null = null;
  if (plain.status === "fulfilled") {
    const loc = String(plain.value.headers.location ?? "");
    httpsRedirect =
      plain.value.status >= 300 && plain.value.status < 400 && loc.startsWith("https://");
    steps.push({
      step: "Check http:// sends visitors to https://",
      ok: true,
      detail: `HTTP ${plain.value.status}${loc ? ` → ${loc.slice(0, 120)}` : ""}`,
    });
  } else
    steps.push({
      step: "Check http:// sends visitors to https://",
      ok: false,
      detail: reason(plain.reason),
    });

  const headerShare = http ? http.headers.filter((h) => h.present).length / HEADERS.length : 0;
  const readiness = Math.round(result.score * 0.65 + headerShare * 25 + (httpsRedirect ? 10 : 0));
  return {
    kind: "website",
    host: probe.host,
    steps,
    tls: {
      score: result.score,
      grade: result.grade,
      plain: explain(probe, result.findings),
      protocol: probe.protocol,
      cipher: probe.cipher,
      group: probe.group,
      hybridPq: probe.hybridPq,
      pqOffered: probe.pqOffered,
      certKey: probe.certKey,
    },
    health: serverCrypto(),
    ...(http ? { http } : {}),
    httpsRedirect,
    readiness,
  };
}

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const SELECTORS = ["default", "google", "selector1", "selector2", "k1", "s1", "s2", "mail", "dkim"];

/** TXT records, or [] when there are none; throws only when DNS itself can't be reached. */
async function txt(name: string): Promise<string[]> {
  try {
    return (await withTimeout(dns.resolveTxt(name), 4000, "DNS")).map((r) => r.join(""));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return [];
    throw e;
  }
}

/** Live email-domain check from public DNS. */
export async function scanEmail(domain: string, steps: Step[] = []): Promise<EmailScan> {
  if (!DOMAIN.test(domain)) {
    steps.push({ step: "Read the email domain", ok: false, detail: domain || "(empty)" });
    throw new ScanFailed(`"${domain}" isn't a valid email domain.`, domain, steps);
  }
  steps.push({ step: "Read the email domain", ok: true, detail: domain });
  let mx: string[] = [];
  try {
    mx = (await withTimeout(dns.resolveMx(domain), 4000, "DNS"))
      .sort((a, b) => a.priority - b.priority)
      .map((m) => m.exchange);
    steps.push({ step: "Mail servers (MX)", ok: true, detail: mx.join(", ") || "none" });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== "ENODATA" && code !== "ENOTFOUND") {
      steps.push({ step: "Mail servers (MX)", ok: false, detail: reason(e) });
      throw new ScanFailed(
        `Couldn't look up ${domain}: public DNS didn't answer from this computer.`,
        domain,
        steps,
      );
    }
    steps.push({ step: "Mail servers (MX)", ok: true, detail: "none" });
  }
  let root: string[], dmarcTxt: string[], dkimTxt: string[][];
  try {
    [root, dmarcTxt, ...dkimTxt] = await Promise.all([
      txt(domain),
      txt(`_dmarc.${domain}`),
      ...SELECTORS.map((s) => txt(`${s}._domainkey.${domain}`).catch(() => [])),
    ]);
  } catch (e) {
    steps.push({ step: "SPF and DMARC records (TXT)", ok: false, detail: reason(e) });
    throw new ScanFailed(
      `Couldn't read ${domain}'s email records: DNS didn't answer in time.`,
      domain,
      steps,
    );
  }
  const spfRec = root.find((r) => /^v=spf1\b/i.test(r));
  const spf = spfRec
    ? {
        record: spfRec.slice(0, 300),
        strength: (/-all\b/.test(spfRec) ? "strict" : /~all\b/.test(spfRec) ? "soft" : "weak") as
          "strict" | "soft" | "weak",
      }
    : undefined;
  const dmarcRec = dmarcTxt.find((r) => /^v=DMARC1\b/i.test(r));
  const p = dmarcRec?.match(/\bp=(reject|quarantine|none)\b/i)?.[1]?.toLowerCase() as
    "reject" | "quarantine" | "none" | undefined;
  const dmarc = dmarcRec ? { record: dmarcRec.slice(0, 300), policy: p ?? "none" } : undefined;
  const dkim = SELECTORS.filter((_, i) =>
    (dkimTxt[i] ?? []).some((r) => /v=DKIM1|k=rsa|p=/i.test(r)),
  );
  steps.push({ step: "SPF record", ok: true, detail: spf?.record ?? "none" });
  steps.push({ step: "DMARC record", ok: true, detail: dmarc?.record ?? "none" });
  steps.push({
    step: "DKIM keys at common selectors",
    ok: true,
    detail: dkim.join(", ") || "none found",
  });
  const spoofable: EmailScan["spoofable"] =
    dmarc?.policy === "reject"
      ? "protected"
      : dmarc?.policy === "quarantine"
        ? "partly"
        : "spoofable";
  const plain =
    spoofable === "protected"
      ? `Protected against spoofing. Mail servers are told to reject email that pretends to come from @${domain} but fails its checks.`
      : spoofable === "partly"
        ? `Partly protected. Fake email pretending to come from @${domain} should land in spam, but it still arrives.`
        : dmarc
          ? `Not protected against spoofing. @${domain} publishes a policy but asks mail servers to take no action, so convincing fakes can reach inboxes.`
          : `Not protected against spoofing. @${domain} has no DMARC policy, so mail servers have no instruction to stop email pretending to be from it.`;
  return {
    kind: "email",
    domain,
    steps,
    mx: mx.slice(0, 5),
    ...(spf ? { spf } : {}),
    dkim,
    ...(dmarc ? { dmarc } : {}),
    spoofable,
    plain,
  };
}
