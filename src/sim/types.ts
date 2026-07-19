// Shared simulation/level types. Kept in one place so sim/, render/, and game/
// all agree on the world's shape without circular imports.

import type { Vec2 } from './vec';

/**
 * Scripted, deterministic motion for a body/target/hazard. Position is a PURE function
 * of sim time `t` (never wall-clock) so the preview predictor and the real sim agree
 * bit-for-bit (spec §5, §3.3). See {@link ./bodies.positionAt}.
 *
 * - `linear`: base + vel·t (a steady drift).
 * - `orbit`: center + radius·(cos, sin)(omega·t + phase) — a circular path, independent
 *   of the entity's base `c` (the author sets `c` to match the t=0 point for a clean
 *   initial frame).
 */
export type Motion =
  | { kind: 'linear'; vel: Vec2 }
  | { kind: 'orbit'; center: Vec2; radius: number; omega: number; phase?: number };

/**
 * A gravity body. `strength` folds `G·M` into a single per-level-tunable constant
 * (the spec uses no real units — readability beats realism). `radius` is the lethal
 * surface radius. A body flagged `isTarget` is the goal instead of a hazard, so
 * touching its surface is a win, not a crash. An optional `motion` puts it on a
 * scripted path (a moving body is what makes a *true* gravity assist possible).
 */
export interface Body {
  c: Vec2;
  strength: number;
  radius: number;
  isTarget?: boolean;
  motion?: Motion;
}

/** The target zone (a ring/pad the probe must reach). Separate from gravity bodies.
 *  May itself be on a scripted `motion` path (the "moving target" levels). */
export interface Target {
  c: Vec2;
  radius: number;
  motion?: Motion;
}

/**
 * An inert hazard (asteroid / debris). Unlike a gravity {@link Body} it exerts no
 * pull — it only kills on contact. Kept a distinct type so hazards never enter the
 * gravity sum (which would perturb determinism) and can be drawn as a distinct shape.
 * May drift via an optional scripted `motion`.
 */
export interface Hazard {
  c: Vec2;
  radius: number;
  motion?: Motion;
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
  /** Mid-course nudges granted this level (spec §4). Default/omitted = 0 (disabled). */
  nudges?: number;
}

/** Outcome of a single-position collision test. Time-based fails (off-screen grace,
 *  max flight time) are layered on top of this by the game loop. */
export type Outcome = 'flying' | 'crash' | 'win' | 'offscreen';
