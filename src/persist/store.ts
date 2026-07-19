// Local save game: level unlock progress and per-level best result. A few KB of JSON
// in localStorage (spec §10, stack §8). The key is namespaced + versioned so a future
// save-format change can migrate cleanly. Kept dependency-free and defensive: any
// missing/corrupt/unavailable storage falls back to a fresh save rather than throwing.

const KEY = 'slingshot:v1';
const VERSION = 1 as const;

/** Best result recorded for a single level. */
export interface LevelRecord {
  /** Best (highest) star rating earned, 1–3. */
  stars: number;
  /** Fewest attempts taken on a winning run. */
  bestAttempts: number;
  /** Tightest body-surface graze on a winning run (world units) — the style best.
   *  Optional so saves from before style scoring load cleanly. */
  bestGap?: number;
}

/** Player-level preferences (persisted across sessions). All optional so older saves
 *  and partial data load cleanly. */
export interface Settings {
  muted?: boolean;
  reducedMotion?: boolean;
  previewMode?: 'partial' | 'full' | 'none';
}

export interface SaveData {
  version: typeof VERSION;
  /** How many levels are unlocked (1-based count); levels beyond this are locked. */
  unlockedCount: number;
  /** Keyed by level id. */
  levels: Record<number, LevelRecord>;
  /** Player preferences (audio, accessibility). */
  settings: Settings;
}

function fresh(): SaveData {
  return { version: VERSION, unlockedCount: 1, levels: {}, settings: {} };
}

/** localStorage may be absent (tests/SSR) or blocked (private mode). Never throw. */
function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Load the save, returning a fresh one when nothing valid is stored. */
export function load(): SaveData {
  const s = storage();
  if (!s) return fresh();
  try {
    const raw = s.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== VERSION) return fresh(); // future: migrate here
    return {
      version: VERSION,
      unlockedCount: typeof data.unlockedCount === 'number' ? data.unlockedCount : 1,
      levels: data.levels && typeof data.levels === 'object' ? data.levels : {},
      settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
    };
  } catch {
    return fresh();
  }
}

/** Persist the save. Silently no-ops if storage is unavailable. */
export function save(data: SaveData): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode — progress just won't persist this session */
  }
}
