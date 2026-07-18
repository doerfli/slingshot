# Slingshot

One flick. You aim and launch a probe, and gravity from nearby planets and moons bends its
path. Curve around a world to reach a target hidden behind it, thread the gap between two
gravity wells, or time a shot to catch a moving station. Angry Birds grammar applied to
orbital mechanics — a single gesture, an immediate result, a satisfying trick-shot feel.

A small, mobile-first web game. Runs in a phone browser (and desktop), no account required,
progress stored locally.

## Status

**Pre-implementation.** The design is fully specified and the build is planned; code hasn't
started yet. See the [build plan & progress tracker](docs/slingshot-plan.md).

## Documentation

| Doc | What it covers |
| --- | --- |
| [docs/slingshot-spec.md](docs/slingshot-spec.md) | Game & physics spec — *what the game is* |
| [docs/slingshot-stack.md](docs/slingshot-stack.md) | Technical stack — *how to build it* |
| [docs/slingshot-plan.md](docs/slingshot-plan.md) | Phased implementation plan **+ live progress** |
| [CLAUDE.md](CLAUDE.md) | Working guidance & non-negotiable constraints |

## Tech stack

- **Bun** + **TypeScript** + **Vite**
- **Canvas 2D** for the world (bright dotted probe trail, dotted trajectory preview)
- **Svelte** for the HUD/menus, kept strictly out of the simulation
- **Hand-written fixed-timestep physics** (velocity Verlet) — no physics engine;
  **determinism** is the guaranteed property, so a solved shot stays solved
- **localStorage** saves, **Web Audio** SFX, **Vitest** for the pure physics
- **Docker (multi-stage) / nginx** or any static host for deploy

## Getting started

Bun and Node are managed by **[mise](https://mise.jdx.dev/)** (`mise.toml` pins bun 1.3,
node 24). They are **not** on the bare `PATH` — run tools through mise:

```sh
mise install                  # installs pinned bun + node (first time)
mise exec -- bun install      # install dependencies (once package.json exists)

mise exec -- bun run dev      # start the Vite dev server
mise exec -- bun run test     # run the physics unit tests (Vitest)
mise exec -- bun run build    # build the static bundle -> dist/
mise exec -- bun run preview  # serve the built bundle
```

Tip: `eval "$(mise activate bash)"` once per shell gives you `bun`/`node` directly.

> The `bun run …` scripts land with the project scaffold (Phase 1). Until then only
> `mise install` / `mise exec -- bun --version` do anything.

## Roadmap

Built in the spec's three phases (details in [the plan](docs/slingshot-plan.md)):

1. **Phase 1 (MVP)** — one fixed gravity body, drag-to-aim launch, deterministic flight,
   partial trajectory preview, Levels 1–3. Prove that curving a shot around a body feels good.
2. **Phase 2** — multiple bodies, hazards, the corridor & flyby levels, Svelte HUD,
   attempt-based scoring, stars, saves, flight-trail feedback.
3. **Phase 3** — moving bodies & targets, the true gravity-assist level, optional mid-course
   nudge, asteroid field, full level set, style scoring, audio, accessibility.

## License

TBD.
