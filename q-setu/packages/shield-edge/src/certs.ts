/**
 * Per-domain certificates for the edge. Each domain's private key is stored encrypted at rest with
 * AES-256-GCM under a key-encryption key derived (scrypt) from SHIELD_KEK; the certificate chain is
 * public and stored as is. The domain name is bound in as associated data, so a key file copied onto
 * another domain's entry fails to decrypt.
 *
 * Certificates are classical (ECDSA P-256 from ACME). Browsers don't accept post-quantum
 * certificates yet, so the edge's post-quantum protection is the key exchange (what the
 * harvest-now-decrypt-later attack targets), not the certificate signature.
 *
 * Private keys are never logged.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSecureContext, type SecureContext } from "node:tls";

export interface CertPair {
  /** PEM private key. */
  key: string;
  /** PEM certificate chain, leaf first. */
  cert: string;
}

const SALT = "qsetu-shield-edge-kek-v1";
const DOMAIN = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$|^localhost$/;

/** A file-safe name for a domain ("*.example.com" → "_wildcard_.example.com"). */
const fileFor = (domain: string) => domain.replace(/^\*\./, "_wildcard_.");

export function validDomain(d: string): boolean {
  return d.length <= 253 && DOMAIN.test(d);
}

export class CertStore {
  private readonly kek: Buffer;
  private readonly contexts = new Map<string, SecureContext>();
  private ticketKeys?: Buffer;

  constructor(
    private readonly dir: string,
    secret: string,
    /** TLS options every context gets (the key-exchange groups, protocol floor). */
    private readonly tlsOptions: { ecdhCurve: string; minVersion: "TLSv1.2" | "TLSv1.3" },
  ) {
    if (!secret || secret.length < 32) throw new Error("SHIELD_KEK must be at least 32 characters");
    this.kek = scryptSync(secret, SALT, 32);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  /** AES-256-GCM under the KEK, with `label` bound in as associated data. */
  private seal(label: string, plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.kek, iv);
    c.setAAD(Buffer.from(label));
    const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
  }

  private open(label: string, sealed: string): string {
    const blob = Buffer.from(sealed, "base64");
    const d = createDecipheriv("aes-256-gcm", this.kek, blob.subarray(0, 12));
    d.setAAD(Buffer.from(label));
    d.setAuthTag(blob.subarray(12, 28));
    return Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString("utf8");
  }

  private write(name: string, record: object) {
    const file = join(this.dir, name);
    writeFileSync(`${file}.tmp`, JSON.stringify(record), { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
  }

  /** Saves (or replaces) a domain's certificate; the private key is encrypted first. */
  put(domain: string, pair: CertPair): void {
    domain = domain.toLowerCase();
    if (!validDomain(domain)) throw new Error("invalid domain");
    // Fail before writing anything if the pair doesn't load.
    const ctx = this.context(pair);
    this.write(`${fileFor(domain)}.json`, {
      v: 1,
      domain,
      cert: pair.cert,
      key: this.seal(`qsetu-edge-key:${domain}`, pair.key),
    });
    this.contexts.set(domain, ctx);
  }

  /** A small secret kept beside the certificates, encrypted the same way (e.g. the ACME account key). */
  putSecret(name: string, value: string): void {
    if (!/^[a-z0-9-]{1,40}$/.test(name)) throw new Error("invalid secret name");
    this.write(`${name}.secret`, {
      v: 1,
      name,
      value: this.seal(`qsetu-edge-secret:${name}`, value),
    });
  }

  getSecret(name: string): string | undefined {
    if (!/^[a-z0-9-]{1,40}$/.test(name)) return undefined;
    let raw: string;
    try {
      raw = readFileSync(join(this.dir, `${name}.secret`), "utf8");
    } catch {
      return undefined;
    }
    const r = JSON.parse(raw) as { v: number; name: string; value: string };
    if (r.v !== 1 || r.name !== name) throw new Error("secret record mismatch");
    return this.open(`qsetu-edge-secret:${name}`, r.value);
  }

  /** The decrypted pair, or undefined if the domain has none. Throws if the record was tampered with. */
  get(domain: string): CertPair | undefined {
    domain = domain.toLowerCase();
    if (!validDomain(domain)) return undefined;
    let raw: string;
    try {
      raw = readFileSync(join(this.dir, `${fileFor(domain)}.json`), "utf8");
    } catch {
      return undefined;
    }
    const r = JSON.parse(raw) as { v: number; domain: string; cert: string; key: string };
    if (r.v !== 1 || r.domain !== domain) throw new Error("certificate record mismatch");
    return { key: this.open(`qsetu-edge-key:${domain}`, r.key), cert: r.cert };
  }

  domains(): string[] {
    try {
      return readdirSync(this.dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5).replace(/^_wildcard_\./, "*."));
    } catch {
      return [];
    }
  }

  /**
   * The TLS context for an SNI name: an exact match, else a wildcard one level up. Cached; a `put`
   * replaces the cached one, so renewals take effect on the next handshake.
   */
  lookup(servername: string): SecureContext | undefined {
    const name = servername.toLowerCase();
    for (const d of [name, `*.${name.split(".").slice(1).join(".")}`]) {
      const hit = this.contexts.get(d);
      if (hit) return hit;
      const pair = this.get(d);
      if (pair) {
        const ctx = this.context(pair);
        this.contexts.set(d, ctx);
        return ctx;
      }
    }
    return undefined;
  }

  /**
   * Session-ticket keys for every context, current and future (each SecureContext has its own, so a
   * rotation must reach all of them or resumption would break per domain).
   */
  setTicketKeys(keys: Buffer): void {
    this.ticketKeys = keys;
    for (const ctx of this.contexts.values()) applyTicketKeys(ctx, keys);
  }

  private context(pair: CertPair): SecureContext {
    const ctx = createSecureContext({
      key: pair.key,
      cert: pair.cert,
      ecdhCurve: this.tlsOptions.ecdhCurve,
      minVersion: this.tlsOptions.minVersion,
    });
    if (this.ticketKeys) applyTicketKeys(ctx, this.ticketKeys);
    return ctx;
  }
}

/** Node exposes ticket keys on the server only; a SecureContext's native handle takes them too. */
function applyTicketKeys(ctx: SecureContext, keys: Buffer) {
  (ctx as unknown as { context: { setTicketKeys(k: Buffer): void } }).context.setTicketKeys(keys);
}
