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
> Current overall status: **Pre-implementation** — plan approved, repo is greenfield (no `package.json` yet).

**Last updated:** 2026-07-18

### Phase 1 — MVP
- [ ] Scaffold (Vite + Svelte-TS + Vitest; `dev`/`test`/`build` green; empty canvas; portrait `index.html`)
- [ ] `sim/vec` + `sim/gravity` (single body) + `sim/integrator.step` (TDD)
- [ ] `sim/probe.launch` + `sim/collision`
- [ ] `test/determinism.test.ts` passing
- [ ] `render/camera` (fit-to-field, dpr, letterbox) + `render/draw` (body, pad, probe, trail)
- [ ] `game/loop` (fixed-timestep accumulator)
- [ ] `input/aim` + `sim/input-map` (pull-back drag → launch; heading arrow)
- [ ] `sim/predict` + partial preview arc + `test/preview-matches-reality.test.ts`
- [ ] Levels 1–3 (straight shot → the bend → around the world) + win/lose feedback + retry
- [ ] **Milestone:** curving around the single body feels good; solved shot replays identically

### Phase 2 — Breadth, HUD, scoring
- [ ] Multi-body levels (corridor, slingshot) + hazards (`collision` hazard test)
- [ ] Svelte HUD shell via `game/state.ts` (counters, preview indicator, reset, EndOfLevel)
- [ ] Target-vs-hazard by shape/icon (colorblind-safe)
- [ ] Scoring + par + 1–3 stars + `localStorage` persistence + sequential unlock
- [ ] Flight-trail feedback + near-miss/closest-approach readout

### Phase 3 — Moving elements, polish, accessibility
- [ ] Moving bodies + moving targets (`bodies.ts`) → true gravity-assist level + `test/assist.test.ts`
- [ ] Optional mid-course nudge (per-level opt-in, off by default)
- [ ] Full level set + style/proximity scoring
- [ ] Audio (`audio/sfx.ts`) gated behind first gesture
- [ ] Accessibility (full-preview toggle, reduced motion, safe-area insets, palette)
- [ ] Deployment (multi-stage Dockerfile + nginx.conf)

### Change log
- 2026-07-18 — Plan authored; toolchain (bun 1.3.14 + node 24 via mise) confirmed working.

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
