import type { Role } from "@/components/ui/Role";

export type Vec3 = [number, number, number];

/** One "shot" of a directed demo: where the camera is, what's in focus, and the one-line caption. */
export interface Shot {
  id: string;
  camera: { position: Vec3; target: Vec3; fov?: number };
  /** Id of the subject in focus: everything else softens. */
  focus?: string;
  /** One line, at most 12 words: what is happening to the data right now. */
  caption: string;
  /** Which HUD step this shot belongs to (index into the demo's steps). */
  step?: number;
  enter?: () => void;
  exit?: () => void;
}

export interface Step {
  label: string;
  role: Role;
}

/** The director's state, passed as props into the 3D scene (React context doesn't cross into drei Views). */
export interface DirectorState {
  index: number;
  shot: Shot;
  /** True once the camera has arrived and the hold has begun (labels fade in). */
  settled: boolean;
  reduce: boolean;
  /** Bumps on Replay so scenes can restart their own animations. */
  take: number;
}
