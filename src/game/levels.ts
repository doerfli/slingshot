// Phase 1 levels (spec §9, 1–3). Each introduces one new spatial idea.
//
// PORTRAIT layout for mobile: the field is tall (≈600×1120), y is down, and every
// level launches from a pad near the BOTTOM toward a target near the TOP. With the
// slingshot convention you pull DOWN below the pad and release to fire upward.
//
// Values are hand-tuned so the intended curve is achievable and readable — tweak freely.

import type { Level } from '../sim/types';
import { vec } from '../sim/vec';

// Portrait play area (~1 : 1.87, close to a phone). Camera letterboxes to fit.
const FIELD: Level['bounds'] = { minX: -300, minY: -560, maxX: 300, maxY: 560 };

export const LEVELS: Level[] = [
  // 1 — Straight shot: no meaningful gravity in the path. Learn aim-and-release.
  {
    id: 1,
    name: 'Straight Shot',
    pad: vec(-70, 470),
    bodies: [
      // Clear presence but set far off the pad→target line, so the direct shot up
      // barely bends. Teaches the gesture before gravity matters.
      { c: vec(230, -150), strength: 1120000, radius: 22 },
    ],
    target: { c: vec(70, -470), radius: 32 },
    bounds: FIELD,
    previewLength: 150,
    par: 2,
  },

  // 2 — The bend: one gravity well beside the flight path. Gravity curves the shot up
  // and across into an off-axis target.
  {
    id: 2,
    name: 'The Bend',
    pad: vec(-160, 460),
    bodies: [
      { c: vec(20, 30), strength: 3600000, radius: 26 },
    ],
    target: { c: vec(190, -430), radius: 40 },
    bounds: FIELD,
    previewLength: 160,
    par: 3,
  },

  // 3 — Around the world: target hidden almost directly above, behind a body. A straight
  // shot up hits the body — you must swing around it.
  {
    id: 3,
    name: 'Around the World',
    pad: vec(0, 465),
    bodies: [
      { c: vec(0, 40), strength: 4400000, radius: 34 },
    ],
    target: { c: vec(60, -440), radius: 38 },
    bounds: FIELD,
    previewLength: 170,
    par: 4,
  },

  // 4 — The corridor: two gravity wells flanking the path with a gap to thread. Fire up
  // the middle; drift too far either way and a well grabs you.
  {
    id: 4,
    name: 'The Corridor',
    pad: vec(0, 470),
    bodies: [
      { c: vec(-115, 0), strength: 4000000, radius: 30 },
      { c: vec(115, 0), strength: 4000000, radius: 30 },
    ],
    target: { c: vec(0, -460), radius: 36 },
    bounds: FIELD,
    previewLength: 150,
    par: 3,
  },

  // 5 — Slingshot around: launch from the side, swing tight past one well, and let the
  // flyby whip the probe across to an off-angle target it couldn't reach straight.
  {
    id: 5,
    name: 'Slingshot Around',
    pad: vec(-190, 470),
    bodies: [
      { c: vec(-10, -20), strength: 4800000, radius: 28 },
    ],
    target: { c: vec(220, -410), radius: 40 },
    bounds: FIELD,
    previewLength: 150,
    par: 4,
  },
];

export function levelAt(index: number): Level {
  const i = Math.max(0, Math.min(index, LEVELS.length - 1));
  return LEVELS[i];
}
