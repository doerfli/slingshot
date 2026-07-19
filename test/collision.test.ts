import { describe, it, expect } from 'vitest';
import { check } from '../src/sim/collision';
import type { Level } from '../src/sim/types';
import { vec } from '../src/sim/vec';

function makeLevel(over: Partial<Level> = {}): Level {
  return {
    id: 0,
    name: 'test',
    pad: vec(-300, 0),
    bodies: [{ c: vec(0, 0), strength: 90000, radius: 40 }],
    target: { c: vec(300, 0), radius: 25 },
    bounds: { minX: -400, minY: -300, maxX: 400, maxY: 300 },
    previewLength: 40,
    par: 2,
    ...over,
  };
}

describe('collision.check', () => {
  it('crashes on a body surface', () => {
    const level = makeLevel();
    expect(check(vec(0, 30), level)).toBe('crash'); // inside radius 40
    expect(check(vec(40, 0), level)).toBe('crash'); // exactly on surface
  });

  it('wins in the target zone', () => {
    const level = makeLevel();
    expect(check(vec(300, 0), level)).toBe('win');
    expect(check(vec(300, 24), level)).toBe('win'); // inside radius 25
  });

  it('reports off-screen outside the play bounds', () => {
    const level = makeLevel();
    expect(check(vec(-401, 0), level)).toBe('offscreen');
    expect(check(vec(0, 301), level)).toBe('offscreen');
  });

  it('keeps flying in open space', () => {
    const level = makeLevel();
    expect(check(vec(-150, 100), level)).toBe('flying');
  });

  it('does NOT crash on a body that is the target', () => {
    const level = makeLevel({
      bodies: [{ c: vec(0, 0), strength: 90000, radius: 40, isTarget: true }],
      // move the separate target zone away so only the body can be hit
      target: { c: vec(9999, 9999), radius: 5 },
    });
    expect(check(vec(0, 20), level)).toBe('win'); // on the target body → win, not crash
  });

  it('prefers a win when the target zone overlaps a body edge', () => {
    const level = makeLevel({
      target: { c: vec(40, 0), radius: 15 }, // overlaps the body surface at (40,0)
    });
    expect(check(vec(40, 0), level)).toBe('win');
  });

  it('crashes inside a hazard radius', () => {
    const level = makeLevel({ hazards: [{ c: vec(-100, 100), radius: 20 }] });
    expect(check(vec(-100, 100), level)).toBe('crash'); // dead center
    expect(check(vec(-100, 120), level)).toBe('crash'); // exactly on the edge
  });

  it('keeps flying just outside a hazard', () => {
    const level = makeLevel({ hazards: [{ c: vec(-100, 100), radius: 20 }] });
    expect(check(vec(-100, 121), level)).toBe('flying'); // just past the edge
  });

  it('a hazard off the flight path never triggers', () => {
    const level = makeLevel({ hazards: [{ c: vec(200, -200), radius: 20 }] });
    expect(check(vec(-150, 100), level)).toBe('flying');
  });

  it('wins against a MOVING target at its position at time t, not its base', () => {
    const level = makeLevel({
      bodies: [], // no gravity body in the way
      target: { c: vec(0, 0), radius: 25, motion: { kind: 'linear', vel: vec(100, 0) } },
    });
    // At t=1 the target has drifted to x=100. A probe sitting at (100,0)...
    expect(check(vec(100, 0), level, 1)).toBe('win'); // ...wins where the target now is
    expect(check(vec(100, 0), level, 0)).toBe('flying'); // ...but not at the start
    expect(check(vec(0, 0), level, 1)).toBe('flying'); // and the base spot is now empty
  });

  it('crashes on a MOVING body at its position at time t', () => {
    const level = makeLevel({
      bodies: [{ c: vec(0, 0), strength: 90000, radius: 40, motion: { kind: 'linear', vel: vec(50, 0) } }],
      target: { c: vec(9999, 9999), radius: 5 },
    });
    expect(check(vec(100, 0), level, 2)).toBe('crash'); // body drifted to x=100 by t=2
    expect(check(vec(100, 0), level, 0)).toBe('flying');
  });

  it('defaults t to 0 (static levels unaffected)', () => {
    const level = makeLevel();
    expect(check(vec(40, 0), level)).toBe('crash');
    expect(check(vec(40, 0), level, 0)).toBe('crash');
  });
});
