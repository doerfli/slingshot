// The Game controller: owns the world (level, probe, aim), runs the fixed-timestep
// loop, renders every frame, and pushes a few HUD values to the shared store. The UI
// calls its intent methods (beginAim/updateAim/endAim/reset/goToLevel); it never
// imports Svelte, and per-frame rendering never routes through Svelte reactivity.

import type { Vec2 } from '../sim/vec';
import { launch, advance, type ProbeState } from '../sim/probe';
import { check } from '../sim/collision';
import { predict } from '../sim/predict';
import { dragToLaunchVelocity } from '../sim/input-map';
import { DT, MAX_STEPS_PER_FRAME, OFFSCREEN_GRACE, MAX_FLIGHT_TIME } from '../sim/constants';
import type { Level } from '../sim/types';
import { clear, drawScene, type RenderState } from '../render/draw';
import { fitToField, screenToWorld, type Camera } from '../render/camera';
import { LEVELS, levelAt } from './levels';
import { closestApproach } from './rules';
import { hud, type Status, type LostReason, type PreviewMode } from './state';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private levelIndex = 0;
  private level: Level;

  private status: Status = 'aiming';
  private lostReason: LostReason = null;
  private attempts = 0;
  private previewMode: PreviewMode = 'partial';
  private unlockedCount = 1;
  private devMode = false;

  private probe: ProbeState | null = null;
  private offscreenTime = 0;

  // Aim state, in world coordinates.
  private aiming = false;
  private dragWorld: Vec2 | null = null; // pad → pointer

  private accumulator = 0;
  private lastFrame = 0;
  private raf = 0;
  private cssW = 0;
  private cssH = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.level = levelAt(0);
    // Opt into dev mode via ?dev in the URL (unlocks everything from the start).
    if (typeof location !== 'undefined' && /(?:\?|&)dev\b/.test(location.search)) {
      this.devMode = true;
    }
    this.resize();
    this.pushHud();
  }

  // ---- lifecycle ----------------------------------------------------------

  start(): void {
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      const elapsed = Math.min(now - this.lastFrame, 250); // clamp huge gaps (tab switch)
      this.lastFrame = now;
      this.accumulator += elapsed / 1000;

      let steps = 0;
      while (this.accumulator >= DT && steps < MAX_STEPS_PER_FRAME) {
        this.stepPhysics();
        this.accumulator -= DT;
        steps++;
      }

      this.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- simulation ---------------------------------------------------------

  private stepPhysics(): void {
    if (this.status !== 'flying' || !this.probe) return;

    advance(this.probe, this.level.bodies, DT);
    const outcome = check(this.probe.p, this.level);

    if (outcome === 'win') {
      this.finish('won', null);
      return;
    }
    if (outcome === 'crash') {
      this.finish('lost', 'crash');
      return;
    }
    if (outcome === 'offscreen') {
      // Short grace before failing, so a body can pull the probe back onto the field.
      this.offscreenTime += DT;
      if (this.offscreenTime >= OFFSCREEN_GRACE) this.finish('lost', 'offscreen');
      return;
    }
    this.offscreenTime = 0;

    if (this.probe.t >= MAX_FLIGHT_TIME) this.finish('lost', 'offscreen');
  }

  private finish(status: 'won' | 'lost', reason: LostReason): void {
    this.status = status;
    this.lostReason = reason;
    // Winning unlocks the next level in sequence.
    if (status === 'won') {
      this.unlockedCount = Math.max(this.unlockedCount, Math.min(this.levelIndex + 2, LEVELS.length));
    }
    this.pushHud();
  }

  // ---- intent (called by input / HUD) -------------------------------------

  beginAim(screen: Vec2): void {
    if (this.status === 'flying') return;
    // Re-aiming after a result silently resets the shot first.
    if (this.status !== 'aiming') this.resetShot();
    this.aiming = true;
    this.updateAim(screen);
  }

  updateAim(screen: Vec2): void {
    if (!this.aiming) return;
    const world = screenToWorld(this.camera(), screen);
    this.dragWorld = { x: world.x - this.level.pad.x, y: world.y - this.level.pad.y };
  }

  endAim(): void {
    if (!this.aiming) return;
    this.aiming = false;
    const drag = this.dragWorld;
    this.dragWorld = null;
    if (!drag) return;

    const v0 = dragToLaunchVelocity(drag);
    if (v0.x === 0 && v0.y === 0) return; // a tap, not a drag — ignore

    this.probe = launch(this.level.pad, v0);
    this.offscreenTime = 0;
    this.attempts += 1;
    this.status = 'flying';
    this.lostReason = null;
    this.pushHud();
  }

  cancelAim(): void {
    this.aiming = false;
    this.dragWorld = null;
  }

  /** Reset the current shot (keep attempt count) for an instant retry. */
  resetShot(): void {
    this.probe = null;
    this.offscreenTime = 0;
    this.aiming = false;
    this.dragWorld = null;
    this.status = 'aiming';
    this.lostReason = null;
    this.pushHud();
  }

  /** Restart the whole level (attempts back to zero). */
  restartLevel(): void {
    this.attempts = 0;
    this.resetShot();
  }

  goToLevel(index: number): void {
    const clamped = Math.max(0, Math.min(index, LEVELS.length - 1));
    // Locked levels can't be selected unless dev mode is on.
    if (clamped >= this.unlockedCount && !this.devMode) return;
    this.levelIndex = clamped;
    this.level = levelAt(this.levelIndex);
    this.attempts = 0;
    this.resetShot();
  }

  nextLevel(): void {
    if (this.levelIndex < LEVELS.length - 1) this.goToLevel(this.levelIndex + 1);
  }

  /** Toggle dev mode: unlocks every level at once for testing. */
  toggleDevMode(): void {
    this.devMode = !this.devMode;
    this.pushHud();
  }

  setPreviewMode(mode: PreviewMode): void {
    this.previewMode = mode;
    this.pushHud();
  }

  // ---- rendering ----------------------------------------------------------

  private camera(): Camera {
    return fitToField(this.level.bounds, this.cssW, this.cssH);
  }

  private previewSteps(): number {
    if (this.previewMode === 'none') return 0;
    if (this.previewMode === 'full') return 4000;
    return this.level.previewLength;
  }

  private render(): void {
    clear(this.ctx, this.cssW, this.cssH);

    let preview: Vec2[] = [];
    let aimVelocity: Vec2 | null = null;
    if (this.aiming && this.dragWorld) {
      const v0 = dragToLaunchVelocity(this.dragWorld);
      if (v0.x !== 0 || v0.y !== 0) {
        aimVelocity = v0;
        preview = predict(this.level.pad, v0, this.level, this.previewSteps());
      }
    }

    const rs: RenderState = {
      level: this.level,
      probe: this.probe,
      preview,
      aimVelocity,
    };
    drawScene(this.ctx, this.cssW, this.cssH, rs);
  }

  // ---- HUD sync -----------------------------------------------------------

  private pushHud(): void {
    const approach =
      this.status === 'lost' && this.probe
        ? closestApproach(this.probe.trail, this.level.target)
        : null;

    hud.set({
      levelId: this.level.id,
      levelName: this.level.name,
      levelIndex: this.levelIndex,
      levelCount: LEVELS.length,
      attempts: this.attempts,
      par: this.level.par,
      status: this.status,
      lostReason: this.lostReason,
      closestApproach: approach,
      previewMode: this.previewMode,
      unlockedCount: this.unlockedCount,
      devMode: this.devMode,
    });
  }
}
