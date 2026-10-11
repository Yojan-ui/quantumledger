/**
 * URL readiness probe. Connects to a public host on 443, offering the hybrid post-quantum group
 * (X25519MLKEM768) first, and records what the server actually negotiated: TLS version, cipher
 * suite, key-exchange group, certificate key and signature. Only public addresses are allowed, and
 * the socket goes to the exact IP that was checked (no DNS-rebinding window).
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import tls from "node:tls";

export const HYBRID_GROUP = "X25519MLKEM768";
/** Offered in this order; OpenSSL ≥ 3.5 understands the hybrid group. */
export const OFFERED_GROUPS = `${HYBRID_GROUP}:X25519:P-256:P-384`;

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
  return /^(f[cd]|fe[89ab]|ff|2001:db8|2001:0db8)/.test(x) || x.startsWith("::ffff:");
}

/** Validates user input and returns the hostname to probe. Throws with a user-facing message. */
export function hostFromInput(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Enter a hostname or https:// URL");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error("That doesn't look like a hostname or URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Only http(s) URLs can be scanned");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  const host = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("Refusing to scan a private or local address");
    return host;
  }
  if (!host.includes(".") || /(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host))
    throw new Error("Only public hostnames can be scanned");
  if (host.length > 253) throw new Error("Hostname too long");
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

export function describeTls(host: string, address: string, raw: RawTls): TlsProbe {
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
  connect?: (address: string, servername: string) => Promise<RawTls>;
}

const defaultLookup = async (host: string) => dnsLookup(host, { all: true });

function defaultConnect(address: string, servername: string): Promise<RawTls> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: address,
        servername: isIP(servername) ? undefined : servername,
        port: 443,
        timeout: 6000,
        ecdhCurve: OFFERED_GROUPS,
        // We are describing the server, not trusting it.
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerX509Certificate();
        const details = cert?.publicKey.asymmetricKeyDetails as
          { modulusLength?: number; namedCurve?: string } | undefined;
        const raw: RawTls = {
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
        socket.end();
        resolve(raw);
      },
    );
    socket.on("error", (e) => reject(new Error(`TLS connection failed: ${e.message}`)));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TLS connection timed out"));
    });
  });
}

export async function probeTls(input: string, deps: ProbeDeps = {}): Promise<TlsProbe> {
  const host = hostFromInput(input);
  const addresses = isIP(host)
    ? [{ address: host }]
    : await (deps.lookup ?? defaultLookup)(host).catch(() => {
        throw new Error(`Could not resolve ${host}`);
      });
  if (!addresses.length) throw new Error(`Could not resolve ${host}`);
  // Every address must be public: a split-horizon record could otherwise point inside.
  if (addresses.some((a) => isPrivateAddress(a.address)))
    throw new Error("Refusing to scan a private or local address");
  const address = addresses[0]!.address;
  const raw = await (deps.connect ?? defaultConnect)(address, host);
  return describeTls(host, address, raw);
}
