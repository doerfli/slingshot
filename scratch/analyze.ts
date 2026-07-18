// Scratch analysis: for each level, find a winning launch and report how much the
// path actually bends (total turn angle) and its closest approach to the body. Run:
//   mise exec -- bun scratch/analyze.ts
import { LEVELS } from '../src/game/levels';
import { step, type Kinematic } from '../src/sim/integrator';
import { check } from '../src/sim/collision';
import { dragToLaunchVelocity } from '../src/sim/input-map';
import { DT, MAX_SPEED, POWER_SCALE, MAX_FLIGHT_TIME } from '../src/sim/constants';
import { vec } from '../src/sim/vec';
import type { Level } from '../src/sim/types';

const MAX_STEPS = Math.ceil(MAX_FLIGHT_TIME / DT);
const MAX_PULL = MAX_SPEED / POWER_SCALE;

function fly(level: Level, v0: { x: number; y: number }) {
  let s: Kinematic = { p: { ...level.pad }, v: { ...v0 } };
  let turn = 0;
  let prevAng = Math.atan2(v0.y, v0.x);
  let minAppr = Infinity;
  let maxSpeed = Math.hypot(v0.x, v0.y);
  const speed0 = Math.hypot(v0.x, v0.y);
  for (let i = 0; i < MAX_STEPS; i++) {
    s = step(s, level.bodies, DT);
    const ang = Math.atan2(s.v.y, s.v.x);
    let d = ang - prevAng;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turn += d;
    prevAng = ang;
    const sp = Math.hypot(s.v.x, s.v.y);
    if (sp > maxSpeed) maxSpeed = sp;
    for (const b of level.bodies) {
      const dd = Math.hypot(s.p.x - b.c.x, s.p.y - b.c.y) - b.radius;
      if (dd < minAppr) minAppr = dd;
    }
    const out = check(s.p, level);
    if (out !== 'flying') return { out, turnDeg: (turn * 180) / Math.PI, minAppr, speed0, maxSpeed };
  }
  return { out: 'timeout', turnDeg: (turn * 180) / Math.PI, minAppr, speed0, maxSpeed };
}

// Also sweep ALL shots (not just wins) at full power to see how a close pass bends —
// this is the "fly near the planet and wrap" feel the player cares about.
function closePassTurnAtFullPower(level: Level) {
  const body = level.bodies[0];
  let best = { turn: 0, minAppr: Infinity, maxSpeed: 0, speed0: 0 };
  for (let deg = 0; deg < 360; deg += 0.5) {
    const a = (deg * Math.PI) / 180;
    const drag = vec(Math.cos(a) * MAX_PULL, Math.sin(a) * MAX_PULL); // full power
    const r = fly(level, dragToLaunchVelocity(drag));
    // Look for shots that graze the body (close but survive-ish) and turn the most.
    if (r.minAppr < body.radius * 1.5 && Math.abs(r.turnDeg) > Math.abs(best.turn)) {
      best = { turn: r.turnDeg, minAppr: r.minAppr, maxSpeed: r.maxSpeed, speed0: r.speed0 };
    }
  }
  return best;
}

for (const level of LEVELS) {
  let fastest: ReturnType<typeof fly> | null = null;
  let wins = 0;
  for (let deg = 0; deg < 360; deg += 1) {
    const a = (deg * Math.PI) / 180;
    for (let pull = 15; pull <= MAX_PULL; pull += 3) {
      const drag = vec(Math.cos(a) * pull, Math.sin(a) * pull);
      const r = fly(level, dragToLaunchVelocity(drag));
      if (r.out === 'win') {
        wins++;
        if (!fastest || r.speed0 > fastest.speed0) fastest = r;
      }
    }
  }
  const close = closePassTurnAtFullPower(level);
  if (fastest) {
    console.log(
      `L${level.id} ${level.name.padEnd(18)} wins=${String(wins).padStart(4)}  ` +
        `fastestWin: speed=${fastest.speed0.toFixed(0)} turn=${fastest.turnDeg.toFixed(0)}°  ` +
        `closePass@fullPower: turn=${close.turn.toFixed(0)}° minAppr=${close.minAppr.toFixed(0)} ` +
        `speed ${close.speed0.toFixed(0)}→${close.maxSpeed.toFixed(0)} (×${(close.maxSpeed / (close.speed0 || 1)).toFixed(1)})`,
    );
  } else {
    console.log(`L${level.id} ${level.name.padEnd(18)} NO WIN FOUND  closePass turn=${close.turn.toFixed(0)}°`);
  }
}
