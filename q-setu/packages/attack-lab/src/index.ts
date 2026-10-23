/** @qsetu/attack-lab: record, sign, map, group and replay the attacks Shield flags. */
export {
  createRecorder,
  recordedShield,
  SYNTHETIC_HEADER,
  type Recorder,
  type RecorderOptions,
} from "./detect";
export { assertSandbox, HostRefused, sandboxUrl } from "./hostguard";
export { classify, groupPatterns, RULES } from "./patterns";
export { clientFamily, hashOf, routeClass, safeRoute } from "./privacy";
export {
  MAX_REPLAY_STEPS,
  replay,
  stepsFromTimeline,
  type ReplayReport,
  type ReplayStep,
  type ReplayStepResult,
} from "./replay";
export { startSandbox, TRAP_PATH, type Sandbox, type SandboxOptions } from "./sandbox";
export { startLabServer } from "./server";
export { createSigner, loadSigner, verifyRecord, type Signer } from "./sign";
export { SCENARIOS, simulate, SITE_HEADER } from "./simulate";
export { CustomerRegistry, DEMO_CUSTOMERS, type Customer, type CustomerPatch } from "./customers";
export {
  DEFAULT_SITE,
  EvidenceStore,
  type ChainReport,
  type IncidentCheck,
  type StoreOptions,
} from "./store";
export { buildTimeline, phaseOf, type Timeline } from "./timeline";
export type * from "./types";
