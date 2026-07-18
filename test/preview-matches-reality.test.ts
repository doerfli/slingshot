import { describe, it, expect } from 'vitest';
import { predict } from '../src/sim/predict';
import { step, type Kinematic } from '../src/sim/integrator';
import { launch, advance } from '../src/sim/probe';
import { dragToLaunchVelocity } from '../src/sim/input-map';
import { check } from '../src/sim/collision';
import { DT } from '../src/sim/constants';
import { vec } from '../src/sim/vec';
import type { Level } from '../src/sim/types';

const level: Level = {
  id: 99,
  name: 'preview-fixture',
  pad: vec(-330, 200),
  bodies: [{ c: vec(-10, 40), strength: 140000, radius: 52 }],
  target: { c: vec(320, -160), radius: 32 },
  bounds: { minX: -400, minY: -400, maxX: 400, maxY: 400 },
  previewLength: 200,
  par: 3,
};

describe('preview matches reality', () => {
  const v0 = dragToLaunchVelocity(vec(-120, -60));

  it('predictor points equal the bare integrator, step for step', () => {
    const pts = predict(level.pad, v0, level, 200);

    let s: Kinematic = { p: { ...level.pad }, v: { ...v0 } };
    expect(pts[0]).toEqual(s.p);
    for (let i = 1; i < pts.length; i++) {
      s = step(s, level.bodies, DT);
      expect(pts[i].x).toBe(s.p.x);
      expect(pts[i].y).toBe(s.p.y);
    }
  });

  it('predictor points equal the real probe (probe.advance) path', () => {
    const pts = predict(level.pad, v0, level, 200);
    const probe = launch(level.pad, v0);
    for (let i = 1; i < pts.length; i++) {
      advance(probe, level.bodies, DT);
      expect(probe.p.x).toBe(pts[i].x);
      expect(probe.p.y).toBe(pts[i].y);
    }
  });

  it('stops the drawn curve at the first collision (never through a body)', () => {
    // Aim straight into the body: pull the launch toward it so it must hit.
    const toBody = dragToLaunchVelocity(vec(-200, 20)); // fire toward +x/-y-ish region
    const pts = predict(level.pad, toBody, level, 2000);
    // Every recorded point except possibly the last must be 'flying'.
    for (let i = 0; i < pts.length - 1; i++) {
      expect(check(pts[i], level)).toBe('flying');
    }
    // And the curve terminated before the cap (it hit something).
    expect(pts.length).toBeLessThan(2001);
  });
});
