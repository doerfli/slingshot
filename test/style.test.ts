import { describe, it, expect } from 'vitest';
import { surfaceGap } from '../src/game/rules';
import type { Body } from '../src/sim/types';
import { vec } from '../src/sim/vec';

// Style/proximity scoring (spec §10): reward the tight elegant line. `surfaceGap` is the
// clearance from a point to the NEAREST gravity-body surface — the game loop tracks its
// minimum over a winning flight so a daring graze scores better than a wide, safe arc.

describe('rules.surfaceGap — clearance to the nearest body surface', () => {
  const bodies: Body[] = [
    { c: vec(0, 0), strength: 1000, radius: 20 },
    { c: vec(200, 0), strength: 1000, radius: 30 },
  ];

  it('returns distance-to-center minus radius for the nearest body', () => {
    expect(surfaceGap(vec(50, 0), bodies)).toBeCloseTo(30, 9); // 50 - radius 20
  });

  it('picks the nearest surface when several bodies are in range', () => {
    // Point at x=170: gap to body1 = 170-20 = 150; to body2 = 30-30 = 0. Nearest = 0.
    expect(surfaceGap(vec(170, 0), bodies)).toBeCloseTo(0, 9);
  });

  it('is negative inside a body (touching/penetrating the surface)', () => {
    expect(surfaceGap(vec(10, 0), bodies)).toBeCloseTo(-10, 9); // 10 - 20
  });

  it('is Infinity when there are no gravity bodies', () => {
    expect(surfaceGap(vec(0, 0), [])).toBe(Infinity);
  });
});
