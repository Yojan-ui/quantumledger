/**
 * A self-signed ECDSA P-256 certificate, made in-process with node:crypto (no openssl CLI, no
 * library): for tests, local demos and the website's live side-by-side. Never for a real site:
 * browsers won't trust it, and the edge gets real certificates from ACME.
 *
 * The X.509 structure (RFC 5280) is DER-encoded by hand: version 3, a random serial,
 * ecdsa-with-SHA256, CN = the first name, a validity window, the public key, and a
 * subjectAltName with every name. Node's own X509Certificate parses the result (see the tests).
 */
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";

const len = (n: number): Buffer => {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let x = n; x > 0; x >>= 8) bytes.unshift(x & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
};
const tlv = (tag: number, ...parts: Buffer[]) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), len(body.length), body]);
};
const seq = (...p: Buffer[]) => tlv(0x30, ...p);
const set = (...p: Buffer[]) => tlv(0x31, ...p);
const oid = (dotted: string) => {
  const [a, b, ...rest] = dotted.split(".").map(Number) as [number, number, ...number[]];
  const out = [40 * a + b];
  for (const n of rest) {
    const chunk: number[] = [n & 0x7f];
    for (let x = n >> 7; x > 0; x >>= 7) chunk.unshift((x & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
};
const utf8 = (s: string) => tlv(0x0c, Buffer.from(s, "utf8"));
const time = (d: Date) => {
  // UTCTime for 1950–2049, GeneralizedTime after (RFC 5280 §4.1.2.5).
  const iso = d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return d.getUTCFullYear() < 2050
    ? tlv(0x17, Buffer.from(`${iso.slice(2)}Z`))
    : tlv(0x18, Buffer.from(`${iso}Z`));
};

const ECDSA_SHA256 = seq(oid("1.2.840.10045.4.3.2"));

export function selfSignedCert(names: string[], days = 30): { key: string; cert: string } {
  if (!names.length) throw new Error("at least one name");
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const spki = publicKey.export({ type: "spki", format: "der" });
  const serial = randomBytes(16);
  serial[0]! &= 0x7f; // positive INTEGER
  const name = seq(set(seq(oid("2.5.4.3"), utf8(names[0]!))));
  const now = Date.now();
  const san = seq(
    oid("2.5.29.17"),
    tlv(0x04, seq(...names.map((n) => tlv(0x82, Buffer.from(n, "ascii"))))),
  );
  const basic = seq(oid("2.5.29.19"), tlv(0x04, seq()));
  const tbs = seq(
    tlv(0xa0, tlv(0x02, Buffer.from([2]))), // v3
    tlv(0x02, serial),
    ECDSA_SHA256,
    name,
    seq(time(new Date(now - 60_000)), time(new Date(now + days * 86_400_000))),
    name,
    spki,
    tlv(0xa3, seq(san, basic)),
  );
  const sig = sign("sha256", tbs, privateKey); // DER ECDSA signature
  const der = seq(tbs, ECDSA_SHA256, tlv(0x03, Buffer.concat([Buffer.from([0]), sig])));
  const pem = `-----BEGIN CERTIFICATE-----\n${der
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n")}\n-----END CERTIFICATE-----\n`;
  return { key: privateKey.export({ type: "pkcs8", format: "pem" }) as string, cert: pem };
}
