import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/game/levels';
import { step, type Kinematic } from '../src/sim/integrator';
import { check } from '../src/sim/collision';
import { bodiesAt } from '../src/sim/bodies';
import { dragToLaunchVelocity } from '../src/sim/input-map';
import { DT, MAX_SPEED, POWER_SCALE, MAX_FLIGHT_TIME } from '../src/sim/constants';
import { vec } from '../src/sim/vec';
import type { Level, Motion } from '../src/sim/types';

const MAX_STEPS = Math.ceil(MAX_FLIGHT_TIME / DT);
const MAX_PULL = MAX_SPEED / POWER_SCALE; // drag length that reaches max speed

/** Fly a launch from sim time `launchT`, positioning moving elements each step exactly
 *  as the game loop / predictor do. */
function simulate(level: Level, v0: { x: number; y: number }, launchT: number): string {
  let s: Kinematic = { p: { ...level.pad }, v: { ...v0 } };
  for (let i = 0; i < MAX_STEPS; i++) {
    s = step(s, bodiesAt(level.bodies, launchT + i * DT), DT);
    const out = check(s.p, level, launchT + (i + 1) * DT);
    if (out !== 'flying') return out;
  }
  return 'timeout';
}

/** All the omegas driving this level's motion (bodies + target + hazards). */
function omegas(level: Level): number[] {
  const ms: (Motion | undefined)[] = [
    ...level.bodies.map((b) => b.motion),
    level.target.motion,
    ...(level.hazards ?? []).map((h) => h.motion),
  ];
  return ms.filter((m): m is Extract<Motion, { kind: 'orbit' }> => m?.kind === 'orbit').map((m) => m.omega);
}

/** Launch times to try. Static levels only need t=0; a level with orbiting elements is
 *  swept across one full period of its slowest orbit, so "time the shot" levels get a
 *  fair chance to find their intercept window. */
function launchTimes(level: Level): number[] {
  const os = omegas(level);
  const hasLinear =
    level.bodies.some((b) => b.motion?.kind === 'linear') ||
    level.target.motion?.kind === 'linear' ||
    (level.hazards ?? []).some((h) => h.motion?.kind === 'linear');
  if (os.length === 0 && !hasLinear) return [0];
  const period = os.length ? (2 * Math.PI) / Math.min(...os) : 6; // seconds
  const N = 12;
  return Array.from({ length: N }, (_, k) => (k * period) / N);
}

/** Sweep launch time × drag direction × magnitude; true if any launch wins. */
function isSolvable(level: Level): boolean {
  for (const lt of launchTimes(level)) {
    for (let deg = 0; deg < 360; deg += 2) {
      const a = (deg * Math.PI) / 180;
      for (let pull = 20; pull <= MAX_PULL; pull += 8) {
        const drag = vec(Math.cos(a) * pull, Math.sin(a) * pull);
        if (simulate(level, dragToLaunchVelocity(drag), lt) === 'win') return true;
      }
    }
  }
  return false;
}

describe('every level is winnable', () => {
  for (const level of LEVELS) {
    it(`Level ${level.id} — ${level.name} has at least one winning launch`, () => {
      expect(isSolvable(level)).toBe(true);
    });
  }
});
