// Forward trajectory predictor for the aim preview. It steps the SAME integrator,
// the SAME DT, and the SAME multi-body gravity as the real sim (sim/integrator.step)
// — there is no parallel "approximate" predictor — so the drawn preview can never
// disagree with the path the probe will actually fly (spec §7, stack §7).
//
// The mid-course nudge (Phase 3) is intentionally ignored here.

import type { Vec2 } from './vec';
import type { Level } from './types';
import { step, type Kinematic } from './integrator';
import { check } from './collision';
import { DT } from './constants';

/**
 * Predict up to `maxSteps` fixed steps from a would-be launch. Records one point per
 * step and STOPS at the first collision (surface / target / out-of-bounds) so the
 * dotted line never passes through a planet.
 *
 * @param pad launch position.
 * @param v0 launch velocity (from sim/input-map.dragToLaunchVelocity — the same value
 *           fed to the real launch).
 * @param maxSteps preview length in steps (partial = level.previewLength; full = a
 *           large cap; none = 0).
 */
export function predict(pad: Vec2, v0: Vec2, level: Level, maxSteps: number): Vec2[] {
  let s: Kinematic = { p: { ...pad }, v: { ...v0 } };
  const pts: Vec2[] = [{ ...s.p }];

  for (let i = 0; i < maxSteps; i++) {
    s = step(s, level.bodies, DT);
    pts.push({ ...s.p });
    if (check(s.p, level) !== 'flying') break;
  }

  return pts;
}
