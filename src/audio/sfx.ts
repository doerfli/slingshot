// Sound effects (spec §12): a launch "twang", an 80s synthwave in-flight dance loop, a
// success chime, a crash thud, and a nudge blip. Synthesised with the Web Audio API —
// no asset files.
//
// PRESENTATION ONLY: nothing here touches sim/ or affects determinism. Everything is
// defensive: if there is no AudioContext (tests / SSR) or the user has muted, every call
// is a silent no-op. Browsers block audio until a user gesture, so `resume()` must be
// called from the first pointer interaction to unlock playback on mobile.

let ctx: AudioContext | null = null;
let muted = false;
let master: GainNode | null = null;
/** Submix for the music loop, so drums/bass/lead balance without touching SFX level. */
let musicBus: GainNode | null = null;
/** One buffer of white noise, reused for the drum hats + clap. */
let noiseBuffer: AudioBuffer | null = null;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);
    // Pre-render a short white-noise buffer for the percussion.
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  } catch {
    return null;
  }
}

/** Unlock/resume audio from a user gesture (required by mobile autoplay policies). */
export function resume(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

export function setMuted(m: boolean): void {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.9;
  if (m) flightStop();
}

export function isMuted(): boolean {
  return muted;
}

/** A single enveloped tone. `type`, start/end frequency, duration, and peak gain shape
 *  the whole vocabulary of blips below. */
function tone(freq: number, endFreq: number, dur: number, peak: number, type: OscillatorType = 'sine'): void {
  const c = ac();
  if (!c || muted || !master) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    const t0 = c.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* audio glitch — never let a sound break the game */
  }
}

/** Launch "twang": a quick downward pluck. */
export function launch(): void {
  tone(520, 160, 0.18, 0.5, 'triangle');
}

/** Success chime: a bright rising two-note. */
export function win(): void {
  tone(660, 990, 0.16, 0.4, 'sine');
  setTimeout(() => tone(990, 1320, 0.22, 0.35, 'sine'), 90);
}

/** Crash thud: a short low noise-ish drop. */
export function crash(): void {
  tone(180, 60, 0.28, 0.5, 'sawtooth');
}

/** Nudge blip: a tiny high tick. */
export function nudge(): void {
  tone(880, 880, 0.06, 0.3, 'square');
}

// --- in-flight background music: an 80s synthwave dance loop -----------------------
// A four-on-the-floor kick, offbeat hi-hats and a backbeat clap under a driving octave
// synth-bass and a bright square arp, cycling an A-minor i–VI–III–VII progression at a
// danceable ~122 BPM. Scheduled ahead of the audio clock (the standard two-clocks
// pattern) so the groove stays tight without setInterval jitter.

const STEP16 = 0.123; // seconds per 16th note (~122 BPM)
const BARS: { arp: number[]; bass: number }[] = [
  { arp: [220.0, 261.63, 329.63, 440.0], bass: 110.0 }, // Am
  { arp: [174.61, 220.0, 261.63, 349.23], bass: 87.31 }, // F
  { arp: [261.63, 329.63, 392.0, 523.25], bass: 130.81 }, // C
  { arp: [196.0, 246.94, 293.66, 392.0], bass: 98.0 }, // G
];

let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicPlaying = false;
let nextNoteTime = 0;
let stepIndex = 0;

/** A punchy synth kick: a fast pitch drop with a quick amplitude decay. */
function kick(time: number): void {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(165, time);
  o.frequency.exponentialRampToValueAtTime(50, time + 0.11);
  g.gain.setValueAtTime(0.9, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  o.connect(g);
  g.connect(musicBus);
  o.start(time);
  o.stop(time + 0.2);
}

/** A filtered white-noise burst — the hats (highpass) and clap (bandpass). */
function noiseBurst(time: number, dur: number, peak: number, kind: 'hp' | 'bp', freq: number): void {
  if (!ctx || !musicBus || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filt = ctx.createBiquadFilter();
  filt.type = kind === 'bp' ? 'bandpass' : 'highpass';
  filt.frequency.value = freq;
  if (kind === 'bp') filt.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(musicBus);
  src.start(time);
  src.stop(time + dur + 0.02);
}

/** A warm sawtooth synth-bass note through a lowpass. */
function bass(freq: number, time: number): void {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, time);
  f.type = 'lowpass';
  f.frequency.value = 900;
  const dur = STEP16 * 1.7;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.09, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(f);
  f.connect(g);
  g.connect(musicBus);
  o.start(time);
  o.stop(time + dur + 0.02);
}

/** A bright square-wave arp pluck. */
function lead(freq: number, time: number): void {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, time);
  const dur = STEP16 * 0.9;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.05, time + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g);
  g.connect(musicBus);
  o.start(time);
  o.stop(time + dur + 0.02);
}

/** Lay down one 16th-note slice of the groove (drums + bass + arp). */
function scheduleStep(step: number, time: number): void {
  const bar = BARS[Math.floor(step / 16) % BARS.length];
  const s = step % 16; // position within the bar, in 16ths

  // Drums: four-on-the-floor kick, backbeat clap on beats 2 & 4, offbeat hats.
  if (s % 4 === 0) kick(time);
  if (s === 4 || s === 12) noiseBurst(time, 0.09, 0.16, 'bp', 1600); // clap
  if (s % 2 === 1) noiseBurst(time, s % 4 === 3 ? 0.12 : 0.035, s % 4 === 3 ? 0.06 : 0.05, 'hp', s % 4 === 3 ? 6000 : 8000);

  // Octave synth-bass on the eighths (root, jumping up an octave on the "and").
  if (s % 2 === 0) bass(s % 4 === 2 ? bar.bass * 2 : bar.bass, time);

  // Bright arp running the chord tones in 16ths, alternating octave each beat for lift.
  const oct = Math.floor(s / 4) % 2 === 1 ? 2 : 1;
  lead(bar.arp[s % 4] * oct, time);
}

/** Lookahead scheduler: enqueue any notes due within the next ~200 ms, then re-arm. */
function scheduler(): void {
  if (!musicPlaying || !ctx) return;
  while (nextNoteTime < ctx.currentTime + 0.2) {
    scheduleStep(stepIndex, nextNoteTime);
    nextNoteTime += STEP16;
    stepIndex++;
  }
  musicTimer = setTimeout(scheduler, 40);
}

/** Start the in-flight music loop. Idempotent; no-op when muted or audio is unavailable. */
export function flightStart(): void {
  const c = ac();
  if (!c || muted || musicPlaying) return;
  musicPlaying = true;
  stepIndex = 0;
  nextNoteTime = c.currentTime + 0.06;
  scheduler();
}

/** Stop the music loop. Notes already scheduled play out (a short, graceful tail). Safe
 *  to call when nothing is playing. */
export function flightStop(): void {
  musicPlaying = false;
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}
