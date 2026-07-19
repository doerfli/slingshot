// Per-position collision test. Pure geometry: given the probe's current position and
// the level, classify it. Time-based fails (off-screen grace, max flight time) are
// layered on top by the game loop — this function only sees a position.

import type { Vec2 } from './vec';
import { dist2 } from './vec';
import type { Level, Outcome } from './types';

export function check(p: Vec2, level: Level): Outcome {
  // Reaching the target zone is a win — checked first so a target sitting near a
  // body still registers.
  if (dist2(p, level.target.c) <= level.target.radius * level.target.radius) {
    return 'win';
  }

  // Any body surface: crash, unless that body is itself the target.
  for (let i = 0; i < level.bodies.length; i++) {
    const b = level.bodies[i];
    if (dist2(p, b.c) <= b.radius * b.radius) {
      return b.isTarget ? 'win' : 'crash';
    }
  }

  // Inert hazards (asteroids/debris) — lethal on contact, no gravity. Fixed order.
  if (level.hazards) {
    for (let i = 0; i < level.hazards.length; i++) {
      const h = level.hazards[i];
      if (dist2(p, h.c) <= h.radius * h.radius) {
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
