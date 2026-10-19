/**
 * Certificates from Let's Encrypt (or any ACME CA) for each customer domain, through the maintained
 * `acme-client` library: HTTP-01 challenges answered on the edge's plain-HTTP port, ECDSA P-256 keys,
 * stored encrypted in the CertStore, renewed when fewer than 30 days remain (checked twice a day).
 *
 * Issuance needs the domain's DNS pointing at this edge and port 80 reachable from the internet, so
 * it can't be exercised against Let's Encrypt from a laptop. The flow is the library's own `auto()`.
 * Staging is the default directory, so a misconfiguration can't burn the production rate limits.
 */
import * as acme from "acme-client";
import type { CertStore } from "./certs";

const RENEW_BEFORE_MS = 30 * 86_400_000;
const CHECK_EVERY_MS = 12 * 3_600_000;

export interface AcmeOptions {
  domains: string[];
  email: string;
  /** "production", "staging", or a directory URL. */
  directory: string;
  certs: CertStore;
  log: (e: Record<string, unknown>) => void;
}

export interface AcmeRunner {
  /** The key authorization for an HTTP-01 token, while a challenge is open. */
  challenge(token: string): string | undefined;
  /** Issue or renew now (also runs on start and every 12 h). */
  check(): Promise<void>;
  stop(): void;
}

export function directoryUrl(d: string): string {
  if (d === "production") return acme.directory.letsencrypt.production;
  if (d === "staging") return acme.directory.letsencrypt.staging;
  if (/^https:\/\//.test(d)) return d;
  throw new Error(`ACME_DIRECTORY must be "production", "staging" or an https URL`);
}

/** True if the domain has no certificate, or one that expires within 30 days. */
export function needsCert(certs: CertStore, domain: string, now = Date.now()): boolean {
  const pair = certs.get(domain);
  if (!pair) return true;
  try {
    const info = acme.crypto.readCertificateInfo(pair.cert);
    return info.notAfter.getTime() - now < RENEW_BEFORE_MS;
  } catch {
    return true;
  }
}

export function startAcme(opts: AcmeOptions): AcmeRunner {
  const open = new Map<string, string>();
  let client: acme.Client | undefined;
  const getClient = async () => {
    if (client) return client;
    let accountKey = opts.certs.getSecret("acme-account");
    if (!accountKey) {
      accountKey = (await acme.crypto.createPrivateEcdsaKey()).toString();
      opts.certs.putSecret("acme-account", accountKey);
    }
    client = new acme.Client({ directoryUrl: directoryUrl(opts.directory), accountKey });
    return client;
  };

  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try {
      for (const domain of opts.domains) {
        if (!needsCert(opts.certs, domain)) continue;
        try {
          const c = await getClient();
          const [key, csr] = await acme.crypto.createCsr(
            { commonName: domain, altNames: [domain] },
            await acme.crypto.createPrivateEcdsaKey(),
          );
          const cert = await c.auto({
            csr,
            email: opts.email,
            termsOfServiceAgreed: true,
            challengePriority: ["http-01"],
            challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
              open.set(challenge.token, keyAuthorization);
            },
            challengeRemoveFn: async (_authz, challenge) => {
              open.delete(challenge.token);
            },
          });
          opts.certs.put(domain, { key: key.toString(), cert });
          opts.log({ ev: "acme_issued", domain });
        } catch (e) {
          // The old certificate (if any) keeps serving; the next check tries again.
          opts.log({ ev: "acme_failed", domain, error: (e as Error).message.slice(0, 300) });
        }
      }
    } finally {
      running = false;
    }
  };

  void check();
  const timer = setInterval(() => void check(), CHECK_EVERY_MS);
  timer.unref();
  return {
    challenge: (token) => open.get(token),
    check,
    stop: () => clearInterval(timer),
  };
}
