/**
 * URL readiness probe. Connects to a public host on 443, offering the hybrid post-quantum group
 * (X25519MLKEM768) first, and records what the server actually negotiated: TLS version, cipher
 * suite, key-exchange group, certificate key and signature. Only public addresses are allowed, and
 * the socket goes to the exact IP that was checked (no DNS-rebinding window).
 */
import { lookup as dnsLookup } from "node:dns/promises";
import net, { isIP } from "node:net";
import tls from "node:tls";

/**
 * What the scanner may tell a stranger. Every failure is one of these codes with a fixed message;
 * the underlying error (resolver text, socket errors, addresses) is kept for the server log only.
 */
export type ScanErrorCode =
  "invalid_input" | "blocked_target" | "unresolvable" | "unreachable" | "timeout" | "too_large";
const SCAN_MESSAGES: Record<ScanErrorCode, string> = {
  invalid_input: "Enter a public hostname or an https:// URL.",
  blocked_target: "That address can't be scanned: only public internet hosts are allowed.",
  unresolvable: "We couldn't find that host. Check the spelling and try again.",
  unreachable: "We couldn't complete a TLS handshake with that site on port 443.",
  timeout: "The site took too long to answer (5 s limit).",
  too_large: "The site sent more data than a TLS handshake needs, so we stopped.",
};
export class ScanError extends Error {
  constructor(
    readonly code: ScanErrorCode,
    /** Server-side detail; never sent to the client. */
    readonly detail?: string,
  ) {
    super(SCAN_MESSAGES[code]);
    this.name = "ScanError";
  }
}

/** The scanner's hard limits. */
export const SCAN_DEADLINE_MS = 8_000;
export const SCAN_MAX_BYTES = 1_000_000;
export const SCAN_PORTS = new Set(["", "443", "80"]);

export const HYBRID_GROUP = "X25519MLKEM768";
/** Offered in this order; OpenSSL ≥ 3.5 understands the hybrid group. */
export const OFFERED_GROUPS = `${HYBRID_GROUP}:X25519:P-256:P-384`;
/** Classical groups only: the fallback when this server's OpenSSL can't offer the hybrid group. */
export const CLASSICAL_GROUPS = "X25519:P-256:P-384";

export interface ServerCrypto {
  node: string;
  openssl: string;
  /** True when the server's OpenSSL is ≥ 3.5, so it can offer the hybrid post-quantum group. */
  pqCapable: boolean;
}

/** What this server's Node/OpenSSL can do — so a scan can say whether PQ is even possible here. */
export function serverCrypto(): ServerCrypto {
  const openssl = process.versions.openssl ?? "unknown";
  const m = /^(\d+)\.(\d+)/.exec(openssl);
  const pqCapable = !!m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 5));
  return { node: process.versions.node, openssl, pqCapable };
}

export interface RawTls {
  protocol: string | null;
  cipher: { name: string; standardName?: string };
  ephemeral: { type?: string; name?: string; size?: number } | null;
  cert?: {
    keyType?: string;
    bits?: number;
    curve?: string;
    sigAlg?: string;
    issuer?: string;
    validTo?: string;
  };
}

export interface TlsProbe {
  host: string;
  address: string;
  protocol: string | null;
  cipher: string;
  group: string;
  hybridPq: boolean;
  certKey: string;
  certSigAlg: string;
  issuer: string;
  validTo: string;
  /** Did this scanner manage to offer the hybrid post-quantum group (OpenSSL ≥ 3.5)? */
  pqOffered: boolean;
  /** Plain-text description, fed to the readiness scanner. */
  report: string;
}

// ── address policy ──────────────────────────────────────────────────────────────────────────

function v4Private(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number) as [number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/** True for loopback, private, link-local, CGNAT, documentation, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Private(ip);
  if (kind !== 6) return true;
  const x = ip.toLowerCase();
  if (x === "::" || x === "::1") return true;
  const mapped =
    /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  if (mapped) return v4Private(mapped[1]!);
  // ULA, link-local, multicast, documentation, IPv4-mapped (any form), and the tunnels that embed
  // an IPv4 address (6to4 2002::/16, NAT64 64:ff9b::/96 and the local-use 64:ff9b:1::/48).
  return (
    /^(f[cd]|fe[89ab]|ff|2001:db8|2001:0db8|2002:|64:ff9b:|0:0:0:0:0:ffff:)/.test(x) ||
    x.startsWith("::ffff:")
  );
}

/**
 * Validates user input and returns the hostname to probe. Throws a ScanError.
 * Only https (and http, accepted as a way of naming a host: nothing is ever fetched over HTTP) on
 * the default ports 443/80. Every other scheme (file:, gopher:, ftp:, data:, javascript:, ...) is
 * rejected, as are credentials, local names and private literal addresses.
 */
export function hostFromInput(input: string): string {
  const raw = input.trim();
  if (!raw || raw.length > 2048) throw new ScanError("invalid_input");
  let url: URL;
  try {
    // A scheme is anything before ':' (not just '://'), so "data:..." and "javascript:..." are caught.
    url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/:]+:\d+(\/|$)/.test(raw) ? raw : `https://${raw}`,
    );
  } catch {
    throw new ScanError("invalid_input");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new ScanError("invalid_input", `scheme ${url.protocol}`);
  if (url.username || url.password) throw new ScanError("invalid_input", "credentials in URL");
  if (!SCAN_PORTS.has(url.port)) throw new ScanError("blocked_target", `port ${url.port}`);
  const host = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new ScanError("blocked_target", `literal ${host}`);
    return host;
  }
  if (
    !host.includes(".") ||
    /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|arpa)$/.test(host)
  )
    throw new ScanError("blocked_target", `name ${host}`);
  if (host.length > 253) throw new ScanError("invalid_input", "hostname too long");
  return host;
}

// ── describing what was negotiated ──────────────────────────────────────────────────────────

export function describeCertKey(c: RawTls["cert"]): string {
  if (!c?.keyType) return "unknown";
  if (c.keyType === "rsa" || c.keyType === "rsa-pss") return `RSA ${c.bits ?? "?"} bit`;
  if (c.keyType === "ec") return `ECDSA ${c.curve ?? ""}`.trim();
  if (c.keyType === "ed25519" || c.keyType === "ed448") return c.keyType.toUpperCase();
  return c.keyType;
}

export function describeTls(
  host: string,
  address: string,
  raw: RawTls,
  pqOffered = true,
): TlsProbe {
  const cipher = raw.cipher.standardName ?? raw.cipher.name;
  const group =
    raw.ephemeral?.name ??
    (raw.ephemeral?.type && raw.ephemeral.type !== "TLSGroup" ? raw.ephemeral.type : "unknown");
  const hybridPq = group.toUpperCase() === HYBRID_GROUP;
  const certKey = describeCertKey(raw.cert);
  const certSigAlg = raw.cert?.sigAlg ?? "";
  const report = [
    `# TLS details for ${host}`,
    `protocol = ${raw.protocol}`,
    `cipher = ${cipher}`,
    `key_exchange_group = ${group}`,
    // The scanner reads "ECDH"/"X25519" as quantum-vulnerable; say what classical group was used.
    ...(hybridPq || group === "unknown" || /X25519/i.test(group)
      ? []
      : [`key_exchange = ECDHE ${group}`]),
    `certificate_key = ${certKey}`,
    `certificate_signature = ${certSigAlg}`,
  ].join("\n");
  return {
    host,
    address,
    protocol: raw.protocol,
    cipher,
    group,
    hybridPq,
    pqOffered,
    certKey,
    certSigAlg,
    issuer:
      raw.cert?.issuer
        ?.split("\n")
        .find((l) => l.startsWith("O="))
        ?.slice(2) ?? "",
    validTo: raw.cert?.validTo ?? "",
    report,
  };
}

// ── the probe ───────────────────────────────────────────────────────────────────────────────

export interface ProbeDeps {
  lookup?: (host: string) => Promise<{ address: string }[]>;
  connect?: (
    address: string,
    servername: string,
    deadline: number,
    port?: number,
    groups?: string,
  ) => Promise<RawTls>;
}

const defaultLookup = async (host: string) => dnsLookup(host, { all: true, verbatim: true });

/**
 * A TLS handshake with `address` (an IP that has already been checked: the hostname is only the
 * SNI, so DNS can't be asked again and rebound). Port 443 only. A raw TCP socket underneath lets us
 * count the bytes the server sends: past SCAN_MAX_BYTES, or past the deadline, it is destroyed.
 */
function defaultConnect(
  address: string,
  servername: string,
  deadline: number,
  port = 443,
  groups: string = OFFERED_GROUPS,
): Promise<RawTls> {
  return new Promise((resolve, reject) => {
    const left = Math.max(1, deadline - Date.now());
    const raw = net.connect({ host: address, port });
    const done = (fn: () => void) => {
      clearTimeout(timer);
      clearInterval(meter);
      fn();
    };
    const fail = (e: ScanError) =>
      done(() => {
        raw.destroy();
        reject(e);
      });
    const timer = setTimeout(() => fail(new ScanError("timeout", `after ${left} ms`)), left);
    const meter = setInterval(() => {
      if (raw.bytesRead > SCAN_MAX_BYTES) fail(new ScanError("too_large", `${raw.bytesRead} B`));
    }, 20);
    const socket = tls.connect(
      {
        socket: raw,
        servername: isIP(servername) ? undefined : servername,
        ecdhCurve: groups,
        // We are describing the server, not trusting it.
        rejectUnauthorized: false,
      },
      () => {
        if (raw.bytesRead > SCAN_MAX_BYTES) return fail(new ScanError("too_large"));
        const cert = socket.getPeerX509Certificate();
        const details = cert?.publicKey.asymmetricKeyDetails as
          { modulusLength?: number; namedCurve?: string } | undefined;
        const out: RawTls = {
          protocol: socket.getProtocol(),
          cipher: socket.getCipher(),
          ephemeral: socket.getEphemeralKeyInfo() as RawTls["ephemeral"],
          cert: cert && {
            keyType: cert.publicKey.asymmetricKeyType,
            bits: details?.modulusLength,
            curve: details?.namedCurve,
            sigAlg: (cert as unknown as { signatureAlgorithm?: string }).signatureAlgorithm,
            issuer: cert.issuer,
            validTo: cert.validTo,
          },
        };
        done(() => {
          socket.end();
          resolve(out);
        });
      },
    );
    socket.on("error", (e) => fail(new ScanError("unreachable", e.message)));
    raw.on("error", (e) => fail(new ScanError("unreachable", e.message)));
  });
}

/** The socket step on its own, for the limit tests (a hostile local server on any port). */
export const connectForTest = defaultConnect;

/** Rejects with a timeout ScanError if `p` hasn't settled by the deadline. */
function before<T>(p: Promise<T>, deadline: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new ScanError("timeout", "DNS")),
      Math.max(1, deadline - Date.now()),
    );
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/**
 * Validates the input, resolves it (every address must be public), then handshakes with the first
 * checked address, all within SCAN_DEADLINE_MS. Throws ScanError only.
 */
export async function probeTls(input: string, deps: ProbeDeps = {}): Promise<TlsProbe> {
  const deadline = Date.now() + SCAN_DEADLINE_MS;
  const host = hostFromInput(input);
  const addresses = isIP(host)
    ? [{ address: host }]
    : await before((deps.lookup ?? defaultLookup)(host), deadline).catch((e: unknown) => {
        throw e instanceof ScanError ? e : new ScanError("unresolvable", String(e));
      });
  if (!addresses.length) throw new ScanError("unresolvable", "no records");
  // Every address must be public: a split-horizon record could otherwise point inside.
  const bad = addresses.find((a) => isPrivateAddress(a.address));
  if (bad) throw new ScanError("blocked_target", `${host} → ${bad.address}`);
  const address = addresses[0]!.address;

  // The scanner only offers the hybrid post-quantum group if its own OpenSSL is ≥ 3.5; on an older
  // runtime it would throw, so we go straight to classical and report "post-quantum: not offered".
  const canOfferPq = deps.connect ? true : serverCrypto().pqCapable;
  const attempt = (groups: string) =>
    (deps.connect ?? defaultConnect)(address, host, deadline, 443, groups);
  const asScanError = (e: unknown) =>
    e instanceof ScanError ? e : new ScanError("unreachable", String(e));

  let pqOffered = canOfferPq;
  let raw: RawTls;
  try {
    raw = await attempt(canOfferPq ? OFFERED_GROUPS : CLASSICAL_GROUPS);
  } catch (first) {
    const se = asScanError(first);
    // A hard failure (timeout, too big, blocked) won't improve by retrying — report it as-is.
    // Otherwise the handshake may have failed on the hybrid group, so retry with classical only.
    if (
      !canOfferPq ||
      se.code === "timeout" ||
      se.code === "too_large" ||
      se.code === "blocked_target"
    )
      throw se;
    try {
      raw = await attempt(CLASSICAL_GROUPS);
      pqOffered = false;
    } catch (second) {
      throw asScanError(second);
    }
  }
  return describeTls(host, address, raw, pqOffered);
}
