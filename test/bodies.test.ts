import { describe, it, expect } from 'vitest';
import { vec } from '../src/sim/vec';
import type { Body, Target } from '../src/sim/types';
import { positionAt, bodiesAt, targetAt } from '../src/sim/bodies';

describe('bodies.positionAt — scripted motion is a pure function of sim time', () => {
  it('returns the base position (a copy) when there is no motion', () => {
    const base = vec(10, -20);
    const p = positionAt(base, undefined, 3.7);
    expect(p).toEqual(base);
    expect(p).not.toBe(base); // a fresh object — never aliases the input
  });

  it('never mutates the base position', () => {
    const base = vec(5, 5);
    positionAt(base, { kind: 'linear', vel: vec(3, -4) }, 2);
    expect(base).toEqual(vec(5, 5));
  });

  it('drifts linearly: base + vel*t', () => {
    const p = positionAt(vec(0, 0), { kind: 'linear', vel: vec(3, -4) }, 2);
    expect(p).toEqual(vec(6, -8));
  });

  it('places an orbit at center + radius·(cos, sin) of (omega·t + phase)', () => {
    // phase 0, t 0 → angle 0 → +x edge of the orbit.
    const p = positionAt(vec(0, 0), { kind: 'orbit', center: vec(100, 0), radius: 40, omega: 1 }, 0);
    expect(p.x).toBeCloseTo(140, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('an orbit returns to its start after one period (2π/omega)', () => {
    const m = { kind: 'orbit' as const, center: vec(0, 0), radius: 50, omega: 0.8, phase: 0.3 };
    const t = 4.2;
    const a = positionAt(vec(0, 0), m, t);
    const b = positionAt(vec(0, 0), m, t + (2 * Math.PI) / 0.8);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
  });

  it('is deterministic: same t yields bit-for-bit identical coordinates', () => {
    const m = { kind: 'orbit' as const, center: vec(3, 7), radius: 22, omega: 1.3 };
    const a = positionAt(vec(0, 0), m, 9.13);
    const b = positionAt(vec(0, 0), m, 9.13);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });
});

describe('bodies.bodiesAt / targetAt — positioned snapshots preserve order', () => {
  it('returns a same-length, same-order array with each body positioned at t', () => {
    const bodies: Body[] = [
      { c: vec(0, 0), strength: 1000, radius: 10 }, // static
      { c: vec(0, 0), strength: 2000, radius: 12, motion: { kind: 'linear', vel: vec(1, 0) } },
    ];
    const at = bodiesAt(bodies, 5);
    expect(at.length).toBe(2);
    expect(at[0].c).toEqual(vec(0, 0)); // static body unchanged
    expect(at[1].c).toEqual(vec(5, 0)); // moved 5 units in x
    // strength/radius carried through untouched (determinism of the gravity sum).
    expect(at[1].strength).toBe(2000);
    expect(at[0].strength).toBe(1000);
  });

  it('positions a moving target', () => {
    const target: Target = { c: vec(0, 0), radius: 30, motion: { kind: 'linear', vel: vec(0, 2) } };
    expect(targetAt(target, 3).c).toEqual(vec(0, 6));
  });
});
