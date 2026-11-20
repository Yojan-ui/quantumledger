/**
 * The Attack Lab engine's shapes, as its API returns them. Type-only: the website reads the engine
 * (packages/attack-lab) over its local API and never runs any of it in the web server.
 */
export type {
  AttackEvent,
  ChainReport,
  Customer,
  Incident,
  IncidentCheck,
  Pattern,
  Phase,
  ReplayReport,
  ReplayStepResult,
  Timeline,
  TimelineStep,
} from "../../../../packages/attack-lab/src";
import type {
  AttackEvent,
  Incident,
  IncidentCheck,
  ReplayReport,
  ReplayStepResult,
  Timeline,
} from "../../../../packages/attack-lab/src";

export type IncidentSummary = Omit<Incident, "eventHashes"> & {
  pattern: { id: string; name: string };
  steps: number;
  durationMs: number;
  actions: Record<string, number>;
  sealed: boolean;
};

export interface EngineOverview {
  incidents: IncidentSummary[];
  totals: { incidents: number; events: number; flagged: number; records: number; patterns: number };
  key: { alg: string; keyId: string; publicKey: string };
  simulating: boolean;
}

export interface IncidentDetail {
  incident: Incident;
  pattern: { id: string; name: string; description: string };
  timeline: Timeline;
  events: (AttackEvent & { id: string; seq: number; hash: string; sig: string })[];
  seal?: { seq: number; hash: string; covers: number };
  check: IncidentCheck;
  key: { alg: string; keyId: string };
}

export interface ReplayJob {
  id: string;
  incidentId: string;
  site: string;
  pattern: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "done" | "failed";
  total: number;
  steps: ReplayStepResult[];
  report?: ReplayReport;
  error?: string;
}
