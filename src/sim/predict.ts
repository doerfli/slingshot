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
import { bodiesAt } from './bodies';
import { DT } from './constants';

/**
 * Predict up to `maxSteps` fixed steps from a would-be launch. Records one point per
 * step and STOPS at the first collision (surface / target / out-of-bounds) so the
 * dotted line never passes through a planet.
 *
 * MOVING BODIES (Phase 3): each step positions the bodies at the step's start time
 * `launchT + i*DT` — the SAME protocol game/loop follows (bodies@step-start feed the
 * one shared step(); collision checked at the step's end time). Because both callers
 * position with the same pure functions at the same times, the preview stays
 * bit-for-bit with the flown path.
 *
 * @param pad launch position.
 * @param v0 launch velocity (from sim/input-map.dragToLaunchVelocity — the same value
 *           fed to the real launch).
 * @param maxSteps preview length in steps (partial = level.previewLength; full = a
 *           large cap; none = 0).
 * @param launchT sim time at which the shot is (would be) launched. The live aim
 *           preview passes the loop's current sim time so moving elements are shown
 *           where they'll actually be. Defaults to 0 (static levels unchanged).
 */
export function predict(pad: Vec2, v0: Vec2, level: Level, maxSteps: number, launchT = 0): Vec2[] {
  let s: Kinematic = { p: { ...pad }, v: { ...v0 } };
  const pts: Vec2[] = [{ ...s.p }];

  for (let i = 0; i < maxSteps; i++) {
    s = step(s, bodiesAt(level.bodies, launchT + i * DT), DT);
    pts.push({ ...s.p });
    if (check(s.p, level, launchT + (i + 1) * DT) !== 'flying') break;
  }

  return pts;
}
