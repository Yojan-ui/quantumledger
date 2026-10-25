/**
 * A TLS ClientHello reader. The edge reads the first TLS record off each new TCP connection before
 * handing the socket to Node's TLS server, because Node's server side can't say which key-exchange
 * group a connection used (`getEphemeralKeyInfo()` is client-only). The hello also gives the
 * fingerprint material the agent-defence engine uses (JA4).
 *
 * Parsing is defensive: a malformed or truncated hello returns undefined and the connection carries
 * on to OpenSSL, which rejects it properly. Nothing here is trusted for security; it's measurement.
 */
import { createHash } from "node:crypto";

/** IANA TLS group code points that matter here. */
export const GROUP = {
  X25519MLKEM768: 0x11ec,
  SecP256r1MLKEM768: 0x11eb,
  SecP384r1MLKEM1024: 0x11ed,
  X25519: 0x001d,
  secp256r1: 0x0017,
  secp384r1: 0x0018,
} as const;

/** Groups that combine a classical exchange with ML-KEM (any of them counts as post-quantum). */
export const PQ_GROUPS: ReadonlySet<number> = new Set([
  GROUP.X25519MLKEM768,
  GROUP.SecP256r1MLKEM768,
  GROUP.SecP384r1MLKEM1024,
]);

export interface ClientHello {
  /** The highest version offered: 0x0304 for TLS 1.3 (via supported_versions), else legacy_version. */
  version: number;
  sni?: string;
  alpn: string[];
  ciphers: number[];
  /** Extension types in the order sent. */
  extensions: number[];
  groups: number[];
  /** Groups the client sent a key share for, in order. */
  keyShares: number[];
  sigAlgs: number[];
  versions: number[];
}

/** GREASE values (RFC 8701) are random padding: ignored for fingerprints. */
const grease = (v: number) => (v & 0x0f0f) === 0x0a0a && v >> 8 === (v & 0xff);

/** Bytes needed for the whole first record, once the 5-byte header is in; undefined if not TLS. */
export function recordLength(head: Uint8Array): number | undefined {
  if (head.length < 5) return 0;
  if (head[0] !== 0x16 || head[1] !== 0x03) return undefined; // not a TLS handshake record
  return 5 + ((head[3]! << 8) | head[4]!);
}

export function parseClientHello(buf: Uint8Array): ClientHello | undefined {
  try {
    return parse(buf);
  } catch {
    return undefined;
  }
}

function parse(buf: Uint8Array): ClientHello | undefined {
  const total = recordLength(buf);
  if (!total || buf.length < total) return undefined;
  let p = 5;
  const u8 = () => {
    if (p >= total) throw new Error("short");
    return buf[p++]!;
  };
  const u16 = () => (u8() << 8) | u8();
  const u24 = () => (u8() << 16) | (u8() << 8) | u8();
  const skip = (n: number) => {
    p += n;
    if (p > total) throw new Error("short");
  };
  if (u8() !== 0x01) return undefined; // handshake type: client_hello
  const hsLen = u24();
  const end = Math.min(total, p + hsLen);
  const legacyVersion = u16();
  skip(32); // random
  skip(u8()); // legacy session id
  const ciphers: number[] = [];
  for (let n = u16() / 2; n > 0; n--) ciphers.push(u16());
  skip(u8()); // compression methods
  const hello: ClientHello = {
    version: legacyVersion,
    alpn: [],
    ciphers,
    extensions: [],
    groups: [],
    keyShares: [],
    sigAlgs: [],
    versions: [],
  };
  if (p >= end) return hello;
  const extEnd = p + 2 + u16();
  while (p + 4 <= extEnd) {
    const type = u16();
    const len = u16();
    const start = p;
    hello.extensions.push(type);
    if (type === 0 && len > 5) {
      // server_name: list length, name type (0 = host_name), name length, name
      skip(2);
      if (u8() === 0) {
        const n = u16();
        hello.sni = Buffer.from(buf.subarray(p, p + n)).toString("ascii");
      }
    } else if (type === 10) {
      for (let n = u16() / 2; n > 0; n--) hello.groups.push(u16());
    } else if (type === 51) {
      const listEnd = p + 2 + u16();
      while (p + 4 <= listEnd) {
        hello.keyShares.push(u16());
        skip(u16());
      }
    } else if (type === 16) {
      const listEnd = p + 2 + u16();
      while (p < listEnd) {
        const n = u8();
        hello.alpn.push(Buffer.from(buf.subarray(p, p + n)).toString("ascii"));
        skip(n);
      }
    } else if (type === 13) {
      for (let n = u16() / 2; n > 0; n--) hello.sigAlgs.push(u16());
    } else if (type === 43) {
      for (let n = u8() / 2; n > 0; n--) hello.versions.push(u16());
    }
    p = start + len;
    if (p > total) throw new Error("short");
  }
  const offered = hello.versions.filter((v) => !grease(v));
  if (offered.length) hello.version = Math.max(...offered);
  return hello;
}

/**
 * The group this edge will use with this client. The edge configures OpenSSL with the tuples
 * "X25519MLKEM768 / X25519:P-256": it picks X25519MLKEM768 whenever the client supports it, even if the
 * client sent only an X25519 key share (OpenSSL then asks for the right share, one extra round trip).
 * Verified against OpenSSL 3.5.8 in test/hello.test.ts. Below TLS 1.3 there is no hybrid group.
 */
export function negotiatedGroup(h: ClientHello): "X25519MLKEM768" | "X25519" | "other" {
  if (h.version < 0x0304) return "other";
  if (h.groups.includes(GROUP.X25519MLKEM768)) return "X25519MLKEM768";
  if (h.groups.includes(GROUP.X25519)) return "X25519";
  return "other";
}

const hex4 = (n: number) => n.toString(16).padStart(4, "0");
const sha12 = (s: string) =>
  s ? createHash("sha256").update(s).digest("hex").slice(0, 12) : "000000000000";

/**
 * The JA4 TLS client fingerprint (FoxIO, BSD-3-Clause spec): protocol, version, SNI or not, counts,
 * first and last ALPN characters, then truncated hashes of the sorted cipher list and the sorted
 * extension list plus signature algorithms. Over TCP, so the protocol letter is always "t".
 */
export function ja4(h: ClientHello): string {
  const v =
    { 0x0304: "13", 0x0303: "12", 0x0302: "11", 0x0301: "10", 0x0300: "s3" }[h.version] ?? "00";
  const ciphers = h.ciphers.filter((c) => !grease(c));
  const exts = h.extensions.filter((e) => !grease(e));
  const a0 = h.alpn[0] ?? "";
  const alpn = a0 ? `${a0[0]}${a0[a0.length - 1]}` : "00";
  const a = `t${v}${h.sni ? "d" : "i"}${String(Math.min(99, ciphers.length)).padStart(2, "0")}${String(Math.min(99, exts.length)).padStart(2, "0")}${alpn}`;
  const b = sha12(ciphers.map(hex4).sort().join(","));
  // Extensions without SNI (0) and ALPN (16), sorted; then the signature algorithms in order.
  const extList = exts
    .filter((e) => e !== 0 && e !== 16)
    .map(hex4)
    .sort()
    .join(",");
  const sig = h.sigAlgs
    .filter((s) => !grease(s))
    .map(hex4)
    .join(",");
  const c = sha12(sig ? `${extList}_${sig}` : extList);
  return `${a}_${b}_${c}`;
}
