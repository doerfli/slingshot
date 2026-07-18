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
};

/** Reactive store the Svelte HUD subscribes to. */
export const hud = writable<HudState>({ ...initialHud });
