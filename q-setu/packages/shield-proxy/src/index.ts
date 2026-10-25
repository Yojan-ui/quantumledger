/** @qsetu/shield-proxy: zero-code-change QuantumLedger sidecars. */
export { startShieldServer, type ShieldServerOptions } from "./server-node";
export { startShieldClient, type ShieldClientOptions } from "./client-node";
export { loadOrCreateIdentity } from "./identity-file";
export type { WireFrame } from "./wire";
export type { TunnelRequest, TunnelResponse } from "./tunnel";
export { startTunnelServer, type TunnelServerOptions } from "./v2/server";
export { startTunnelClient, type TunnelClientOptions } from "./v2/client";
