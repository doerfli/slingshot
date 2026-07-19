// Scripted, deterministic motion for gravity bodies, targets, and hazards.
//
// DETERMINISM (spec §3.3, §5): a body's position is a PURE function of sim time `t` —
// never `Date.now()` or frame timing. Both the real sim (game/loop) and the preview
// predictor (sim/predict) position the bodies with these same functions at the same
// `t`, so a moving-body shot previews exactly as it flies. The `bodies` array order is
// preserved by `bodiesAt` so the gravity sum stays bit-for-bit stable (float addition
// isn't associative — a reordered sum is a divergent path).

import type { Vec2 } from './vec';
import type { Body, Hazard, Motion, Target } from './types';

/** Position of an entity with base position `base` under `motion` at sim time `t`.
 *  Pure: returns a fresh Vec2, never mutates `base`. No motion → a copy of `base`. */
export function positionAt(base: Vec2, motion: Motion | undefined, t: number): Vec2 {
  if (!motion) return { x: base.x, y: base.y };
  if (motion.kind === 'linear') {
    return { x: base.x + motion.vel.x * t, y: base.y + motion.vel.y * t };
  }
  // orbit
  const a = motion.omega * t + (motion.phase ?? 0);
  return {
    x: motion.center.x + motion.radius * Math.cos(a),
    y: motion.center.y + motion.radius * Math.sin(a),
  };
}

/** The bodies positioned at sim time `t`, in the SAME order (determinism). Static
 *  bodies (no motion) are returned as fresh copies with their base `c`. */
export function bodiesAt(bodies: Body[], t: number): Body[] {
  const out: Body[] = new Array(bodies.length);
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    out[i] = b.motion ? { ...b, c: positionAt(b.c, b.motion, t) } : b;
  }
  return out;
}

/** The target positioned at sim time `t`. */
export function targetAt(target: Target, t: number): Target {
  return target.motion ? { ...target, c: positionAt(target.c, target.motion, t) } : target;
}

/** The hazards positioned at sim time `t`, in the SAME order. */
export function hazardsAt(hazards: Hazard[] | undefined, t: number): Hazard[] | undefined {
  if (!hazards) return hazards;
  const out: Hazard[] = new Array(hazards.length);
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    out[i] = h.motion ? { ...h, c: positionAt(h.c, h.motion, t) } : h;
  }
  return out;
}
