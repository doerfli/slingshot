import { describe, it, expect } from 'vitest';
import { launch, nudge } from '../src/sim/probe';
import { vec } from '../src/sim/vec';

// The optional mid-course nudge (spec §4): a single small impulse aimed from the probe
// toward a tapped point. Pure and deterministic given the same (position, target, dv).

describe('probe.nudge — mid-course impulse toward a point', () => {
  it('adds a fixed-magnitude impulse in the direction of the tapped point', () => {
    const probe = launch(vec(0, 0), vec(10, 0)); // moving +x
    nudge(probe, vec(0, 100), 30); // tap straight "up" (+y)
    expect(probe.v.x).toBe(10); // x velocity untouched
    expect(probe.v.y).toBeCloseTo(30, 9); // +30 toward the tap
  });

  it('uses the direction from the probe, not the absolute tap position', () => {
    const probe = launch(vec(50, 50), vec(0, 0)); // sitting at (50,50)
    nudge(probe, vec(50, 100), 20); // tap directly above → pure +y
    expect(probe.v.x).toBeCloseTo(0, 9);
    expect(probe.v.y).toBeCloseTo(20, 9);
  });

  it('is a no-op when the tap is exactly on the probe (zero direction)', () => {
    const probe = launch(vec(5, 5), vec(3, -4));
    nudge(probe, vec(5, 5), 25);
    expect(probe.v).toEqual(vec(3, -4));
  });
});
