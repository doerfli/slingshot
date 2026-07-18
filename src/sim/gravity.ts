// Multi-body inverse-square gravity.
//
//   a = Σ_i  strength_i · (c_i − p) / (|c_i − p|² + softening²)^(3/2)
//
// The (…)^(3/2) form is the inverse-square law written for a vector: unit direction
// (c−p)/|c−p| times inverse-square magnitude strength/|c−p|². The softening term
// avoids the singularity at a body's center.
//
// DETERMINISM: bodies are summed in array order, every run. Floating-point addition
// is not associative, so a reordered sum is a different number and a divergent path.
// Never sort or reorder `bodies` between the real sim and the predictor.

import type { Vec2 } from './vec';
import type { Body } from './types';
import { GRAVITY_SOFTENING } from './constants';

export function accel(p: Vec2, bodies: Body[]): Vec2 {
  let ax = 0;
  let ay = 0;
  const soft2 = GRAVITY_SOFTENING * GRAVITY_SOFTENING;

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const dx = b.c.x - p.x;
    const dy = b.c.y - p.y;
    const r2 = dx * dx + dy * dy + soft2;
    // r2^(3/2) = r2 * sqrt(r2)
    const invR3 = b.strength / (r2 * Math.sqrt(r2));
    ax += dx * invR3;
    ay += dy * invR3;
  }

  return { x: ax, y: ay };
}
