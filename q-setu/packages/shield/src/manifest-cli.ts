/**
 * qsetu-manifest: build and check the ML-DSA-65 signed asset manifest.
 *
 *   qsetu-manifest sign  --key identity.json --site https://www.example.com \
 *                        --root .next/static=/_next/static --root public=/ --out public/.well-known/qsetu-manifest.json
 *   qsetu-manifest check https://www.example.com --pub <base64 ML-DSA-65 public key>
 *
 * The identity file holds the private key (0600, never printed); create one with --key on first use.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { base64ToBytes, bytesToBase64, createIdentity } from "@qsetu/core";
import { buildManifest, checkSite } from "./manifest";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    key: { type: "string" },
    site: { type: "string" },
    root: { type: "string", multiple: true },
    out: { type: "string" },
    pub: { type: "string" },
  },
});

function identity(path: string) {
  if (existsSync(path)) {
    const j = JSON.parse(readFileSync(path, "utf8")) as { publicKey: string; secretKey: string };
    return {
      profile: "standard" as const,
      publicKey: base64ToBytes(j.publicKey),
      secretKey: base64ToBytes(j.secretKey),
    };
  }
  const id = createIdentity("standard");
  writeFileSync(
    path,
    JSON.stringify({
      profile: "standard",
      publicKey: bytesToBase64(id.publicKey),
      secretKey: bytesToBase64(id.secretKey),
    }),
  );
  chmodSync(path, 0o600);
  console.error(`Created a new ML-DSA-65 key in ${path} (keep it secret; back it up).`);
  return id;
}

const [cmd, target] = positionals;
if (cmd === "sign" && values.key && values.site && values.root?.length && values.out) {
  const id = identity(values.key);
  const m = buildManifest({
    roots: values.root.map((r) => r.split("=") as [string, string]),
    site: values.site,
    identity: id,
  });
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, JSON.stringify(m, null, 1) + "\n");
  console.log(
    `Signed ${Object.keys(m.files).length} files · key ${m.keyId} · public key: ${bytesToBase64(id.publicKey)}`,
  );
} else if (cmd === "check" && target && values.pub) {
  const r = await checkSite(target, values.pub);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.signature.ok && !r.mismatched.length ? 0 : 1);
} else {
  console.error(
    "Usage: qsetu-manifest sign --key f --site url --root dir=/prefix --out file | check <url> --pub <base64>",
  );
  process.exit(2);
}
