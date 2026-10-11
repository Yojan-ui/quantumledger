/** Loads or creates a Shield node's ML-DSA identity (FIPS 204). The secret key is stored 0600 and never printed. */
import {
  base64ToBytes,
  bytesToBase64,
  createIdentity,
  isProfileId,
  type Identity,
  type ProfileId,
} from "@qsetu/core";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

export function loadOrCreateIdentity(path: string | undefined, profile: ProfileId): Identity {
  if (path && existsSync(path)) {
    const j = JSON.parse(readFileSync(path, "utf8")) as {
      profile: string;
      publicKey: string;
      secretKey: string;
    };
    if (!isProfileId(j.profile)) throw new Error(`Bad profile in ${path}`);
    return {
      profile: j.profile,
      publicKey: base64ToBytes(j.publicKey),
      secretKey: base64ToBytes(j.secretKey),
    };
  }
  const id = createIdentity(profile);
  if (path) {
    writeFileSync(
      path,
      JSON.stringify({
        profile,
        publicKey: bytesToBase64(id.publicKey),
        secretKey: bytesToBase64(id.secretKey),
      }),
    );
    chmodSync(path, 0o600);
  }
  return id;
}
