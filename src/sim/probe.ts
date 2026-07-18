// The probe: a point mass launched once, coasting under gravity. It carries a
// visible trail (spec §6). The trail is presentation state layered on top of the
// pure Kinematic the integrator advances.

import type { Vec2 } from './vec';
import type { Body, Outcome } from './types';
import type { Kinematic } from './integrator';
import { step } from './integrator';

export interface ProbeState {
  p: Vec2;
  v: Vec2;
  /** Breadcrumb positions for the flight trail, oldest first. */
  trail: Vec2[];
  outcome: Outcome;
  /** Sim-time elapsed since launch, in seconds. */
  t: number;
}

/** Create a probe at the pad with an initial launch velocity. */
export function launch(pad: Vec2, v0: Vec2): ProbeState {
  return {
    p: { ...pad },
    v: { ...v0 },
    trail: [{ ...pad }],
    outcome: 'flying',
    t: 0,
  };
}

/**
 * Advance the probe one fixed step under gravity, appending to the trail.
 * Mutates and returns the probe (the loop owns a single live probe). Collision
 * detection is the caller's job — this only moves the point mass.
 */
export function advance(probe: ProbeState, bodies: Body[], dt: number): ProbeState {
  const next: Kinematic = step({ p: probe.p, v: probe.v }, bodies, dt);
  probe.p = next.p;
  probe.v = next.v;
  probe.t += dt;
  probe.trail.push({ ...next.p });
  return probe;
}
