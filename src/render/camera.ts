// Fit-to-field world→screen transform. The spec requires the WHOLE level to be
// visible before launch across phone aspect ratios (spec §13), so we compute a
// uniform scale that fits the level bounds inside the viewport and letterbox the
// remainder — never clip.
//
// Camera works in CSS pixels. The canvas context is pre-scaled by devicePixelRatio
// (in App.svelte / the loop), so drawing in CSS px stays crisp on high-density phones.
//
// World y is down (same as screen), so no axis flip — levels are authored y-down.

import type { Vec2 } from '../sim/vec';
import type { Bounds } from '../sim/types';

export interface Camera {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fraction of the viewport kept as a margin around the field. */
const MARGIN = 0.06;

export function fitToField(bounds: Bounds, cssW: number, cssH: number): Camera {
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;
  const usableW = cssW * (1 - 2 * MARGIN);
  const usableH = cssH * (1 - 2 * MARGIN);

  const scale = Math.min(usableW / worldW, usableH / worldH);

  // Center the scaled field in the viewport.
  const offsetX = (cssW - worldW * scale) / 2 - bounds.minX * scale;
  const offsetY = (cssH - worldH * scale) / 2 - bounds.minY * scale;

  return { scale, offsetX, offsetY };
}

export function worldToScreen(cam: Camera, p: Vec2): Vec2 {
  return { x: cam.offsetX + p.x * cam.scale, y: cam.offsetY + p.y * cam.scale };
}

export function screenToWorld(cam: Camera, s: Vec2): Vec2 {
  return { x: (s.x - cam.offsetX) / cam.scale, y: (s.y - cam.offsetY) / cam.scale };
}

/** Convert a world-space length (e.g. a body radius) to screen pixels. */
export function worldLenToScreen(cam: Camera, len: number): number {
  return len * cam.scale;
}
