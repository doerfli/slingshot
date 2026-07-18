// Global tunable constants. Per-level values (body strength, target radius,
// preview length, bounds) live in the Level data instead. Everything here is
// meant to be tweaked freely during playtesting.

/** Fixed physics timestep, in seconds. Constant forever — determinism depends on it. */
export const DT = 1 / 120;

/** Cap steps per frame so a backgrounded tab can't freeze the loop catching up. */
export const MAX_STEPS_PER_FRAME = 8;

/**
 * Drag length (world units) → launch speed multiplier, and the speed cap. These are
 * deliberately tuned LOW relative to gravity: at high launch speed the probe blows
 * past a body before gravity can bend it (a straight line, no feel). Keeping the max
 * shot around ~210 u/s puts a lively drag squarely in the range where the path
 * visibly curves around the strong bodies below.
 */
export const POWER_SCALE = 1.7;

/** Launch speed cap (world units/sec). */
export const MAX_SPEED = 230;

/**
 * Gravity softening (world units). Added in quadrature to the distance so the
 * inverse-square pull stays finite near a body's center — prevents a numerical
 * singularity and keeps near-surface acceleration readable.
 */
export const GRAVITY_SOFTENING = 8;

/** Seconds the probe may spend outside the play bounds before the shot fails. */
export const OFFSCREEN_GRACE = 0.4;

/** Hard cap on a single flight's duration (seconds) — fail if exceeded. */
export const MAX_FLIGHT_TIME = 20;
