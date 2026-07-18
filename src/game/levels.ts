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
      { c: vec(230, -150), strength: 1400000, radius: 22 },
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
      { c: vec(20, 30), strength: 4500000, radius: 26 },
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
      { c: vec(0, 40), strength: 5500000, radius: 34 },
    ],
    target: { c: vec(60, -440), radius: 38 },
    bounds: FIELD,
    previewLength: 170,
    par: 4,
  },
];

export function levelAt(index: number): Level {
  const i = Math.max(0, Math.min(index, LEVELS.length - 1));
  return LEVELS[i];
}
