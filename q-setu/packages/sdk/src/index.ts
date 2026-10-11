/**
 * @qsetu/sdk: make any app quantum-safe. Hybrid ML-KEM (FIPS 203) + ML-DSA (FIPS 204).
 *
 *   const keys = generateKeys();                     // once, per service
 *   const box  = seal({ amountINR: "500" }, peer);   // one-shot encrypt (and sign with `keys`)
 *   const s    = await createSession({ url, serverKey }); await s.send({ hello: "world" });
 */
export {
  generateKeys,
  publicKeys,
  seal,
  open,
  openJSON,
  sign,
  verify,
  type Keys,
  type PublicKeys,
} from "./keys";
export {
  createSession,
  type ClientSession,
  type CreateSessionOptions,
  type HandshakeStats,
} from "./session-client";
export {
  createSessionServer,
  type SessionServer,
  type SessionServerOptions,
  type MessageHandler,
} from "./session-server";
export { toBytes, asJSON, asText, type Data } from "./data";
export {
  PROFILES,
  getProfile,
  createIdentity,
  keyId,
  type Identity,
  type ProfileId,
  type EnvelopeJSON,
} from "@qsetu/core";
