/** @qsetu/edge: the `edge` profile, a budgeted device and its gateway. */
export * from "./budget";
export * from "./device";
export * from "./gateway";
export { getProfile } from "@qsetu/core";
export const EDGE_PROFILE_ID = "edge" as const;
