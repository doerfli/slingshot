# Slingshot — Implementation Plan

## Context

We are building **Slingshot**, a mobile-first web game where you flick a probe through
inverse-square gravity fields to reach a target (`docs/slingshot-spec.md`). The stack is
prescribed in `docs/slingshot-stack.md`: it deliberately reuses the architecture of the
sibling project [hohmann-hero](https://github.com/doerfli/hohmann-hero) — a small,
deterministic, top-down 2D gravity game — with three deliberate deviations (no symplectic
mandate, no time-warp, and first-class multi-body/moving bodies + drag-to-aim input).

The repo is currently greenfield: only `docs/`, a devcontainer, and `mise.toml` (bun 1.3,
node 24). This plan turns the two specs into an executable, phased build. It follows the
spec's own phasing so we prove the core feel ("does curving a shot around a body feel
good?") before adding breadth.

**Confirmed decisions:**
- **UI/HUD framework:** Svelte (world is always Canvas 2D).
- **Aim gesture:** slingshot *pull-back-to-fire-forward*.
- **Integrator:** velocity Verlet on a fixed `DT` (recommended default; not load-bearing).

**Fixed constraints (from stack doc §14 — do not substitute):** Canvas 2D for the world;
hand-written fixed-timestep integrator with **determinism** as the guaranteed property; no
physics engine; **one physics step function shared by the real sim and the preview
predictor**.

---

## Status & Progress

> **Update this section as work lands.** Legend: `[ ]` not started · `[~]` in progress · `[x]` done.
> Current overall status: **Phase 3 code complete** — all automated gates green (typecheck 0
> errors, 50 tests, production build, `docker build`). Remaining: human visual/gesture/audio
> playtest on a phone, and running the built container (deferred to the user — a devcontainer
> can't reach the served image).

**Last updated:** 2026-07-19

### Phase 1 — MVP
- [x] Scaffold (Vite + Svelte-TS + Vitest; `dev`/`test`/`build` green; portrait `index.html`)
- [x] `sim/vec` + `sim/gravity` (multi-body sum, fixed order) + `sim/integrator.step` (TDD)
- [x] `sim/probe.launch`/`advance` + `sim/collision`
- [x] `test/determinism.test.ts` passing (bit-for-bit identical paths)
- [x] `render/camera` (fit-to-field, dpr, letterbox) + `render/draw` (body, target, pad, probe, trail, preview, aim arrow)
- [x] `game/loop` (fixed-timestep accumulator) + `game/state` store + `game/rules` (closest-approach)
- [x] `input/aim` + `sim/input-map` (pull-back drag → launch; heading arrow)
- [x] `sim/predict` + partial preview arc + `test/preview-matches-reality.test.ts`
- [x] Levels 1–3 (straight shot → the bend → around the world) + win/lose/off-screen feedback + retry
- [x] Real Svelte HUD (`App.svelte` + `ui/Hud.svelte`) wired via `game/state`
- [x] Bonus: `test/solvable.test.ts` — proves each authored level has a winning launch
- [ ] **Milestone (needs human):** confirm curving around the body *feels* good on a phone viewport

### Phase 2 — Breadth, HUD, scoring
- [x] Multi-body levels (Corridor L4, Slingshot L5) + hazard mechanic: distinct inert
      `Hazard` type (`sim/types`), `collision` hazard test (TDD), asteroid shape in `draw`.
      (Hazard-*using* levels land in Phase 3 per the asteroid-field ordering; the mechanic is ready.)
- [x] Svelte HUD shell via `game/state.ts` (attempts/par, preview-mode toggle, reset,
      new `ui/EndOfLevel.svelte` with stars)
- [x] Target-vs-hazard by shape (rings vs jagged asteroid polygon) — colorblind-safe
- [x] Scoring + par + 1–3 stars + `localStorage` (`slingshot:v1`) persistence + sequential unlock
      (`persist/store.ts`, `starsFor` wired in `game/loop`)
- [x] Flight-trail feedback + near-miss/closest-approach readout (HUD text + on-canvas marker)
- [x] **Milestone (human-confirmed):** phone-viewport playtest of L4/L5 feel, hazard-shape
      legibility (grayscale), stars, and reload-persistence — confirmed good 2026-07-19

### Phase 3 — Moving elements, polish, accessibility
- [x] Moving bodies + moving targets (`sim/bodies.ts`, `Motion` on `sim/types`) threaded through
      `collision.check(…, t)`, `predict(…, launchT)`, and a shared `simT` world clock in `game/loop`
      (one `step()`, positioned bodies per tick — preview still matches reality). `test/assist.ts`
      (moving ⇒ speed gain, fixed ⇒ bend only) + moving-body determinism + moving preview tests.
- [x] Optional mid-course nudge — `probe.nudge` (impulse toward tap point), per-level `nudges`
      opt-in (L8), HUD counter, `test/nudge.ts`. Ignored by the predictor by design.
- [x] Full level set — L6 Moving Target, L7 True Assist, L8 Asteroid Field; `solvable.test` now
      sweeps `launchT` for moving levels (all 8 winnable). Style/proximity scoring: `rules.surfaceGap`
      + closest-graze tracked over a winning flight → "Clean flyby" badge + persisted best graze.
- [x] Audio (`audio/sfx.ts`) — Web Audio synth (launch/whoosh/win/crash/nudge), unlocked on first
      gesture, mute toggle persisted. No-ops without an AudioContext (tests/SSR).
- [x] Accessibility — reduced-motion toggle (OS default via `matchMedia`) drops probe glow/streak;
      full-preview toggle persisted; safe-area insets on HUD/selector; target(ring)/body(disc)/
      hazard(jagged) stay shape-distinct for moving entities (colorblind-safe).
- [x] Deployment — multi-stage `Dockerfile` (Bun build → nginx) + `docker/nginx.conf` (hashed assets
      immutable, `index.html` no-cache, SPA fallback) + `.dockerignore`. `docker build` verified.
- [ ] **Milestone (needs human):** phone-viewport playtest of L6–L8 (timing a moving target, a real
      assist, the asteroid-field nudge), audio, reduced-motion, star/graze persistence; and run the
      built container (`docker run -p 8080:80 slingshot:phase3`) to confirm nginx serving + SPA fallback.

### Change log
- 2026-07-18 — Plan authored; toolchain (bun 1.3.14 + node 24 via mise) confirmed working.
- 2026-07-18 — Phase 1 implemented end-to-end: scaffold, pure `sim/` core, `render/`, `game/`
  loop+state+levels, `input/` drag-to-aim, `sim/predict` + partial preview, Svelte HUD.
  Gates green: `bun run build`, `svelte-check` (0 errors), 18 Vitest tests (determinism,
  collision, preview-matches-reality, level solvability). Pending: human phone playtest.
- 2026-07-18 — Playtest tuning pass #1 (feedback: no visible deflection, tiny probe, thick
  target rings). Root cause of "no bend": launch speed too high vs gravity — probe blew past
  bodies. Fix: `MAX_SPEED` 420→210, `POWER_SCALE` 2.4→1.6, body strengths ~9× (L2 1.3M,
  L3 1.8M). Verified with `scratch/analyze.ts`: at full-power ~206 u/s, L2 bends 34° / L3 37°,
  sharper as power eases off. Visuals: bigger glowing probe + triangular idle ship on a launch
  ring, thinner target rings, larger strength-scaled gravity influence halo.
- 2026-07-18 — Tuning pass #2 (feedback: still too little bend). Stronger gravity: L2 1.3M→3.0M,
  L3 1.8M→3.8M, L1→480k; `MAX_SPEED` 210→190, `POWER_SCALE` 1.6→1.5. Halo enlarged (cap
  260→360). Verified: full-power turn L2 59° / L3 71°, up to ~200° at lower power; all solvable.
- 2026-07-18 — Tuning pass #3 (feedback: only slightly bends on a mid-distance pass). Gravity
  ~2× again: L2 3.0M→6.5M, L3 3.8M→8.0M, L1→800k; `MAX_SPEED` 190→170, `POWER_SCALE` 1.5→1.4;
  halo cap 360→420. Verified: full-power turn L2 106° / L3 117°, ~200° at lower power; solvable.
- 2026-07-18 — Tuning pass #4 (feedback: doesn't wrap when flying NEAR the planet; also too slow
  at max). Real root cause: lethal radius too big — the fierce-gravity band was inside the crash
  zone, so close passes crashed instead of wrapping. Shrank cores (L2 50→26, L3 66→34, L1→22),
  same strengths; raised speed `MAX_SPEED` 170→260, `POWER_SCALE` 1.4→1.9. Verified: full-power
  close-pass wrap L2 112° / L3 117°, snappy 257 u/s shots, all solvable.
- 2026-07-18 — Portrait + selector pass. (a) Redesigned all 3 levels for a tall PORTRAIT field
  (±300 × ±560), pad at bottom firing UP toward a top target — mobile-first. (b) Higher-speed
  deflection: strengths L2 8M / L3 9.5M, `MAX_SPEED` 230, `POWER_SCALE` 1.7; bigger field ⇒ more
  transit time ⇒ more bend. (c) Confirmed the probe *accelerates* near a body (×3.3 speed gain on
  a close pass) — added a speed-scaled glow + motion streak so it's visible. (d) Added a top
  `ui/LevelSelect.svelte` (numbered pills + level name) and a DEV toggle (also `?dev`) that
  unlocks all levels; real sequential unlock-on-win otherwise. Gates green (0 errors, 18 tests).
- 2026-07-18 — Balance pass (feedback: L1 too weak up close, L2/L3 too strong). Compressed the
  strength spread: L1 900k→1.4M (straight-shot win still ~11°, but a close graze now bends 58°),
  L2 8M→4.5M, L3 9.5M→5.5M (winning-shot bend 53°/61°, close wrap 102°/107° — loosened from
  123–130°). All solvable (158/135/127 wins); 18 tests green.
- 2026-07-19 — Phase 2 implemented end-to-end. (A) Hazard mechanic: distinct inert `Hazard`
  type (no gravity, so determinism/gravity-sum untouched), fixed-order hazard test in
  `sim/collision` (TDD, 3 new tests), jagged asteroid polygon in `render/draw` (shape-distinct
  from smooth bodies + ringed target → colorblind-safe). (B) Levels 4 "The Corridor" (two wells,
  thread the gap) + 5 "Slingshot Around" (tight flyby to off-angle target); `solvable.test` now
  green for all 5. (C) Scoring + persistence: new `persist/store.ts` (`slingshot:v1`, defensive
  load/save), `starsFor` wired in `game/loop.finish`, best stars/attempts + unlock persisted and
  restored on load; `HudState` gains `stars`/`bestStars`/`bestAttempts`/`levelStars`. (D) HUD:
  new `ui/EndOfLevel.svelte` (stars as filled/outline shapes, best line, retry/next — moved out
  of `Hud`), preview-mode toggle in `Hud`, earned-stars under `LevelSelect` pills, on-canvas
  near-miss marker. Gates green: 23 Vitest tests, `svelte-check` 0/0, `bun run build`, dev-server
  smoke test. Pending: human phone playtest. Hazard-*using* levels deferred to Phase 3.
- 2026-07-19 — Deflection tuning: reduced every gravity-body `strength` by 20% (L1 1.4M→1.12M,
  L2 4.5M→3.6M, L3 5.5M→4.4M, L4 5.0M→4.0M ×2, L5 6.0M→4.8M) for a gentler bend. All 5 levels
  still solvable; 23 tests green.
- 2026-07-19 — Raised `MAX_SPEED` 230→306 (+33%) for snappier launches. All 5 levels still
  solvable; 23 tests green.
- 2026-07-19 — Raised `MAX_SPEED` again 306→407 (+33%) for even snappier shots. All 5 levels
  still solvable; 23 tests green.
- 2026-07-19 — Phase 2 signed off: human playtest confirmed the tuned feel, hazard-shape
  legibility, stars, and reload-persistence all read well. Phase 2 complete; Phase 3 next.
- 2026-07-19 — Phase 3 implemented end-to-end (all six workstreams). (1) **Moving elements**:
  new `sim/bodies.ts` (`positionAt`/`bodiesAt`/`targetAt`/`hazardsAt`) — motion is a pure
  function of sim time; `Motion` (`linear`|`orbit`) added to `sim/types`. Threaded a single
  world clock `simT` through `game/loop` (advances every tick while aiming+flying, frozen on
  result, reset on retry), `collision.check(p, level, t)`, and `predict(…, launchT)` using ONE
  `step()` with bodies positioned per tick — preview still matches reality bit-for-bit. Render
  now draws a positioned snapshot. Tests: `assist` (moving ⇒ +17.9 speed vs fixed, fixed ⇒ bend
  only), moving-body determinism, moving preview-matches-reality, time-aware collision. (2)
  **Nudge**: `probe.nudge` (impulse toward tap, `NUDGE_DV`), per-level `nudges` opt-in, routed
  from `beginAim` while flying, HUD counter, `test/nudge`. (3) **Levels 6–8** (Moving Target,
  True Assist, Asteroid Field w/ 1 nudge); `solvable.test` sweeps `launchT` for moving levels —
  all 8 winnable. **Style scoring**: `rules.surfaceGap` + closest-graze over a winning flight →
  "Clean flyby" badge (`GRAZE_THRESHOLD`) + persisted `bestGap`. (4) **Audio** `audio/sfx.ts`
  (Web Audio synth, gesture-unlocked, mute persisted, no-ops without AudioContext). (5)
  **Accessibility**: reduced-motion toggle (OS default via `matchMedia`) strips probe glow/streak;
  preview-mode persisted; safe-area insets confirmed; shapes stay colorblind-safe for moving
  entities. Settings persisted via new `SaveData.settings`. (6) **Deployment**: multi-stage
  `Dockerfile` (Bun→nginx) + `docker/nginx.conf` + `.dockerignore`; `docker build` verified
  (container run left to the user — devcontainer can't reach it). Gates: `svelte-check` 0/0,
  50 Vitest tests, `bun run build`, `docker build`. Pending: human phone playtest.
- 2026-07-19 — Audio polish: made the in-flight synthwave loop **excitement-dynamic**. New
  `sfx.flightUpdate(proximity)` (called each frame by `game/loop.render` during flight) drives
  one eased param in the scheduler: **excitement** rises as the probe nears the target —
  lifting the music submix, opening the bass filter, snapping the hats, and fading in a doubled
  octave arp for a build toward the goal. Loop records `launchDist` (pad→target at launch) as
  the proximity reference. Tempo stays fixed at ~122 BPM (a speed-scaling experiment was tried
  and reverted as too frantic). Presentation only (reads sim, never writes). Gates:
  `svelte-check` 0/0, 50 tests still green.

---

## Toolchain note

Bun/Node are installed **via mise**, not on the bare `PATH`. Run all commands through mise:

```
mise exec -- bun install
mise exec -- bun run dev      # Vite dev server
mise exec -- bun run test     # Vitest
mise exec -- bun run build    # static bundle -> dist/
```

(Or `eval "$(mise activate bash)"` once per shell to get `bun`/`node` directly.)

---

## Target module layout (mirrors hohmann-hero)

```
slingshot/
  index.html                 # viewport-fit=cover, #app root + <canvas>
  mise.toml                  # exists (bun 1.3, node 24)
  package.json               # scripts: dev / build / preview / test
  bun.lock                   # commit; --frozen-lockfile in CI/Docker
  tsconfig.json
  vite.config.ts
  svelte.config.js
  Dockerfile                 # multi-stage: bun build -> nginx serve
  docker/nginx.conf          # hashed /assets cached hard; index.html no-cache; SPA fallback
  src/
    main.ts                  # bootstraps Svelte App + starts the game loop
    App.svelte               # top-level chrome; mounts <canvas> + HUD
    app.css
    sim/                     # PURE, no DOM, unit-tested
      vec.ts                 # 2D vector math (add, scale, sub, len, len2, ...)
      gravity.ts             # a = Σ strength_i · (c_i − p) / |c_i − p|³  (fixed iteration order)
      bodies.ts              # scripted deterministic motion: bodyAt(body, t)
      integrator.ts          # velocity-Verlet step(state, DT)  <-- THE shared step fn
      probe.ts               # probe state type; launch()
      collision.ts           # surface / hazard / target / off-screen / max-time tests
      predict.ts             # forward predictor: reuses integrator.step() exactly
      input-map.ts           # pure drag-vector -> launch velocity (quantized, deterministic)
    render/
      camera.ts              # fit-to-field world->screen transform, dpr scaling, letterbox
      draw.ts                # bodies, target, hazards, probe, trail, dotted preview arc
    input/
      aim.ts                 # Pointer Events: pointerdown/move/up -> drag vector -> launch
    game/
      loop.ts                # rAF + fixed-timestep accumulator (no warp)
      levels.ts              # Level type + level data (bodies, target, hazards, preview len, par)
      rules.ts               # win/lose detection, attempt counting, scoring/stars
      state.ts               # thin shared store (UI <-> world) — plain object/Svelte store
    ui/                      # Svelte HUD — updates a few times/sec, NEVER per-frame
      Hud.svelte             # attempt/nudge counters, reset, preview-mode indicator
      LevelSelect.svelte
      EndOfLevel.svelte      # stars, attempts, style bonus, retry/next
      icons/                 # inline SVG shapes (target vs hazard by shape, not color)
    audio/
      sfx.ts                 # Web Audio: launch twang, whoosh, success chime, crash thud
    persist/
      store.ts               # localStorage, namespaced+versioned key "slingshot:v1"
  test/
    determinism.test.ts
    preview-matches-reality.test.ts
    collision.test.ts
    assist.test.ts
```

---

## The load-bearing seam (get this right first)

`sim/integrator.ts` exports **one** `step(state, dt)` function. Both callers use it verbatim:

1. **Real sim** — `game/loop.ts` steps it inside the accumulator.
2. **Preview** — `sim/predict.ts` forks the would-be launch state and steps it forward with
   the *same* function, same `DT`, same multi-body gravity, advancing scripted bodies along
   the same scratch timeline, stopping the drawn arc at the first collision.

If these ever diverge, the preview lies. They must never be two implementations.

**Determinism discipline (stack doc §3.3):** fixed `DT`, integer step count; stable body
iteration order in the gravity sum (float addition isn't associative); scripted motion is a
pure function of sim time/step index (never `Date.now()`); no `Math.random()` in `sim/`
(seed a PRNG per level if debris needs jitter); drag→launch mapping is a pure function
feeding both preview and launch.

Fixed-timestep loop (stack doc §6):
```
const DT = 1/120
accumulator += realElapsed
while (accumulator >= DT && steps < MAX_STEPS_PER_FRAME) { stepPhysics(DT); accumulator -= DT; steps++ }
updateHudState(); render()
```

---

## Phase 1 — MVP (prove the feel)

Goal: one fixed gravity body, drag-to-aim launch, deterministic ballistic flight,
crash / off-screen / win detection, partial trajectory preview, **Levels 1–3**. A minimal
on-canvas HUD is acceptable here; the Svelte shell can be a thin wrapper.

Build order:
1. **Scaffold** — `mise exec -- bun create vite` (svelte-ts) or hand-write configs to match
   the layout above; add Vitest; get `dev`/`test`/`build` scripts green with an empty canvas.
   Set up `index.html` with `viewport-fit=cover` and portrait-first layout from day one.
2. **`sim/` core (TDD)** — `vec` → `gravity` (single body first) → `integrator.step` →
   `probe.launch` → `collision`. Write `test/determinism.test.ts` alongside.
3. **`render/camera` + `render/draw`** — fit-to-field transform, dpr scaling, letterbox;
   draw the body, launch pad, probe, and trail.
4. **`game/loop`** — accumulator loop stepping the sim and rendering.
5. **`input/aim` + `sim/input-map`** — Pointer Events pull-back drag → launch velocity;
   live launch-heading arrow.
6. **`sim/predict` + partial preview arc** — dotted, first-arc-only, faded; stop at first
   collision. Add `test/preview-matches-reality.test.ts`.
7. **Levels 1–3** in `game/levels.ts` (straight shot → the bend → around the world),
   win/lose feedback, instant retry.

**Phase 1 done when:** curving a shot around the single body feels good, a solved shot
replays identically, and the preview matches reality bit-for-bit in tests.

## Phase 2 — Breadth, HUD, scoring

- **Multi-body gravity** (`gravity.ts` already sums; add the corridor + slingshot levels).
- **Hazards** (`collision.ts` hazard test) — asteroid-field geometry.
- **Svelte HUD shell** (`ui/`) wired through `game/state.ts`: attempt/nudge counters,
  preview-mode indicator, reset, `EndOfLevel` star/style summary. Keep it off the per-frame
  path. Target-vs-hazard distinguished by **shape/icon**, not color (colorblind-safe).
- **Scoring + stars + persistence** (`game/rules.ts`, `persist/store.ts`): attempts, par,
  1–3 stars, best result per level in `localStorage`; levels unlock in sequence.
- **Flight-trail feedback** and near-miss/closest-approach readout (derived from the same
  forward-simulated points).

## Phase 3 — Moving elements, polish, accessibility

- **Moving bodies + moving targets** (`bodies.ts` scripted paths) → the **true gravity
  assist** level; `test/assist.test.ts` (moving body → speed gain; fixed body → bend only).
- **Optional mid-course nudge** — single impulse, per-level opt-in, off by default.
- **Full level set** (spec §9 order: moving target, true assist, asteroid field) and
  **style/proximity scoring**.
- **Audio** (`audio/sfx.ts`) gated behind first user gesture; resume AudioContext on first tap.
- **Accessibility**: full-preview mode toggle, reduced-motion option, safe-area insets
  (`env(safe-area-inset-*)`), colorblind-safe palette confirmed.
- **Deployment**: multi-stage `Dockerfile` (bun build → nginx) + `docker/nginx.conf`
  (transfer from reference); `dist/` also drops on any static host.

---

## Verification

- **Automated (`mise exec -- bun run test`)** — the payoff of a pure `sim/`:
  - *Determinism:* same launch run twice (and after interleaving unrelated work) → identical
    trajectories. This is the direct "a solved shot stays solved" check.
  - *Preview matches reality:* predictor and live sim, same inputs, no nudge → same points.
  - *Collision correctness:* shot into a body's surface crashes; into target zone wins; off
    the field fails after grace; the **target body does not crash** the probe.
  - *Assist sanity:* past a moving body → speed gain; past a fixed body → speed returns to
    launch speed at equal radius (bend only).
- **Manual end-to-end** — `mise exec -- bun run dev`, open on a phone-sized viewport
  (portrait, DevTools device mode): confirm the whole level is visible before launch, the
  drag gesture is thumb-reachable, the preview reads as "plan-able but not trivial," and
  crash/off-screen/win feedback is clear. Do this per level as it lands.
- **Build** — `mise exec -- bun run build` produces a static `dist/`; `preview` serves it.

---

## Open items to decide during build (sensible defaults, tune in playtest)

- Tunable constants (launch-speed cap, per-level `strength_i`, target-zone sizes, preview
  arc length, off-screen timeout) — keep them all in one easy-to-tweak place per level.
- Exact slingshot power curve (drag length → speed) — pick a feel, keep it a pure function.
- Whether Phase 1 ships a real Svelte HUD or a minimal on-canvas one (either is fine; the
  seam via `game/state.ts` stays the same).
