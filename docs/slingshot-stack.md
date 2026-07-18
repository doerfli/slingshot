# Slingshot — Technical Stack & Build Guidance

A companion to the Slingshot game & physics specification. The spec defines *what the game is*; this document defines *how to implement it* — the technology stack and the engineering decisions that matter.

This stack is deliberately reused from the sibling project **[hohmann-hero](https://github.com/doerfli/hohmann-hero)**, which solves the same class of problem: a small, deterministic, mobile-first, top-down 2D gravity game with a redraw-heavy trajectory preview and hand-authored levels. Almost everything transfers cleanly. Where Slingshot's requirements genuinely differ, this document says so explicitly rather than copying reasoning that doesn't apply.

> **Scope note:** This is a plain web build. A PWA layer (installability, offline service worker, wake lock) is out of scope for now and can be added later without disturbing anything below.

---

## 0. Does the Hohmann Hero stack actually fit? (verdict)

**Yes — reuse it, with three deliberate deviations.**

What transfers unchanged, because both games need the same thing:

- **Bun + TypeScript + Vite** toolchain, **Canvas 2D** rendering, **no physics engine**, **Svelte** HUD kept out of the sim, **localStorage** saves, **Web Audio**, **Docker/static** deploy, **Vitest** for the pure physics.
- The core architectural seam — a canvas/game loop owning the *world* and a component framework owning the *chrome*, communicating through a thin shared state layer.
- The trajectory-preview technique: one physics function, two callers (real sim + predictor), so the preview can never disagree with reality. This matters *even more* for Slingshot, where preview length is the single most important design lever.

The three deviations — each justified below:

1. **The integrator is no longer "must be symplectic."** Hohmann Hero forbids Euler/RK4 because it needs orbits to stay closed *indefinitely* under long time-warp. Slingshot's spec explicitly makes long-term stability a **non-goal** ("shots are short and authored"). Slingshot's real, hard requirement is **determinism on a fixed timestep**, not energy conservation. Velocity Verlet is still the recommended default (it's cheap and gives cleaner curves), but it is a sensible default here, not a load-bearing correctness constraint. See §3.
2. **No time-warp.** Slingshot is one flick and a short flight. The entire warp-as-sub-steps apparatus — the biggest source of subtle bugs in the reference — simply doesn't exist here. The game loop gets simpler. See §6.
3. **Multi-body gravity, moving bodies, and drag-to-aim input** are first-class in Slingshot and barely present in the reference. These need explicit handling for both correctness and determinism. See §3–§5.

A physics engine (Matter.js / Planck / Box2D) is the wrong tool for exactly the same reason as in the reference: they model rigid-body collision, not inverse-square gravitation, and they will fight determinism. That decision carries over at full strength.

---

## 1. Recommended stack at a glance

| Concern | Choice | Notes |
| --- | --- | --- |
| Runtime / package manager | **Bun** | Installs, scripts, dev/build runner. Node.js LTS (currently 24) only as a fallback where a tool needs it. |
| Language | **TypeScript** | Pays off most in the vector/gravity math. |
| World rendering | **Canvas 2D** (`<canvas>` 2D context) | Redraw-heavy preview + probe trail; clean schematic look. **Fixed.** |
| Physics | **Hand-written fixed-timestep integrator** | No physics engine. Determinism is the requirement. **Fixed.** |
| Integrator | **Velocity Verlet** (semi-implicit Euler also fine) | Recommended default, *not* non-negotiable — see §3. |
| UI / HUD shell | **Svelte** (React is a fine substitute) | Menus, HUD, level select, end-of-level summary — kept strictly out of the sim. |
| Build tooling | **Vite** | Fast dev server, static output, good mobile testing. |
| Persistence | **`localStorage`** | Level completion, stars, best scores; a few KB of JSON. |
| Audio | **Web Audio API** (or Howler.js wrapper) | Launch twang, flight whoosh, success chime, crash thud; gate behind first tap. |
| Testing | **Vitest** | Unit-test the pure `sim/` module; determinism is the key property. |
| Deployment | **Docker (multi-stage)** or any static host | Bun builds the static bundle; nginx serves it. `dist/` is plain static files. |

---

## 2. Runtime & tooling

- **Bun** is the runtime, package manager, and task runner: `bun install`, `bun run dev` / `build` / `preview`. Commit the text lockfile `bun.lock`; use `bun install --frozen-lockfile` in CI and Docker.
- **Node.js is only a fallback.** With no PWA/service-worker generation step and a pure TypeScript/Vite frontend (no native deps), the whole Vite pipeline is expected to run cleanly under Bun. If some build command ever hits a Node-API edge case, run just that command under Node LTS (currently 24) rather than reverting the toolchain.
- Pin versions so Claude Code, CI, and contributors resolve the same environment: `.bun-version` (or the `packageManager` field), and an `.nvmrc` if Node is used anywhere.

---

## 3. Physics: the non-negotiables (and what they actually are for Slingshot)

Two things are fixed. Note that the *first* is identical to the reference and the *second* is deliberately weaker.

### 3.1 Write the physics yourself — no physics engine

The whole simulation is small — on the order of 40–80 lines including multi-body summation and moving-body updates:

- The probe is a point mass: a position vector and a velocity vector. It is launched once with an initial velocity from the drag and thereafter coasts under gravity alone.
- Gravity is the **sum** of pulls from every gravity body: `a = Σ_i  strength_i · (c_i − p) / |c_i − p|³`, where `p` is the probe position, `c_i` is body *i*'s center, and `strength_i` folds `G·Mᵢ` into a single per-level-tunable constant (the spec uses no real units — readability beats realism). The `|…|³` form is the inverse-square law written for a vector: unit direction × inverse-square magnitude.
- **Moving bodies** advance along scripted, deterministic paths (e.g. a moon on a circle: `c_i(t) = center + R·(cos ωt, sin ωt)`). Update body positions *before* computing the probe's acceleration each step. This is also what makes a **true gravity assist** possible: swinging past a body that is itself moving lets the probe gain speed; around a fixed body the path only bends.
- **Optional mid-course nudge** (levels that enable it only): a single impulse added to the velocity at the tapped moment. One per flight, off by default.
- **Collisions**, checked each step against the probe's current position: touching any body's surface radius is a crash (unless that body is the target), touching a hazard is a crash, entering the target zone is a win, and leaving the play area (plus a short off-screen grace) or exceeding a max-flight-time cap is a fail.

Matter.js / Planck / Box2D model rigid-body collision, not inverse-square gravity, and would fight both the physics and determinism. Do not use them.

### 3.2 Fixed timestep + determinism — this is the real requirement

The spec's correctness requirement is blunt: *the same launch must always produce exactly the same path, so a solved shot stays solved.* That is a **determinism** requirement, and it is satisfied by a fixed timestep — not by any particular integrator's energy behavior.

- Run the physics on a **fixed timestep** (`DT`, e.g. `1/120` s), decoupled from render frame rate via an accumulator (see §6). Step a whole number of times per frame. This keeps the sim identical across 60 Hz and 120 Hz displays.
- **Integrator: velocity Verlet is the recommended default.** It gives smooth curves and is trivially cheap. Semi-implicit (symplectic) Euler is also perfectly acceptable given how short each flight is.
- **Unlike Hohmann Hero, the choice is not load-bearing.** Slingshot's spec makes long-term orbital stability an explicit non-goal, so the "Euler spirals out / RK4 decays in" concern doesn't apply — a coasting probe only needs to trace the *same* short arc every time, not a *closed* one forever. Pick velocity Verlet, keep `DT` constant, and move on.

Velocity Verlet with a (possibly moving) gravity field, per step:

```
a      = gravity(p, bodiesAt(t))          // Σ over bodies at their positions at time t
p     += v*DT + 0.5*a*DT*DT
bodies = bodiesAt(t + DT)                  // advance scripted bodies first
aNext  = gravity(p, bodies)
v     += 0.5*(a + aNext)*DT
t     += DT
```

### 3.3 Determinism checklist (Slingshot-specific — worth its own list)

Because Slingshot has multiple bodies and moving bodies, floating-point determinism needs a little discipline. Every item here is cheap and prevents "the shot I solved yesterday misses today":

- **Fixed `DT`, integer step count.** Never scale `DT`; never step by a wall-clock delta inside the sim.
- **Stable body iteration order.** Sum gravity contributions in a fixed order every run — floating-point addition isn't associative, so a reordered sum is a different number and a divergent path.
- **Scripted motion is a pure function of sim time / step index**, never of `Date.now()` or frame timing.
- **No `Math.random()` in the sim.** If anything needs jitter (e.g. drifting debris), seed a deterministic PRNG per level.
- **The preview calls the exact same step function** as the real sim (see §7) — no parallel "approximate" predictor.
- **Launch input is quantized deterministically.** Map the drag to launch velocity through a pure function so the same gesture yields identical initial conditions.

---

## 4. Rendering: why Canvas 2D

Same reasoning as the reference, and it applies just as well here. The visual language — a bright dotted probe trail, a dotted partial-preview arc redrawn every frame, clean solid discs for bodies — means clearing and repainting the whole scene ~60 times a second.

- **Canvas 2D** is ideal: immediate-mode, no retained DOM, cheap full-scene redraws.
- **Avoid SVG for the world** — one DOM node per trail point thrashes badly. SVG is fine for static HUD icons (including, per the accessibility spec, the shape/icon that distinguishes target from hazard without relying on color).
- **WebGL is overkill** for this schematic look. Reach for it only if you later want real glow/bloom.
- **Scale the canvas by `devicePixelRatio`** so lines and text stay crisp on high-density phones: size the drawing buffer to `cssWidth · dpr` and scale the context.
- The spec requires the **whole level to be visible before launch** across phone aspect ratios — compute a fit-to-field transform (world → screen) at load and on resize, and letterbox rather than clip.

---

## 5. Architecture: keep the sim and the UI separate

A clean seam prevents the most common performance problems.

- **Game loop + Canvas** own the *world*: physics stepping, body/probe/trail rendering, trajectory preview. Runs in a `requestAnimationFrame` loop with the fixed-timestep accumulator.
- **Svelte (or React)** owns the *chrome*: level select, attempt/nudge counters, preview-mode indicator, reset button, and the end-of-level star/style summary.
- They communicate through a **thin shared state layer** (a plain store/object). The UI reads game state to display HUD values; the UI writes intent (drag in progress, launch, nudge, reset) back.
- **Do not drive per-frame world rendering through the component framework.** Framework reactivity is for the HUD (updates a few times a second), not the canvas (every frame). Mixing them is the classic way to make a smooth game stutter.

Suggested module shape (illustrative, not prescriptive):

- `sim/` — vectors, the integrator, multi-body gravity, scripted body motion, the probe state, collision tests, the forward predictor. **Pure, no DOM, unit-testable.**
- `render/` — canvas drawing of bodies, target, hazards, probe, trail, and the predicted arc.
- `input/` — drag-to-aim gesture → launch velocity; the single tap-to-nudge handler.
- `game/` — the loop, level definitions, win/lose detection, scoring/stars.
- `ui/` — Svelte components for HUD and menus.

### 5.1 Input: drag-to-aim (Slingshot-specific)

The reference has hold-to-burn; Slingshot has a one-gesture launch, so input deserves its own small module.

- On the launch pad: `pointerdown` starts the aim, `pointermove` updates it, `pointerup` launches. Use Pointer Events so touch and mouse share one path.
- **Drag length → launch speed (capped); drag direction → heading.** Pick one convention (slingshot pull-back-to-fire-forward, or pull-toward-aim) and stay consistent, per the spec.
- The mapping from drag vector to launch velocity must be a **pure, deterministic function** (see §3.3) and should feed the same value into both the live preview and the eventual launch.
- Large, forgiving, thumb-reachable drag area (accessibility spec); show the live launch-heading arrow while dragging.

---

## 6. Fixed-timestep game loop (reference shape — simpler than Hohmann Hero)

No time-warp, so the loop is the plain accumulator with no `warpMultiplier`:

```
let accumulator = 0
const DT = 1 / 120                 // fixed physics step, constant forever

function frame(now) {
  const realElapsed = now - lastFrameTime
  lastFrameTime = now
  accumulator += realElapsed

  let steps = 0
  while (accumulator >= DT && steps < MAX_STEPS_PER_FRAME) {
    stepPhysics(DT)                // integrator + scripted bodies + collision check
    accumulator -= DT
    steps++
  }

  updateHudState()                 // push a few values to the UI store
  render()                         // clear canvas, draw world + trail + preview
  requestAnimationFrame(frame)
}
```

- Cap `MAX_STEPS_PER_FRAME` so a backgrounded tab can't freeze the loop catching up.
- The accumulator still matters even without warp: it's what makes the sim deterministic across different display refresh rates.

---

## 7. Trajectory preview reuses the same integrator

The preview is the single most important design lever in Slingshot, so it must be exactly the physics the probe will fly — never an approximation.

- Fork the probe's *would-be* launch position and velocity (from the current drag) into a scratch state.
- Step it forward with the **same integrator, same `DT`, same multi-body gravity**, ignoring the mid-course nudge. **Advance moving bodies along the same scratch timeline** so the preview stays accurate when bodies drift.
- **Stop the drawn curve at the first collision** (surface, hazard, or play-area bound) so the dotted line never passes through a planet.
- Collect the points and draw them as the dotted preview.

Preview *length* is a **per-level setting**, which is how difficulty is tuned:

- **Partial (default):** draw only the first arc, then fade. Enough to plan, not enough to trivialize.
- **Full (easy / accessibility):** draw all the way to the target.
- **None (expert / trick-shot):** pure feel and iteration.

Also derive, from the same forward-simulated points, the **near-miss / closest-approach** readout the spec asks for on a failed shot.

---

## 8. Persistence

- Store per-level completion, star rating, and best result (attempts, nudges used, style/proximity bonus) as JSON in `localStorage`. It's a few KB; no IndexedDB needed.
- Namespace and version the key (e.g. `slingshot:v1`) so a future save-format change can migrate cleanly.

---

## 9. Testing the part that matters

The physics is the one place worth automated tests. Because `sim/` is pure (no DOM), unit-test it directly with **Vitest** (shares Vite config, runs under Bun). The tests differ from Hohmann Hero — energy conservation is **not** relevant here; determinism and preview fidelity are.

- **Determinism test (the key one):** run the same launch twice — and again after interleaving unrelated work — and assert the two trajectories are identical (bit-for-bit, or within an extremely tight tolerance). This is the direct check for "a solved shot stays solved."
- **Preview-matches-reality test:** the forward predictor and the live sim, given identical inputs and no nudge, must produce the same points.
- **Collision-correctness tests:** a shot aimed into a body's surface radius crashes; a shot into the target zone wins; a shot leaving the field fails after the grace window; the target body does *not* crash the probe.
- **Multi-body / moving-body sanity:** a probe swinging past a *moving* body gains speed (true assist); past a *fixed* body its speed returns to launch speed at equal radius (bend only, no energy gain).

---

## 10. Mobile & accessibility (still required without a PWA)

Per the game spec's accessibility section, these apply to a plain mobile website:

- **Portrait-first, one-thumb play.** All controls — the drag area, reset, optional nudge — reachable by thumb.
- **Safe-area insets.** Use `viewport-fit=cover` and `env(safe-area-inset-*)` so notches and the home indicator don't cover controls.
- **Whole level visible before launch** across aspect ratios (fit-to-field transform, letterbox not clip).
- **Colorblind-safe palette; never distinguish target from hazard by color alone** — use shape/icon differences (a good use for inline SVG icons in the HUD).
- **Full-preview mode as an accessibility aid**, plus a **reduced-motion** option for animated flourishes.
- **Audio unlock:** resume the Web Audio context on the first user gesture (the first tap/launch).

---

## 11. Audio

- **Web Audio API** directly (or Howler.js if you prefer a wrapper). Cues per the spec: a launch "twang," a soft flight whoosh, a success chime, a light crash thud.
- Gate audio behind the first user gesture; respect the reduced-motion / mute preferences.

---

## 12. Build phasing (maps to the game spec's phases)

- **Phase 1 (MVP):** Bun + Vite + TypeScript + Canvas 2D. Hand-written fixed-timestep integrator, one fixed gravity body, drag-to-aim launch, deterministic ballistic flight, crash / off-screen / win detection, partial trajectory preview, Levels 1–3. **Prove that curving a shot around a body feels good before anything else.** A minimal on-canvas HUD is fine here.
- **Phase 2:** Multiple bodies, hazards, the corridor and flyby levels; the Svelte/React HUD shell; attempt-based scoring, stars, and `localStorage` saves; visible flight-trail feedback.
- **Phase 3:** Moving bodies and moving targets, the true gravity-assist level, the optional mid-course nudge, the asteroid field, the full level set, style/proximity scoring, audio, and accessibility options (colorblind-safe palette, reduced motion, full-preview aid).

Plan **portrait layout and safe-area handling from the start** — retrofitting layout is more painful than adding features.

> **Later (deferred):** wrapping this as a PWA — installability, offline service worker — is a clean add-on once the game is solid. It sits entirely around the game and touches none of the physics or rendering above.

---

## 13. Deployment (Docker or static host)

The output is a plain static bundle, so deployment is unconstrained.

- **Default:** a **multi-stage Docker build** — a Bun stage compiles the static bundle with Vite, a minimal nginx stage serves it. The runtime image contains only nginx plus built files (no Bun, no `node_modules`), so it's small and portable. The same image runs identically on a VM, Cloud Run, Fly.io, ECS, Kubernetes, or a laptop. (The reference project's `Dockerfile` and `nginx.conf` transfer verbatim — hashed `/assets/` cached hard, `index.html` never cached, SPA fallback to `index.html`.)
- **Escape hatch:** nothing forces Docker. The `dist/` output is plain static files, so Cloudflare Pages / Netlify / Vercel / GitHub Pages all work.
- Pin image tags (`oven/bun:1.3-alpine`, `nginx:1-alpine`) for reproducible builds; a pure TS/Vite frontend has no native deps, so Alpine/musl is fine.

---

## 14. Summary of what's fixed vs. flexible

**Fixed (don't substitute):**

- Canvas 2D for world rendering.
- A hand-written integrator on a **fixed timestep**, with **determinism** as the guaranteed property.
- No physics engine.
- One physics function shared by the real sim and the preview predictor.

**Flexible (swap to taste):**

- Velocity Verlet vs. semi-implicit Euler (both fine here — this is *not* the load-bearing choice it is in Hohmann Hero).
- Svelte vs. React vs. hand-rolled DOM for the HUD.
- Web Audio directly vs. Howler.js.
- Where the Docker image runs, or dropping `dist/` on a static host instead.
- Exact module/file layout.

**Deliberately dropped from the reference stack:** time-warp and its sub-stepping (no long coasts in Slingshot), and the symplectic-integrator *mandate* (Slingshot doesn't need long-term orbital stability). Everything else carries over.
