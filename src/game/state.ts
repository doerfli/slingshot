// The thin shared state layer between the world (canvas/loop) and the chrome (Svelte).
// The UI READS these values to display the HUD and WRITES intent back through the
// Game controller (game/loop.ts). Per-frame world rendering never goes through here —
// only a few HUD values are pushed, a handful of times a second.

import { writable } from 'svelte/store';

export type Status = 'aiming' | 'flying' | 'won' | 'lost';
export type LostReason = 'crash' | 'offscreen' | null;
export type PreviewMode = 'partial' | 'full' | 'none';

export interface HudState {
  levelId: number;
  levelName: string;
  levelIndex: number; // 0-based position in the level list
  levelCount: number;
  attempts: number;
  par: number;
  status: Status;
  lostReason: LostReason;
  /** Closest the last shot came to the target (world units); shown on a near miss. */
  closestApproach: number | null;
  previewMode: PreviewMode;
  /** How many levels are unlocked (1-based count). Levels beyond this are locked. */
  unlockedCount: number;
  /** Dev mode: unlocks every level at once for testing. */
  devMode: boolean;
  /** Stars earned on the shot that just won (0 until a win this visit). */
  stars: number;
  /** Best star rating ever recorded for the current level (0 if never beaten). */
  bestStars: number;
  /** Fewest attempts on a past winning run of the current level (null if never). */
  bestAttempts: number | null;
  /** Best stars per level id, for the level-select display. */
  levelStars: Record<number, number>;
  /** Mid-course nudges this level grants (0 = the mechanic is off for this level). */
  maxNudges: number;
  /** Nudges left on the live shot (only meaningful while flying). */
  nudgesRemaining: number;
  /** Closest the winning shot grazed a body surface (world units); null if no win/no
   *  bodies. Smaller = a more daring line. */
  styleGap: number | null;
  /** Tightest graze ever recorded on this level (null if never / no bodies). */
  bestGap: number | null;
  /** Whether the winning shot earned the "Clean flyby" style badge (a tight graze). */
  graze: boolean;
  /** Audio muted. */
  muted: boolean;
  /** Reduced-motion accessibility option active. */
  reducedMotion: boolean;
}

export const initialHud: HudState = {
  levelId: 0,
  levelName: '',
  levelIndex: 0,
  levelCount: 0,
  attempts: 0,
  par: 0,
  status: 'aiming',
  lostReason: null,
  closestApproach: null,
  previewMode: 'partial',
  unlockedCount: 1,
  devMode: false,
  stars: 0,
  bestStars: 0,
  bestAttempts: null,
  levelStars: {},
  maxNudges: 0,
  nudgesRemaining: 0,
  styleGap: null,
  bestGap: null,
  graze: false,
  muted: false,
  reducedMotion: false,
};

/** Reactive store the Svelte HUD subscribes to. */
export const hud = writable<HudState>({ ...initialHud });
