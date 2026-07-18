import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/game/levels';
import { step, type Kinematic } from '../src/sim/integrator';
import { check } from '../src/sim/collision';
import { dragToLaunchVelocity } from '../src/sim/input-map';
import { DT, MAX_SPEED, POWER_SCALE, MAX_FLIGHT_TIME } from '../src/sim/constants';
import { vec } from '../src/sim/vec';
import type { Level } from '../src/sim/types';

const MAX_STEPS = Math.ceil(MAX_FLIGHT_TIME / DT);
const MAX_PULL = MAX_SPEED / POWER_SCALE; // drag length that reaches max speed

function simulate(level: Level, v0: { x: number; y: number }): string {
  let s: Kinematic = { p: { ...level.pad }, v: { ...v0 } };
  for (let i = 0; i < MAX_STEPS; i++) {
    s = step(s, level.bodies, DT);
    const out = check(s.p, level);
    if (out !== 'flying') return out;
  }
  return 'timeout';
}

/** Sweep drag directions × magnitudes; return true if any launch wins. */
function isSolvable(level: Level): boolean {
  for (let deg = 0; deg < 360; deg += 2) {
    const a = (deg * Math.PI) / 180;
    for (let pull = 20; pull <= MAX_PULL; pull += 8) {
      const drag = vec(Math.cos(a) * pull, Math.sin(a) * pull);
      if (simulate(level, dragToLaunchVelocity(drag)) === 'win') return true;
    }
  }
  return false;
}

describe('Phase 1 levels are winnable', () => {
  for (const level of LEVELS) {
    it(`Level ${level.id} — ${level.name} has at least one winning launch`, () => {
      expect(isSolvable(level)).toBe(true);
    });
  }
});
