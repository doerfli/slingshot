# CLAUDE.md

Guidance for working in this repository. Read `docs/slingshot-spec.md` (what the game is)
and `docs/slingshot-stack.md` (how to build it) for full detail; `docs/slingshot-plan.md`
is the phased build plan **and the live progress tracker** — keep its Status & Progress
section up to date as work lands.

## What this is

**Slingshot** — a mobile-first web game: flick a probe through inverse-square gravity
fields to reach a target. Top-down 2D, one-gesture play, hand-authored levels.

## Toolchain (important)

Bun and Node are installed **via mise**, not on the bare `PATH`. Always go through mise:

```
mise exec -- bun install
mise exec -- bun run dev      # Vite dev server
mise exec -- bun run test     # Vitest (the sim/ unit tests)
mise exec -- bun run build    # static bundle -> dist/
mise exec -- bun run preview  # serve the built bundle
```

Or `eval "$(mise activate bash)"` once per shell to get `bun`/`node` directly.
Versions are pinned in `mise.toml` (bun 1.3, node 24). Commit `bun.lock`; use
`bun install --frozen-lockfile` in CI/Docker.

## Non-negotiable constraints (from stack doc §14 — do not substitute)

1. **Canvas 2D** for the world. No SVG/WebGL for the per-frame scene (SVG is fine for static
   HUD icons).
2. **Hand-written fixed-timestep integrator. No physics engine** (not Matter.js/Planck/Box2D
   — they model rigid-body collision, not inverse-square gravity, and fight determinism).
3. **Determinism is the guaranteed property.** The same launch must always produce exactly
   the same path. This is satisfied by a fixed `DT`, not by any integrator's energy behavior.
4. **One physics step function, two callers.** `sim/integrator.step()` is used verbatim by
   both the real sim (`game/loop.ts`) and the preview predictor (`sim/predict.ts`). Never
   write a second "approximate" predictor — the preview must never disagree with reality.

## Determinism discipline (stack doc §3.3)

- Fixed `DT` (e.g. `1/120`), integer step count. Never scale `DT` or step by wall-clock delta.
- **Stable body iteration order** in the gravity sum — float addition isn't associative, so a
  reordered sum is a divergent path.
- Scripted body motion is a pure function of sim time / step index — never `Date.now()` or
  frame timing.
- **No `Math.random()` in `sim/`.** Seed a deterministic PRNG per level if jitter is needed.
- Drag → launch velocity is a pure, deterministic function feeding both preview and launch.

## Architecture seam

- **World** (`sim/`, `render/`, `input/`, `game/loop.ts`) owns physics + canvas, driven by a
  `requestAnimationFrame` + fixed-timestep accumulator. No time-warp.
- **Chrome** (`ui/` Svelte) owns menus/HUD, updated a few times a second.
- They talk only through a thin shared store (`game/state.ts`): UI reads state to display,
  writes intent (drag, launch, nudge, reset) back.
- **Never drive per-frame world rendering through Svelte reactivity** — that is the classic
  way to make a smooth game stutter.
- `sim/` is **pure (no DOM), unit-tested with Vitest.**

## Module layout

See `docs/slingshot-plan.md` for the full tree. Key folders: `sim/` (pure physics),
`render/` (canvas draw + camera), `input/` (Pointer Events aim), `game/` (loop, levels,
rules, state), `ui/` (Svelte HUD), `audio/`, `persist/` (localStorage `slingshot:v1`).

## Conventions

- **TypeScript throughout.** The vector/gravity math is where types pay off most.
- **TDD for `sim/`.** Physics correctness (determinism, preview-matches-reality, collisions,
  assist) is the one place worth automated tests — write them alongside the code.
- **Aim convention:** slingshot *pull-back-to-fire-forward*. Stay consistent.
- **Integrator:** velocity Verlet (semi-implicit Euler also acceptable — this is *not*
  load-bearing here; long-term orbital stability is an explicit non-goal).
- **Mobile-first:** portrait layout, `viewport-fit=cover` + safe-area insets, whole level
  visible before launch (fit-to-field transform, letterbox not clip), thumb-reachable
  controls. Plan this from the start — retrofitting layout is painful.
- **Accessibility:** never distinguish target from hazard by color alone (use shape/icon);
  offer full-preview mode and reduced-motion.

## Workflow expectations

- After completing a build step, tick it off in `docs/slingshot-plan.md` (Status & Progress)
  and add a dated change-log line.
- Run `mise exec -- bun run test` before claiming physics work is done; run
  `mise exec -- bun run dev` and check on a phone-sized viewport for anything visual.
- Commit or push only when asked.
