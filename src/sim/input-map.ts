// Drag gesture → launch velocity. PURE and deterministic (spec §3.3): the same drag
// vector always yields the same launch velocity, and this one function feeds BOTH the
// live preview and the real launch, so they can never disagree.
//
// Convention: slingshot pull-back-to-fire-forward. The drag vector points from the pad
// to the current pointer (the "pull"); the probe launches in the OPPOSITE direction.
// Drag length sets speed (capped); drag direction sets heading.

import type { Vec2 } from './vec';
import { len, scale } from './vec';
import { MAX_SPEED, POWER_SCALE } from './constants';

/**
 * @param drag pad → pointer vector (world units).
 * @returns launch velocity (world units/sec), fired opposite the pull, speed-capped.
 */
export function dragToLaunchVelocity(drag: Vec2): Vec2 {
  const pull = len(drag);
  if (pull === 0) return { x: 0, y: 0 };

  const speed = Math.min(pull * POWER_SCALE, MAX_SPEED);
  // Fire opposite the pull: velocity = -drag/|drag| * speed.
  return scale(drag, -speed / pull);
}

/** The speed a given drag would produce (for HUD/power readouts). */
export function dragToSpeed(drag: Vec2): number {
  return Math.min(len(drag) * POWER_SCALE, MAX_SPEED);
}
