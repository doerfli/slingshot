// THE shared physics step. Both the real sim (game/loop) and the trajectory
// predictor (sim/predict) call this exact function — never a parallel "approximate"
// version — so the preview can never disagree with reality.
//
// Velocity Verlet. Bodies are passed in (fixed in Phase 1); keeping them as a
// parameter means Phase 3 moving bodies slot in by advancing the array between
// steps, without changing this function or its callers.

import type { Vec2 } from './vec';
import type { Body } from './types';
import { accel } from './gravity';

/** Position + velocity — the minimal state the integrator advances. */
export interface Kinematic {
  p: Vec2;
  v: Vec2;
}

/** Advance one fixed step. Pure: returns new state, does not mutate the input. */
export function step(s: Kinematic, bodies: Body[], dt: number): Kinematic {
  const a = accel(s.p, bodies);
  // p += v*dt + 0.5*a*dt²
  const p = {
    x: s.p.x + s.v.x * dt + 0.5 * a.x * dt * dt,
    y: s.p.y + s.v.y * dt + 0.5 * a.y * dt * dt,
  };
  const aNext = accel(p, bodies);
  // v += 0.5*(a + aNext)*dt
  const v = {
    x: s.v.x + 0.5 * (a.x + aNext.x) * dt,
    y: s.v.y + 0.5 * (a.y + aNext.y) * dt,
  };
  return { p, v };
}
