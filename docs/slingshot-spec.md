# Slingshot — Game & Physics Specification

A build spec for a small, mobile-friendly web game about launching a probe through gravity fields to reach a target. This document describes *what the game is* and *how the physics should behave*. It intentionally avoids implementation choices (frameworks, code structure, file layout) — those are for the build phase.

---

## 1. Elevator pitch

One flick. You aim and launch a probe, and gravity from nearby planets and moons bends its path. Curve around a world to reach a target hidden behind it, thread the gap between two gravity wells, or time a shot to catch a moving station. It's Angry Birds grammar applied to orbital mechanics: a single gesture, an immediate result, and a satisfying "trick shot" feel once you learn to read the bend.

Punchy and immediate — the arcade counterpart to a slow rendezvous puzzle.

---

## 2. Platform & format

- Runs in a mobile web browser; must also work on desktop.
- One-gesture play: aim and release. Fully thumb-driven.
- No account required. Level progress and best scores stored locally on the device.
- Bite-sized levels; instant retry.

---

## 3. Core loop

1. See the level: your launch pad, the gravity wells, hazards, and the target.
2. Drag to aim — set direction and power. A partial trajectory preview hints at the start of the path.
3. Release to launch the probe.
4. Watch it fly under gravity, curving around bodies.
5. It either reaches the target (win), crashes, or flies off-screen (fail).
6. Retry instantly, adjusting aim; beat the level, then chase a better score.

---

## 4. Controls

- **Aim & launch**: touch and drag from the probe's launch pad. Drag *length* sets launch speed (capped); drag *direction* sets the launch heading. A slingshot feel (pull back to fire forward) is preferred, but pull-toward-aim is an acceptable alternative — pick one and stay consistent.
- **Release**: launches the probe.
- **Reset / retry**: restart the level; re-aim.
- Optional advanced mechanic: **one mid-course nudge** — a single small tap-to-thrust during flight, available only on levels designed for it. Off by default.

Aim assist:
- Show a launch-heading arrow while dragging.
- Show a **partial** predicted path (see §7) — enough to plan, not enough to trivialize.

---

## 5. Physics model (behavioral requirements)

Top-down 2D. Because each shot is short-lived and every level is hand-authored, the physics can be looser and more permissive than a full orbital simulator — but it must be **deterministic**.

- **Gravity bodies**: one or more planets/moons, each with a position and a mass. By default they are *fixed* in place. Each pulls the probe toward its center with a strength that falls off with the square of distance (inverse-square). The total pull on the probe at any instant is the sum of the pulls from all bodies.
- **The probe** is a point mass. It is launched once with an initial velocity (from the drag) and thereafter moves under gravity alone — no continuous thrust. (The optional mid-course nudge is the only exception, and only where a level enables it.)
- **Determinism is required.** The same launch must always produce exactly the same path. Use a fixed simulation step so a solved shot stays solved. Long-term orbital stability is *not* needed — shots are short and levels are authored around them.
- **Collisions**: each body has a surface radius. The probe touching a body's surface is a crash (fail) — unless that body is the target. The probe touching a hazard is a crash. The probe reaching the target zone is a win. A probe that leaves the play area (flies off to infinity) is a fail.
- **Fixed vs moving bodies**: default bodies are stationary. Advanced levels may put bodies on scripted paths (e.g. a moon circling a planet). Moving bodies are what make a *true* gravity assist possible — a probe can gain speed by swinging past a body that is itself moving. Around a fixed body the path only bends; it does not gain energy. Keep any body motion scripted and deterministic.
- **No n-body chaos to design around, no 3D.** Multiple gravity sources are fine here (short flights make it stable and predictable), but keep body counts and layouts hand-tuned per level.

---

## 6. Entities

- **Launch pad** — the probe's fixed starting point.
- **Probe** — the projectile. Position, velocity. Leaves a visible trail as it flies.
- **Gravity bodies** — planets/moons. Each has a mass (pull strength), a lethal surface radius, and optionally a scripted motion path.
- **Target** — a ring, pad, or landing zone the probe must reach. May be fixed or moving.
- **Hazards** — asteroids or debris that destroy the probe on contact. May be fixed or drifting.

---

## 7. Trajectory preview & feedback

The single most important design lever in the whole game is **how much of the path you preview**. It defines the entire feel:

- **Partial preview (default)**: show only the first arc of the predicted path, then let it fade. The player must *predict* how gravity bends the rest. This is the recommended sweet spot — enough to plan a shot, not enough to make it a trivial "aim the line at the goal" exercise.
- **Full preview (easy / puzzle mode)**: the dotted path bends all the way to the target. The challenge becomes reading a complex curve. Good for tutorial or accessibility.
- **No preview (expert / trick-shot mode)**: pure feel and iteration.

Make preview length a per-level setting so difficulty can be tuned, and optionally an accessibility toggle.

Other feedback:
- Live launch-heading arrow while dragging.
- The probe leaves a visible flight trail so the player can see exactly what happened and adjust.
- On a near miss, briefly show how close the probe came to the target.
- Clear crash / off-screen / success feedback.

---

## 8. Win & lose conditions

- **Win**: the probe reaches the target zone (enters the ring / lands in the pad). For "land softly" variants, an optional low-speed requirement can be added, but the default is simply reaching the zone.
- **Lose**: probe crashes into a body or hazard, or flies off the play area, or the level's attempt/fuel limit is exhausted.
- Failure is cheap — instant re-aim and retry.

---

## 9. Level progression

Each level introduces one new spatial idea. Suggested order:

1. **Straight shot** — no meaningful gravity in the way; learn the aim-and-release gesture.
2. **The bend** — a single gravity well beside the flight path; learn that gravity curves the shot.
3. **Around the world** — target hidden directly behind a body; you must curve around it to hit it.
4. **The corridor** — two gravity wells with a gap between them; thread the needle.
5. **Slingshot around** — a tight swing close past one body to redirect sharply toward an off-angle target (introduces the "flyby" feel).
6. **Moving target** — a station orbiting/drifting; time the launch to intercept.
7. **True assist** — a *moving* body you swing past to gain speed and reach a distant target you couldn't reach otherwise.
8. **Asteroid field** — hazards to avoid while still using gravity to steer.

Difficulty escalates through geometry, moving elements, and hazards — not through demanding faster reflexes.

---

## 10. Scoring & progression

- Per level, score on: **number of attempts** (fewer is better), **mid-course nudges used** (if enabled), and optional **style** — grazing close flybys or hitting near-optimal lines.
- Provide a **par** per level (a target number of attempts) and award 1–3 stars.
- Reward the risky elegant line over the safe wide one via a small style/proximity bonus, so mastery has a ceiling.
- Show best result per level; levels unlock in sequence and remain replayable.

---

## 11. UI / HUD

- Aim/drag control on the launch pad.
- Attempt counter (and nudge counter where relevant).
- Preview-mode indicator if the level varies it.
- Reset / retry button.
- End-of-level summary: stars, attempts, style bonus, retry / next.

---

## 12. Visual & audio direction

- Clean, readable, slightly playful. Bodies as solid discs with clear gravity "presence"; probe trail as a bright dotted line.
- Distinct, obvious visual difference between a harmless target and a lethal hazard.
- Snappy audio: a launch "twang," a soft whoosh in flight, a satisfying success chime, a light thud on crash.
- Everything must read at phone size — bold shapes, clear trails, generous target zones.

---

## 13. Accessibility & mobile requirements

- Large, forgiving drag area; the aim gesture must work with a thumb.
- Colorblind-safe palette; never distinguish target from hazard by color alone (use shape/icon differences).
- Offer full-preview mode as an accessibility aid for players who find partial-preview too demanding.
- A "reduced motion" option for animated flourishes.
- Works across phone aspect ratios without clipping the field; the whole level must be visible before launch.

---

## 14. Non-goals (out of scope)

- No true long-term orbital simulation or stability requirements — shots are short and authored.
- No 3D, no orbital inclination.
- No realistic scale, real planets, or real units; readability beats realism.
- No ship-building, upgrades, or resource economy.
- No accounts, servers, or multiplayer.

---

## 15. Suggested tunable defaults (starting points, not law)

- Launch speed: capped so a max-power drag gives a lively but controllable shot.
- Body mass / pull strength: tuned per level so the intended curve is achievable and readable.
- Target zone size: generous early, tighter later.
- Preview length: short arc by default; adjustable per level.
- Off-screen timeout: fail the shot shortly after the probe clearly leaves the field.

All values should be easy to tweak during playtesting.

---

## 16. Suggested build phasing

- **Phase 1 (MVP)**: one fixed gravity body, drag-to-aim launch, deterministic ballistic flight, crash / off-screen / win detection, partial trajectory preview, and Levels 1–3. Prove that curving a shot around a body feels good first.
- **Phase 2**: multiple bodies, hazards, the corridor and flyby levels, attempt-based scoring and stars, flight-trail feedback.
- **Phase 3**: moving bodies and moving targets, true gravity-assist level, optional mid-course nudge, asteroid field, full level set, style scoring, polish, audio, accessibility options.
