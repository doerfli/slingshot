import { describe, it, expect } from 'vitest';
import { step, type Kinematic } from '../src/sim/integrator';
import { bodiesAt } from '../src/sim/bodies';
import type { Body, Motion } from '../src/sim/types';
import { DT } from '../src/sim/constants';
import { vec, type Vec2, dist } from '../src/sim/vec';

// One body, launched to fly past it. The same launch is run twice: once with the body
// FIXED (path only bends — energy conserved), once with the body MOVING (a *true*
// gravity assist — the probe leaves faster than it arrived). See spec §5.

const BODY_C = vec(0, 60);
const STRENGTH = 200000;
const RADIUS = 20;
const P0 = vec(-300, -70);
const V0 = vec(260, 0); // launch speed 260, heading +x, passing below the body
const LAUNCH_SPEED = 260;
const N = 300;

function speed(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/** Fly the fixed launch forward N steps past a single body positioned by `bodiesAt(t)`.
 *  Records the outbound speed at the moment the probe returns to its launch distance
 *  from the (fixed) body — for a static field this must equal the launch speed. */
function fly(motion: Motion | undefined) {
  const bodies: Body[] = [{ c: { ...BODY_C }, strength: STRENGTH, radius: RADIUS, motion }];
  let s: Kinematic = { p: { ...P0 }, v: { ...V0 } };

  const launchDist = dist(P0, BODY_C);
  let prevDist = launchDist;
  let passedPeriapsis = false;
  let equalRadiusOutSpeed: number | null = null;

  for (let i = 0; i < N; i++) {
    s = step(s, bodiesAt(bodies, i * DT), DT);
    const d = dist(s.p, BODY_C); // distance to the body's *fixed* center
    if (d < prevDist) passedPeriapsis = true;
    if (passedPeriapsis && d >= launchDist && equalRadiusOutSpeed === null) {
      equalRadiusOutSpeed = speed(s.v);
    }
    prevDist = d;
  }
  return { finalSpeed: speed(s.v), equalRadiusOutSpeed };
}

describe('gravity assist', () => {
  it('past a FIXED body: bend only — speed at equal radius returns to launch speed', () => {
    const { equalRadiusOutSpeed } = fly(undefined);
    expect(equalRadiusOutSpeed).not.toBeNull();
    // Energy is conserved in a static potential, so speed depends only on position:
    // back at the launch distance, speed is (numerically) the launch speed.
    expect(equalRadiusOutSpeed! / LAUNCH_SPEED).toBeCloseTo(1, 2);
  });

  it('past a MOVING body: a true assist — the probe leaves faster than it arrived', () => {
    const motion: Motion = { kind: 'linear', vel: vec(80, -120) };
    const moving = fly(motion);
    const fixed = fly(undefined);

    // The moving body does net work on the probe: it ends faster than it launched...
    expect(moving.finalSpeed).toBeGreaterThan(LAUNCH_SPEED + 10);
    // ...and faster than the identical fixed-body flyby, which gains nothing.
    expect(moving.finalSpeed).toBeGreaterThan(fixed.finalSpeed + 10);
  });
});
