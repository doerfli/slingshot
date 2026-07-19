// Shared simulation/level types. Kept in one place so sim/, render/, and game/
// all agree on the world's shape without circular imports.

import type { Vec2 } from './vec';

/**
 * A gravity body. `strength` folds `G·M` into a single per-level-tunable constant
 * (the spec uses no real units — readability beats realism). `radius` is the lethal
 * surface radius. A body flagged `isTarget` is the goal instead of a hazard, so
 * touching its surface is a win, not a crash.
 */
export interface Body {
  c: Vec2;
  strength: number;
  radius: number;
  isTarget?: boolean;
}

/** The target zone (a ring/pad the probe must reach). Separate from gravity bodies. */
export interface Target {
  c: Vec2;
  radius: number;
}

/**
 * An inert hazard (asteroid / debris). Unlike a gravity {@link Body} it exerts no
 * pull — it only kills on contact. Kept a distinct type so hazards never enter the
 * gravity sum (which would perturb determinism) and can be drawn as a distinct shape.
 */
export interface Hazard {
  c: Vec2;
  radius: number;
}

/** World-space play area. Leaving it (plus a short grace) fails the shot. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Level {
  id: number;
  name: string;
  /** Fixed launch-pad position. */
  pad: Vec2;
  bodies: Body[];
  /** Inert lethal obstacles (asteroids/debris). Exert no gravity. */
  hazards?: Hazard[];
  target: Target;
  bounds: Bounds;
  /** How many predicted points the partial preview draws (difficulty lever). */
  previewLength: number;
  /** Target attempt count for star scoring (used in Phase 2). */
  par: number;
}

/** Outcome of a single-position collision test. Time-based fails (off-screen grace,
 *  max flight time) are layered on top of this by the game loop. */
export type Outcome = 'flying' | 'crash' | 'win' | 'offscreen';
