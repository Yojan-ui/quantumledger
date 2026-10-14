import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A throwaway self-signed ECDSA P-256 certificate for the given names (test only). */
export function selfSigned(names: string[]): { key: string; cert: string } {
  const dir = mkdtempSync(join(tmpdir(), "edge-cert-"));
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-256",
      "-nodes",
      "-keyout",
      join(dir, "k.pem"),
      "-out",
      join(dir, "c.pem"),
      "-days",
      "2",
      "-subj",
      `/CN=${names[0]}`,
      "-addext",
      `subjectAltName=${names.map((n) => `DNS:${n}`).join(",")}`,
    ],
    { stdio: "ignore" },
  );
  return {
    key: readFileSync(join(dir, "k.pem"), "utf8"),
    cert: readFileSync(join(dir, "c.pem"), "utf8"),
  };
}
