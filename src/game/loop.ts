// The Game controller: owns the world (level, probe, aim), runs the fixed-timestep
// loop, renders every frame, and pushes a few HUD values to the shared store. The UI
// calls its intent methods (beginAim/updateAim/endAim/reset/goToLevel); it never
// imports Svelte, and per-frame rendering never routes through Svelte reactivity.

import type { Vec2 } from '../sim/vec';
import { launch, advance, nudge, type ProbeState } from '../sim/probe';
import { check } from '../sim/collision';
import { predict } from '../sim/predict';
import { bodiesAt, targetAt, hazardsAt } from '../sim/bodies';
import { dragToLaunchVelocity } from '../sim/input-map';
import { DT, MAX_STEPS_PER_FRAME, OFFSCREEN_GRACE, MAX_FLIGHT_TIME, NUDGE_DV } from '../sim/constants';
import type { Level } from '../sim/types';
import { clear, drawScene, type RenderState } from '../render/draw';
import { fitToField, screenToWorld, type Camera } from '../render/camera';
import { LEVELS, levelAt } from './levels';
import { closestApproach, closestApproachPoint, starsFor, surfaceGap, GRAZE_THRESHOLD } from './rules';
import { load, save, type SaveData } from '../persist/store';
import * as sfx from '../audio/sfx';
import { hud, type Status, type LostReason, type PreviewMode } from './state';

/** The OS "reduce motion" accessibility preference (spec §13), used as the default when
 *  the player hasn't set their own. Defensive for non-browser (test) environments. */
function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

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
  private muted = false;
  private reducedMotion = false;
  /** Persisted unlock progress + per-level best result. */
  private save: SaveData;
  /** Stars earned on the shot that just won (0 until a win this visit). */
  private stars = 0;

  private probe: ProbeState | null = null;
  private offscreenTime = 0;
  /** Mid-course nudges left on the live shot (starts at level.nudges each launch). */
  private nudgesRemaining = 0;
  /** Closest the live shot has come to any body surface (world units) — the style score
   *  (spec §10). Starts at +Infinity and shrinks as the probe grazes; captured on a win. */
  private minGap = Infinity;
  /** The winning shot's closest pass (null until a win this visit). */
  private styleGap: number | null = null;

  /** The world clock (seconds). Advances every physics tick while aiming AND flying, so
   *  moving bodies/targets drift on screen and you can *time* a shot. The flight simply
   *  continues advancing it from the instant of launch (the preview predicts from that
   *  same instant, so they agree). Frozen once a shot resolves (win/lose) and reset to 0
   *  on retry, so every attempt replays the same moving world (fair, reproducible). */
  private simT = 0;

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
    // Restore unlock progress + best scores from the last visit.
    this.save = load();
    this.unlockedCount = Math.max(1, Math.min(this.save.unlockedCount, LEVELS.length));
    // Restore player preferences (audio + accessibility). Reduced-motion defaults to the
    // OS setting when the player hasn't chosen explicitly.
    const st = this.save.settings ?? {};
    this.muted = st.muted ?? false;
    sfx.setMuted(this.muted);
    this.previewMode = st.previewMode ?? 'partial';
    this.reducedMotion = st.reducedMotion ?? prefersReducedMotion();
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
    // Freeze the whole world once a shot resolves, so the result screen stays coherent
    // with the final trail (no bodies drifting away from where the shot ended).
    if (this.status === 'won' || this.status === 'lost') return;

    // Bodies are positioned at the step's START time; collision is tested at its END
    // time — the exact protocol sim/predict follows, so the preview matches reality.
    const t0 = this.simT;
    const stepFlight = this.status === 'flying' && this.probe;

    if (stepFlight) {
      advance(this.probe!, bodiesAt(this.level.bodies, t0), DT);
    }
    this.simT += DT;
    if (!stepFlight) return; // aiming: just advance the world clock (moving elements drift)

    // Track the closest pass to any body surface (positioned at the probe's new time)
    // for style scoring.
    const gap = surfaceGap(this.probe!.p, bodiesAt(this.level.bodies, this.simT));
    if (gap < this.minGap) this.minGap = gap;

    const outcome = check(this.probe!.p, this.level, this.simT);

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

    if (this.probe!.t >= MAX_FLIGHT_TIME) this.finish('lost', 'offscreen');
  }

  private finish(status: 'won' | 'lost', reason: LostReason): void {
    this.status = status;
    this.lostReason = reason;
    sfx.flightStop();
    if (status === 'won') sfx.win();
    else sfx.crash();
    if (status === 'won') {
      this.stars = starsFor(this.attempts, this.level.par);
      // Style score: how close this winning line grazed a body surface (spec §10).
      this.styleGap = Number.isFinite(this.minGap) ? this.minGap : null;
      // Winning unlocks the next level in sequence...
      this.unlockedCount = Math.max(this.unlockedCount, Math.min(this.levelIndex + 2, LEVELS.length));
      // ...and records the best result for this level (most stars / fewest attempts /
      // tightest graze).
      const prev = this.save.levels[this.level.id];
      const prevGap = prev?.bestGap;
      this.save.levels[this.level.id] = {
        stars: Math.max(prev?.stars ?? 0, this.stars),
        bestAttempts: Math.min(prev?.bestAttempts ?? Infinity, this.attempts),
        bestGap:
          this.styleGap == null
            ? prevGap
            : prevGap == null
              ? this.styleGap
              : Math.min(prevGap, this.styleGap),
      };
      this.save.unlockedCount = this.unlockedCount;
      save(this.save);
    }
    this.pushHud();
  }

  // ---- intent (called by input / HUD) -------------------------------------

  beginAim(screen: Vec2): void {
    // While a shot is in flight a tap is a mid-course nudge (only where the level grants
    // them), never the start of a new aim.
    if (this.status === 'flying') {
      this.tryNudge(screen);
      return;
    }
    // Re-aiming after a result silently resets the shot first.
    if (this.status !== 'aiming') this.resetShot();
    this.aiming = true;
    this.updateAim(screen);
  }

  /** Spend one nudge (if any remain) as an impulse toward the tapped world point. */
  private tryNudge(screen: Vec2): void {
    if (this.nudgesRemaining <= 0 || !this.probe) return;
    const world = screenToWorld(this.camera(), screen);
    nudge(this.probe, world, NUDGE_DV);
    this.nudgesRemaining -= 1;
    sfx.nudge();
    this.pushHud();
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
    // The world clock keeps flowing from exactly where aiming left it — no discontinuity,
    // so the shot flies the path the live preview was drawing.
    this.offscreenTime = 0;
    this.nudgesRemaining = this.level.nudges ?? 0;
    this.minGap = Infinity;
    this.styleGap = null;
    this.attempts += 1;
    this.status = 'flying';
    this.lostReason = null;
    this.stars = 0;
    sfx.launch();
    sfx.flightStart();
    this.pushHud();
  }

  cancelAim(): void {
    this.aiming = false;
    this.dragWorld = null;
  }

  /** Reset the current shot (keep attempt count) for an instant retry. Rewinds the world
   *  clock so moving elements replay from the same start — timing stays reproducible. */
  resetShot(): void {
    sfx.flightStop();
    this.probe = null;
    this.offscreenTime = 0;
    this.aiming = false;
    this.dragWorld = null;
    this.status = 'aiming';
    this.lostReason = null;
    this.stars = 0;
    this.styleGap = null;
    this.minGap = Infinity;
    this.simT = 0;
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
    this.persistSettings();
    this.pushHud();
  }

  /** Mute/unmute all audio (persisted). */
  toggleMute(): void {
    this.muted = !this.muted;
    sfx.setMuted(this.muted);
    this.persistSettings();
    this.pushHud();
  }

  /** Toggle reduced-motion: drops the probe's animated glow/streak flourishes (spec §13).
   *  Persisted, overriding the OS default once the player chooses. */
  toggleReducedMotion(): void {
    this.reducedMotion = !this.reducedMotion;
    this.persistSettings();
    this.pushHud();
  }

  private persistSettings(): void {
    this.save.settings = {
      muted: this.muted,
      reducedMotion: this.reducedMotion,
      previewMode: this.previewMode,
    };
    save(this.save);
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

    // Position every moving element at the current world time, once, for this frame.
    const bodies = bodiesAt(this.level.bodies, this.simT);
    const target = targetAt(this.level.target, this.simT);
    const hazards = hazardsAt(this.level.hazards, this.simT);

    let preview: Vec2[] = [];
    let aimVelocity: Vec2 | null = null;
    if (this.aiming && this.dragWorld) {
      const v0 = dragToLaunchVelocity(this.dragWorld);
      if (v0.x !== 0 || v0.y !== 0) {
        aimVelocity = v0;
        // Preview a launch at *this* instant — moving elements are shown where they'll
        // actually be, and it matches the flight the probe would fly if released now.
        preview = predict(this.level.pad, v0, this.level, this.previewSteps(), this.simT);
      }
    }

    const closestPoint =
      this.status === 'lost' && this.probe
        ? closestApproachPoint(this.probe.trail, target)
        : null;

    const rs: RenderState = {
      level: this.level,
      bodies,
      target,
      hazards,
      probe: this.probe,
      preview,
      aimVelocity,
      closestPoint,
      reducedMotion: this.reducedMotion,
    };
    drawScene(this.ctx, this.cssW, this.cssH, rs);
  }

  // ---- HUD sync -----------------------------------------------------------

  private pushHud(): void {
    const approach =
      this.status === 'lost' && this.probe
        ? closestApproach(this.probe.trail, targetAt(this.level.target, this.simT))
        : null;

    const record = this.save.levels[this.level.id];
    const levelStars: Record<number, number> = {};
    for (const id in this.save.levels) levelStars[id] = this.save.levels[id].stars;

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
      stars: this.stars,
      bestStars: record?.stars ?? 0,
      bestAttempts: record?.bestAttempts ?? null,
      levelStars,
      maxNudges: this.level.nudges ?? 0,
      nudgesRemaining: this.nudgesRemaining,
      styleGap: this.styleGap,
      bestGap: record?.bestGap ?? null,
      graze: this.styleGap != null && this.styleGap <= GRAZE_THRESHOLD,
      muted: this.muted,
      reducedMotion: this.reducedMotion,
    });
  }
}
