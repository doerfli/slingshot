import { describe, it, expect } from 'vitest';
import { step, type Kinematic } from '../src/sim/integrator';
import { dragToLaunchVelocity } from '../src/sim/input-map';
import { launch, advance } from '../src/sim/probe';
import { bodiesAt } from '../src/sim/bodies';
import type { Body } from '../src/sim/types';
import { DT } from '../src/sim/constants';
import { vec, type Vec2 } from '../src/sim/vec';

// A representative multi-body field, in fixed order.
const BODIES: Body[] = [
  { c: vec(0, 0), strength: 90000, radius: 30 },
  { c: vec(260, 120), strength: 45000, radius: 20 },
];

/** Run a fixed launch forward N steps, returning every position. */
function simulate(steps: number): Vec2[] {
  const v0 = dragToLaunchVelocity(vec(-40, 90)); // some non-trivial drag
  let s: Kinematic = { p: vec(-200, -40), v: v0 };
  const path: Vec2[] = [s.p];
  for (let i = 0; i < steps; i++) {
    s = step(s, BODIES, DT);
    path.push(s.p);
  }
  return path;
}

describe('determinism — a solved shot stays solved', () => {
  it('produces a bit-for-bit identical path across repeated runs', () => {
    const a = simulate(600);
    const b = simulate(600);
    expect(b).toEqual(a);
  });

  it('is unaffected by interleaving unrelated floating-point work', () => {
    const a = simulate(600);

    // Do a pile of unrelated math (and a whole other sim) between runs.
    let noise = 0;
    for (let i = 0; i < 10000; i++) noise += Math.sin(i) * Math.random();
    simulate(137);
    expect(Number.isFinite(noise)).toBe(true);

    const b = simulate(600);
    expect(b).toEqual(a);
  });

  it('gives every path point exactly equal coordinates (===, not approx)', () => {
    const a = simulate(300);
    const b = simulate(300);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].y).toBe(b[i].y);
    }
  });
});

describe('determinism — moving bodies', () => {
  const MOVING: Body[] = [
    { c: vec(0, 0), strength: 90000, radius: 30, motion: { kind: 'orbit', center: vec(0, 0), radius: 80, omega: 1.1 } },
  ];
  const v0 = dragToLaunchVelocity(vec(-40, 90));

  function flyMoving(launchT: number, steps: number): Vec2[] {
    let s: Kinematic = { p: vec(-200, -40), v: v0 };
    const path: Vec2[] = [s.p];
    for (let i = 0; i < steps; i++) {
      s = step(s, bodiesAt(MOVING, launchT + i * DT), DT);
      path.push(s.p);
    }
    return path;
  }

  it('the same launch time yields a bit-for-bit identical path', () => {
    expect(flyMoving(5 * DT, 400)).toEqual(flyMoving(5 * DT, 400));
  });

  it('a different launch time yields a different path (timing matters)', () => {
    const a = flyMoving(0, 400);
    const b = flyMoving(30 * DT, 400);
    expect(b).not.toEqual(a);
  });
});

describe('determinism — input mapping is pure', () => {
  it('maps the same drag to the same launch velocity every time', () => {
    const drag = vec(33, -71);
    expect(dragToLaunchVelocity(drag)).toEqual(dragToLaunchVelocity(drag));
  });

  it('fires opposite the pull (slingshot convention)', () => {
    const v = dragToLaunchVelocity(vec(10, 0)); // pull right → fire left
    expect(v.x).toBeLessThan(0);
    expect(Math.abs(v.y)).toBe(0); // ±0 both fine — no vertical component
  });
});

describe('determinism — probe.advance matches integrator.step', () => {
  it('the trail follows the same path the bare integrator produces', () => {
    const v0 = dragToLaunchVelocity(vec(-40, 90));
    const probe = launch(vec(-200, -40), v0);
    let s: Kinematic = { p: vec(-200, -40), v: v0 };
    for (let i = 0; i < 200; i++) {
      advance(probe, BODIES, DT);
      s = step(s, BODIES, DT);
      expect(probe.p.x).toBe(s.p.x);
      expect(probe.p.y).toBe(s.p.y);
    }
    expect(probe.trail.length).toBe(201); // pad + 200 steps
  });
});
