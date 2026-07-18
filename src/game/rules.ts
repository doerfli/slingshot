// Win/lose bookkeeping and the near-miss readout. Scoring/stars are a Phase 2 concern
// but the seam lives here so it slots in without touching the loop.

import type { Vec2 } from '../sim/vec';
import { dist } from '../sim/vec';
import type { Target } from '../sim/types';

/** Closest a flight path came to the target center (world units). Used for the
 *  near-miss feedback the spec asks for on a failed shot (§7). */
export function closestApproach(trail: Vec2[], target: Target): number {
  let min = Infinity;
  for (const p of trail) {
    const d = dist(p, target.c);
    if (d < min) min = d;
  }
  // Distance to the *edge* of the target zone reads more intuitively than to center.
  return Math.max(0, min - target.radius);
}

/** Phase 2 stub: 3 stars at/under par, then one fewer per extra attempt (min 1). */
export function starsFor(attempts: number, par: number): number {
  if (attempts <= par) return 3;
  if (attempts <= par + 1) return 2;
  return 1;
}
