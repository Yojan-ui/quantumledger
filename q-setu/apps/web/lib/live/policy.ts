/**
 * Crypto-agility policy: which profile new sessions handshake with and which algorithm signs
 * transactions. Changing it never restarts anything. Each live session keeps its current keys and
 * adopts the new generation at its next rotation.
 */
import type { PolicyState, ProfileName, SigName } from "./types";

export const SIG_FOR_PROFILE: Record<ProfileName, SigName> = {
  standard: "ml-dsa-65",
  edge: "ml-dsa-44",
  maximum: "ml-dsa-87",
};

export class Policy {
  private state: PolicyState;
  private readonly listeners = new Set<(next: PolicyState, prev: PolicyState) => void>();

  constructor(private readonly now: () => number = Date.now) {
    this.state = { profile: "standard", sig: "ml-dsa-65", generation: 1, changedAt: now() };
  }

  get(): PolicyState {
    return { ...this.state };
  }

  /** Applies a change. A request that matches the current policy is a no-op (same generation). */
  set(change: { profile?: ProfileName; sig?: SigName }): PolicyState {
    const profile = change.profile ?? this.state.profile;
    const sig = change.sig ?? (change.profile ? SIG_FOR_PROFILE[profile] : this.state.sig);
    if (profile === this.state.profile && sig === this.state.sig) return this.get();
    const prev = this.state;
    this.state = { profile, sig, generation: prev.generation + 1, changedAt: this.now() };
    this.listeners.forEach((fn) => fn(this.get(), prev));
    return this.get();
  }

  onChange(fn: (next: PolicyState, prev: PolicyState) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
}
