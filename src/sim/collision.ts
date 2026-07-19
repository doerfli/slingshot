// Per-position collision test. Pure geometry: given the probe's current position and
// the level, classify it. Time-based fails (off-screen grace, max flight time) are
// layered on top by the game loop — this function only sees a position.
//
// Moving bodies/targets/hazards (Phase 3): every entity is positioned at sim time `t`
// via the same pure functions the integrator uses (sim/bodies), so collision agrees
// with the flown path. `t` defaults to 0, keeping static levels bit-for-bit unchanged.

import type { Vec2 } from './vec';
import { dist2 } from './vec';
import type { Level, Outcome } from './types';
import { positionAt } from './bodies';

export function check(p: Vec2, level: Level, t = 0): Outcome {
  // Reaching the target zone is a win — checked first so a target sitting near a
  // body still registers.
  const tc = positionAt(level.target.c, level.target.motion, t);
  if (dist2(p, tc) <= level.target.radius * level.target.radius) {
    return 'win';
  }

  // Any body surface: crash, unless that body is itself the target. Fixed order.
  for (let i = 0; i < level.bodies.length; i++) {
    const b = level.bodies[i];
    const bc = positionAt(b.c, b.motion, t);
    if (dist2(p, bc) <= b.radius * b.radius) {
      return b.isTarget ? 'win' : 'crash';
    }
  }

  // Inert hazards (asteroids/debris) — lethal on contact, no gravity. Fixed order.
  if (level.hazards) {
    for (let i = 0; i < level.hazards.length; i++) {
      const h = level.hazards[i];
      const hc = positionAt(h.c, h.motion, t);
      if (dist2(p, hc) <= h.radius * h.radius) {
        return 'crash';
      }
    }
  }

  // Outside the play area (the loop adds the short grace window before failing).
  const { minX, minY, maxX, maxY } = level.bounds;
  if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
    return 'offscreen';
  }

  return 'flying';
}
