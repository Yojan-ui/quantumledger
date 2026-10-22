/**
 * The Attack Lab engine's shapes, as its API returns them. Type-only: the website reads the engine
 * (packages/attack-lab) over its local API and never runs any of it in the web server.
 */
export type {
  AttackEvent,
  ClientFamily,
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
  Verdict,
  Metrics,
  Threat,
  ModelUpdate,
} from "../../../../packages/attack-lab/src";
import type {
  AttackEvent,
  Metrics,
  ModelUpdate,
  Threat,
  Verdict,
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
  threat?: ThreatRef;
};

export interface ThreatRef {
  id: string;
  title: string;
  date: string;
}

export interface ModelSummary {
  version?: string;
  metrics?: Metrics;
  trainedAt?: number;
  lastSigned?: { seq: number; hash: string; at: number };
  updates: number;
}

export interface ModelDetail extends ModelSummary {
  features: { id: string; simple: string; technical: string }[];
  history: (ModelUpdate & { seq: number; hash: string })[];
  threats: Threat[];
}

export interface EngineOverview {
  incidents: IncidentSummary[];
  totals: { incidents: number; events: number; flagged: number; records: number; patterns: number };
  key: { alg: string; keyId: string; publicKey: string };
  model?: ModelSummary;
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
  verdict?: { verdict: Verdict; signed: boolean; eventId: string };
  threat?: ThreatRef;
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
