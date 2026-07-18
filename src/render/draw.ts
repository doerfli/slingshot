// Immediate-mode Canvas 2D rendering of the whole world, redrawn every frame.
// The visual language (spec §12): solid discs with clear "gravity presence", a
// bright dotted probe trail, a dotted partial-preview arc, and a target whose SHAPE
// (a ringed marker) — not just its color — distinguishes it from hazards (spec §13).

import type { Vec2 } from '../sim/vec';
import type { Level } from '../sim/types';
import type { ProbeState } from '../sim/probe';
import { fitToField, worldToScreen, worldLenToScreen, type Camera } from './camera';

const COLORS = {
  bg: '#0b1026',
  body: '#5b6b9e',
  bodyRim: '#93a3dc',
  gravity: 'rgba(130,150,230,0.24)',
  target: '#37d6a6',
  pad: '#c7d0ff',
  probe: '#6ad2ff',
  trail: 'rgba(106,210,255,0.55)',
  preview: 'rgba(150,220,255,0.85)',
  aim: '#ffd166',
};

export interface RenderState {
  level: Level;
  /** Live probe (during and after flight, to keep the final trail on screen). */
  probe: ProbeState | null;
  /** Predicted world-space points, already trimmed to the level's preview length. */
  preview: Vec2[];
  /** Would-be launch velocity while aiming, for the heading arrow (null otherwise). */
  aimVelocity: Vec2 | null;
  reducedMotion?: boolean;
}

/** Clear to the background color. cssW/cssH are in CSS pixels (context is dpr-scaled). */
export function clear(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, cssW, cssH);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  rs: RenderState,
): Camera {
  const cam = fitToField(rs.level.bounds, cssW, cssH);

  drawBodies(ctx, cam, rs.level);
  drawTarget(ctx, cam, rs.level);
  drawPad(ctx, cam, rs.level.pad);

  if (rs.probe) {
    // A shot is (or was) in flight: show its trail + the probe.
    drawTrail(ctx, cam, rs.probe.trail);
    const speed = Math.hypot(rs.probe.v.x, rs.probe.v.y);
    drawProbe(ctx, cam, rs.probe.p, rs.probe.v, speed);
  } else {
    // Idle / aiming: preview + heading arrow + the ship sitting on the pad, so it's
    // obvious *this* is the thing you launch.
    if (rs.preview.length > 1) drawPreview(ctx, cam, rs.preview);
    if (rs.aimVelocity) drawAimArrow(ctx, cam, rs.level.pad, rs.aimVelocity);
    drawIdleProbe(ctx, cam, rs.level.pad, rs.aimVelocity);
  }

  return cam;
}

function drawBodies(ctx: CanvasRenderingContext2D, cam: Camera, level: Level): void {
  for (const b of level.bodies) {
    if (b.isTarget) continue; // a target body is drawn as the target, not a hazard
    const s = worldToScreen(cam, b.c);
    const r = worldLenToScreen(cam, b.radius);

    // Gravity field-of-influence halo. Its size scales with the body's actual pull
    // strength (stronger body → wider reach), so the glow genuinely reads as "how far
    // this planet grabs you," not just decoration. Clamped so it never swallows the field.
    const influenceWorld = Math.min(
      420,
      Math.max(b.radius * 2, Math.sqrt(b.strength / 40)),
    );
    const influence = worldLenToScreen(cam, influenceWorld);
    const halo = ctx.createRadialGradient(s.x, s.y, r, s.x, s.y, influence);
    halo.addColorStop(0, COLORS.gravity);
    halo.addColorStop(0.55, 'rgba(120,140,220,0.07)');
    halo.addColorStop(1, 'rgba(120,140,220,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(s.x, s.y, influence, 0, Math.PI * 2);
    ctx.fill();

    // Solid disc + rim.
    ctx.fillStyle = COLORS.body;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.strokeStyle = COLORS.bodyRim;
    ctx.stroke();
  }
}

function drawTarget(ctx: CanvasRenderingContext2D, cam: Camera, level: Level): void {
  const s = worldToScreen(cam, level.target.c);
  const r = worldLenToScreen(cam, level.target.radius);

  // Distinct SHAPE: a thin double ring + small center dot (reads even if color is
  // lost). Kept fine-lined so it looks like a target zone, not a solid body.
  ctx.strokeStyle = COLORS.target;
  ctx.lineWidth = Math.max(1.25, r * 0.05);
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s.x, s.y, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.target;
  ctx.beginPath();
  ctx.arc(s.x, s.y, Math.max(1.5, r * 0.1), 0, Math.PI * 2);
  ctx.fill();
}

function drawPad(ctx: CanvasRenderingContext2D, cam: Camera, pad: Vec2): void {
  const s = worldToScreen(cam, pad);
  // A launch ring the ship sits in — signals "start here".
  ctx.strokeStyle = 'rgba(199,208,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * The ship, sitting on the pad while idle/aiming. Drawn large and bright with a
 * glow so it's unmistakably the object you launch, and pointed along the current aim
 * (or upward at rest).
 */
function drawIdleProbe(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  pad: Vec2,
  aimVelocity: Vec2 | null,
): void {
  const s = worldToScreen(cam, pad);
  const angle =
    aimVelocity && (aimVelocity.x !== 0 || aimVelocity.y !== 0)
      ? Math.atan2(aimVelocity.y, aimVelocity.x)
      : -Math.PI / 2; // point "up" at rest

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);

  // A crisp triangular ship (points toward +x before rotation).
  ctx.fillStyle = COLORS.probe;
  ctx.strokeStyle = '#eaf7ff';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = COLORS.probe;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-7, 7);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-7, -7);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

function drawPreview(ctx: CanvasRenderingContext2D, cam: Camera, pts: Vec2[]): void {
  ctx.save();
  ctx.setLineDash([2, 7]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.preview;
  ctx.beginPath();
  const first = worldToScreen(cam, pts[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = worldToScreen(cam, pts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawAimArrow(ctx: CanvasRenderingContext2D, cam: Camera, pad: Vec2, vel: Vec2): void {
  const from = worldToScreen(cam, pad);
  const speed = Math.hypot(vel.x, vel.y);
  if (speed === 0) return;
  // Fixed on-screen arrow length so it reads as "heading", independent of world scale.
  const L = 46;
  const dir = { x: vel.x / speed, y: vel.y / speed };
  const tip = { x: from.x + dir.x * L, y: from.y + dir.y * L };

  ctx.save();
  ctx.strokeStyle = COLORS.aim;
  ctx.fillStyle = COLORS.aim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  // Arrowhead.
  const a = Math.atan2(dir.y, dir.x);
  const h = 9;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - h * Math.cos(a - 0.4), tip.y - h * Math.sin(a - 0.4));
  ctx.lineTo(tip.x - h * Math.cos(a + 0.4), tip.y - h * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, cam: Camera, trail: Vec2[]): void {
  if (trail.length < 2) return;
  ctx.save();
  ctx.setLineDash([2, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.trail;
  ctx.beginPath();
  const first = worldToScreen(cam, trail[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < trail.length; i++) {
    const p = worldToScreen(cam, trail[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawProbe(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  p: Vec2,
  v: Vec2,
  speed: number,
): void {
  const s = worldToScreen(cam, p);

  // Speed feedback: the faster the probe (e.g. whipping past a planet), the longer its
  // motion streak and the brighter its glow — so you can SEE it accelerate, not just bend.
  const t = Math.max(0, Math.min(1, (speed - 150) / 550)); // 0 at ~150 u/s → 1 at ~700
  const glow = 14 + t * 24;
  const streakLen = (14 + t * 46) * (v.x || v.y ? 1 : 0);
  const speedMag = Math.hypot(v.x, v.y) || 1;

  // Streak trailing behind the direction of travel.
  const tailX = s.x - (v.x / speedMag) * streakLen;
  const tailY = s.y - (v.y / speedMag) * streakLen;
  const streak = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
  streak.addColorStop(0, COLORS.probe);
  streak.addColorStop(1, 'rgba(106,210,255,0)');
  ctx.strokeStyle = streak;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(tailX, tailY);
  ctx.stroke();

  // Bright glowing comet head.
  ctx.fillStyle = '#eaf7ff';
  ctx.shadowColor = COLORS.probe;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.probe;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
  ctx.stroke();
}
