"use client";

/**
 * "Trust gives mass": nothing in the 3D behaves like a solid object until it has been verified for
 * real. Each scene applies the same rules with its own small integration (velocity, gravity, a
 * bounce; no physics library):
 *   - a ghost (unverified): a loose cloud of jittering, translucent points (components/fx/Particles)
 *     that ignores gravity, drifts slowly and can't touch or push anything;
 *   - verified (a real signature or hash check passed): its points condense onto its shape over
 *     CONDENSE_MS, the solid shape appears with a short heavy "thunk" (a squash that springs back),
 *     falls under gravity, lands with a small bounce, settles, and pushes neighbours aside;
 *   - failed (a check failed or the item was tampered with): it never gains mass. It stays a ghost
 *     and flickers --danger, and solid objects push it away.
 * Under reduced motion every object shows its composed end state at once.
 */

/** The condense (points onto the shape) before an object takes its weight, ms. */
export const CONDENSE_MS = 320;
