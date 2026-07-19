// Win/lose bookkeeping and the near-miss readout. Scoring/stars are a Phase 2 concern
// but the seam lives here so it slots in without touching the loop.

import type { Vec2 } from '../sim/vec';
import { dist } from '../sim/vec';
import type { Body, Target } from '../sim/types';

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

/** The point on a flight path that came closest to the target center, so the near-miss
 *  readout can be shown *spatially* (a marker on the canvas), not just as a number.
 *  Returns null for an empty trail. */
export function closestApproachPoint(trail: Vec2[], target: Target): Vec2 | null {
  let best: Vec2 | null = null;
  let min = Infinity;
  for (const p of trail) {
    const d = dist(p, target.c);
    if (d < min) {
      min = d;
      best = p;
    }
  }
  return best;
}

/** Phase 2 stub: 3 stars at/under par, then one fewer per extra attempt (min 1). */
export function starsFor(attempts: number, par: number): number {
  if (attempts <= par) return 3;
  if (attempts <= par + 1) return 2;
  return 1;
}

/** Clearance from a point to the NEAREST gravity-body surface (dist-to-center − radius);
 *  negative inside a body, +Infinity when there are no bodies. The game loop tracks the
 *  minimum of this over a winning flight as the level's "style" score (spec §10): a
 *  daring graze clears the surface by less, so a smaller gap is the more elegant line. */
export function surfaceGap(p: Vec2, bodies: Body[]): number {
  let min = Infinity;
  for (const b of bodies) {
    const gap = dist(p, b.c) - b.radius;
    if (gap < min) min = gap;
  }
  return min;
}

/** World-units clearance at or under which a winning flyby counts as a daring graze —
 *  earns the "Clean flyby" style badge. Tunable. */
export const GRAZE_THRESHOLD = 26;
