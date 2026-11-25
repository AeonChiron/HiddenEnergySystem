// Short game sound effects, synthesized with Web Audio so the site works
// offline with no audio files. Replaceable later with recorded sounds:
// put files in /sfx/<name>.mp3 and they are used instead.

import { createUISFX } from '../vendor/uisfx.js';

let ctx = null;
let master = null;

// Sound design (Seed, Nov 25): cues from UI SFX (MIT code, CC0 sounds, made in
// the browser, no files). Small moments use the crisp "glass" pack, the big
// moments the deep "cinematic" pack, and the streak gets an "arcade" sparkle.
// Seed: no sound should repeat exactly. Each moment has its own sound, picks
// among a few variants without playing the same one twice in a row, follows
// the context (pitch climbs as the clock runs out, as rules build, as players
// join), and gets a slight random pitch so even repeats are never identical.
// A variant is [pack, cue, volume, rate]. A function gets the call's argument.
const R = (lo, hi) => lo + Math.random() * (hi - lo);
const CUES = {
  allin: [['glass', 'complete', 0.7], ['glass', 'check', 0.7]],
  // a reveal sounds bigger when more people got it
  correct: (share = 0.5) => (share >= 0.8 ? [['cinematic', 'achievement', 0.9], ['cinematic', 'level-up', 0.85]] : [['cinematic', 'success', 0.9], ['cinematic', 'reward', 0.85]]),
  wrong: [['cinematic', 'error', 0.6], ['cinematic', 'blocked', 0.6]],
  reward: (i = 0) => [['glass', 'reward', 0.6, 1 + i * 0.05]],
  place: (i = 0) => [['cinematic', 'badge', 0.85, [1.06, 1, 0.94][i] || 1]],
  fanfare: [['cinematic', 'achievement', 1]],
  bonus: [['cinematic', 'bonus', 0.9]],
  streak: [['arcade', 'streak', 0.6]],
  pause: [['glass', 'pause', 0.6]],
  play: [['glass', 'play', 0.6]],
  // phones
  notify: [['glass', 'notification', 0.7], ['glass', 'mention', 0.7]],
  select: (i = 0) => [['glass', 'select', 0.6, 0.95 + i * 0.05]],
  bet: (i = 0) => [['glass', 'toggle-on', 0.5, 0.92 + i * 0.06]],
  lock: [['glass', 'lock', 0.7]],
  hint: [['glass', 'unlock', 0.7]],
  timeup: [['glass', 'warning', 0.6]],
  win: [['cinematic', 'success', 0.85], ['cinematic', 'reward', 0.85]],
  lose: [['glass', 'error', 0.55], ['glass', 'blocked', 0.55]],
};
// These keep their own synth sound and add a UI SFX layer on top.
const LAYERS = {};

// --- Air: whooshes, gusts, breezes (Seed, Nov 25) ------------------------
// Transitions use moving air, never notes, so they don't clash with the music.
// Each call draws fresh values (length, band, sweep, direction, texture), so
// no two are ever the same, and each moment has its own shape:
//   swish  short and bright (options, Next, Back)
//   whoosh a camera move going past
//   breeze a soft swell as something settles in (a rule, a title)
//   gust   a big wide sweep with a low rumble (round, discovery, bonus)
//   puff   a tiny breath (a player joins, a callout, a line)
//   tick   a dry clock tick in the last seconds, tick and tock
let noiseBuf = null;
function noiseSrc() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = noiseBuf.getChannelData(c); let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.55 + b * 3; } }
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; return src;
}
// One stroke of air: a noise band sweeping lo -> hi (at `peak` of the way) -> end.
const AIR_LEVEL = 3.2; // a filtered noise band is quiet; this sits it level with the other effects
function air({ dur, lo, hi, end = lo, q = 0.8, gain = 0.25, peak = 0.45, pan = 0, at = 0, type = 'bandpass' }) {
  const t = ctx.currentTime + at;
  gain *= AIR_LEVEL;
  const src = noiseSrc();
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(lo, t);
  f.frequency.exponentialRampToValueAtTime(hi, t + dur * peak);
  f.frequency.exponentialRampToValueAtTime(end, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * peak);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = src.connect(f).connect(g);
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-pan, t); p.pan.linearRampToValueAtTime(pan, t + dur); node = node.connect(p); }
  node.connect(master);
  src.start(t, Math.random() * 3.5); src.stop(t + dur + 0.05);
}
const side = () => (Math.random() < 0.5 ? -1 : 1);
const AIR = {
  swish(dir = side(), k = 1) {
    const d = R(0.26, 0.4) * k;
    air({ dur: d, lo: R(700, 1100), hi: R(3800, 6000), end: R(1200, 2000), q: R(0.9, 1.5), gain: 0.2, peak: R(0.35, 0.5), pan: 0.6 * dir });
    air({ dur: d * 0.8, lo: 5000, hi: 9000, end: 6000, type: 'highpass', q: 0.5, gain: 0.05, pan: 0.6 * dir });
  },
  whoosh(dir = side(), k = 1) {
    const d = R(0.55, 0.8) * k;
    air({ dur: d, lo: R(260, 420), hi: R(1800, 2800), end: R(450, 700), q: R(0.7, 1.1), gain: 0.3, peak: R(0.4, 0.55), pan: 0.7 * dir });
    air({ dur: d, lo: 3000, hi: 7000, end: 4000, type: 'highpass', q: 0.4, gain: 0.06, peak: 0.5, pan: 0.7 * dir });
  },
  breeze(k = 1) {
    const d = R(0.9, 1.25) * k;
    air({ dur: d, lo: R(350, 550), hi: R(1500, 2400), end: R(600, 900), q: R(0.5, 0.8), gain: 0.16, peak: R(0.55, 0.7), pan: 0.25 * side() });
    air({ dur: d * 0.9, lo: 4000, hi: 8000, end: 5000, type: 'highpass', q: 0.4, gain: 0.04, peak: 0.65 });
  },
  gust(k = 1) {
    const d = R(1.6, 2.1) * k;
    air({ dur: d, lo: R(180, 260), hi: R(2800, 4000), end: R(300, 450), q: R(0.6, 0.9), gain: 0.32, peak: R(0.5, 0.62), pan: 0.5 * side() });
    air({ dur: d * 1.1, lo: 60, hi: 160, end: 70, type: 'lowpass', q: 0.7, gain: 0.35, peak: 0.55 });
    air({ dur: d * 0.9, lo: 5000, hi: 10000, end: 6000, type: 'highpass', q: 0.4, gain: 0.05, peak: 0.6 });
  },
  puff(k = 1) {
    air({ dur: R(0.14, 0.22), lo: R(900, 1400) * k, hi: R(2600, 3800) * k, end: R(1500, 2000) * k, q: R(1.2, 2), gain: 0.22, peak: 0.3, pan: 0.3 * side() });
  },
  tick(s = 5) {
    const tock = s % 2 === 0;
    air({ dur: 0.05, lo: tock ? 2600 : 3800, hi: tock ? 2800 : 4200, q: 3, gain: 0.2 + (5 - s) * 0.05, peak: 0.08, type: 'bandpass' });
  },
};
// The moments that use air instead of notes.
const AIRED = {
  join: (n = 1) => AIR.puff(1 + Math.min(n, 24) * 0.02), // each new player a little brighter
  start: () => AIR.gust(0.9),
  rule: () => AIR.breeze(),
  ready: () => AIR.breeze(1.4),
  round: () => AIR.gust(1.1),
  title: () => AIR.breeze(0.8),
  option: (i = 0) => AIR.swish(i % 2 ? -1 : 1),
  meal: () => AIR.swish(side(), 1.3),
  callout: () => AIR.puff(),
  discovery: () => AIR.gust(),
  bonusIntro: () => AIR.gust(1.25),
  tick: (s) => AIR.tick(s),
  line: (i = 0) => AIR.puff(1 + i * 0.06),
  next: () => AIR.swish(1, 0.8),
  back: () => AIR.swish(-1, 0.8),
  whoosh: (pan) => AIR.whoosh(typeof pan === 'number' ? Math.sign(pan) || 1 : side()),
};

const lastPick = {};
function pickVariant(name, arg) {
  const def = CUES[name] || LAYERS[name];
  const list = typeof def === 'function' ? def(arg) : def;
  if (!list || !list.length) return null;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick[name]) i = (i + 1) % list.length;
  lastPick[name] = i;
  return list[i];
}

let packs = null;
function players() {
  if (!packs && ctx) {
    packs = {};
    for (const p of ['glass', 'cinematic', 'arcade']) packs[p] = createUISFX({ pack: p, context: ctx, maxVoices: 6 });
    // Render every cue now, so the first play of each is instant.
    const want = {};
    for (const def of [...Object.values(CUES), ...Object.values(LAYERS)]) {
      const lists = typeof def === 'function' ? [def(0), def(1), def(2)] : [def];
      for (const l of lists) for (const [p, c] of l) (want[p] ||= new Set()).add(c);
    }
    for (const p in want) want[p] = [...want[p]];
    for (const p in want) packs[p].preload(want[p]).catch(() => {});
  }
  return packs;
}
function playCue(v) {
  if (!v) return false;
  const [pack, cue, volume, rate = 1] = v;
  try { return !!players()?.[pack]?.play(cue, { volume, playbackRate: rate * R(0.97, 1.03), retrigger: 'overlap' }); } catch { return false; }
}
let muted = false;
const buffers = {};

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    preload();
    players();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; if (packs) Object.values(packs).forEach((p) => p.setEnabled(!m)); }
export function isMuted() { return muted; }

// Optional recorded sounds: /sfx/manifest.json lists names, e.g. ["whoosh","pop"].
function preload() {
  if (globalThis.HE_IMG) return; // single-file preview: synth sounds only
  fetch('/sfx/manifest.json').then((r) => (r.ok ? r.json() : [])).catch(() => []).then((names) => (Array.isArray(names) ? names : [])).then((names) => names.forEach((name) => {
    fetch(`/sfx/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => b && ctx.decodeAudioData(b)).then((buf) => { if (buf) buffers[name] = buf; }).catch(() => {});
  }));
}

function playBuffer(name, gain = 1) {
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start();
  return true;
}

function noise(dur) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function tone(freq, t, dur, { type = 'sine', gain = 0.25, attack = 0.005, bend = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// A soft mallet: sine plus a quiet octave partial, fast decay.
function mallet(freq, t, gain = 0.22, dur = 0.6) {
  tone(freq, t, dur, { gain });
  tone(freq * 2, t, dur * 0.35, { gain: gain * 0.25 });
  tone(freq * 4.01, t, dur * 0.12, { gain: gain * 0.08 });
}

const synth = {
  whoosh(pan = 0.6) {
    const t = ctx.currentTime;
    const src = noise(0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    let node = src.connect(bp).connect(g);
    if (p) { p.pan.setValueAtTime(-pan, t); p.pan.linearRampToValueAtTime(pan, t + 0.45); node = node.connect(p); }
    node.connect(master);
    src.start(t);
  },
  pop() {
    const t = ctx.currentTime;
    tone(520, t, 0.12, { type: 'sine', gain: 0.3, bend: 1.9 });
    mallet(1040, t + 0.03, 0.08, 0.2);
  },
  tick() { mallet(1760, ctx.currentTime, 0.07, 0.08); },
  // Rising noise sweep: tension right before an answer is shown.
  riser(dur = 1.1) {
    const t = ctx.currentTime;
    const src = noise(dur + 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
  },
  // A soft, deep hit when the answer lands.
  impact() {
    const t = ctx.currentTime;
    tone(80, t, 0.7, { type: 'sine', gain: 0.4, bend: 0.5, attack: 0.005 });
    const src = noise(0.25);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(lp).connect(g).connect(master); src.start(t);
  },
  lock() { const t = ctx.currentTime; mallet(880, t, 0.12, 0.15); mallet(1320, t + 0.06, 0.1, 0.2); },
  reveal() {
    const t = ctx.currentTime;
    const src = noise(0.9);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(400, t);
    hp.frequency.exponentialRampToValueAtTime(3000, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.75);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    src.connect(hp).connect(g).connect(master);
    src.start(t);
  },
  correct() {
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => mallet(f, t + i * 0.07, 0.18, 0.9));
  },
  wrong() {
    const t = ctx.currentTime;
    tone(196, t, 0.35, { type: 'triangle', gain: 0.18, bend: 0.8 });
  },
  sting() {
    const t = ctx.currentTime;
    [392, 523.25, 659.25].forEach((f, i) => mallet(f, t + i * 0.09, 0.2, 1.1));
    tone(98, t, 0.6, { type: 'sine', gain: 0.25 });
  },
  drumroll(dur = 1.6) {
    const t = ctx.currentTime;
    for (let i = 0; i < dur * 22; i++) {
      const s = noise(0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
      const g = ctx.createGain();
      const at = t + i / 22;
      const v = 0.05 + 0.18 * (i / (dur * 22));
      g.gain.setValueAtTime(v, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
      s.connect(bp).connect(g).connect(master);
      s.start(at);
    }
  },
  fanfare() {
    const t = ctx.currentTime;
    const seq = [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.38], [783.99, 0.56], [1046.5, 0.68]];
    seq.forEach(([f, d]) => { mallet(f, t + d, 0.2, 0.8); tone(f / 2, t + d, 0.4, { type: 'triangle', gain: 0.06 }); });
    tone(130.8, t + 0.38, 1.2, { gain: 0.2 });
  },
};

export const sfxListeners = [];
export function sfx(name, arg) {
  if (!ctx || muted) return;
  sfxListeners.forEach((f) => f(name));
  if (ctx.state === 'suspended') ctx.resume();
  try {
    if (buffers[name]) return playBuffer(name);
    if (AIRED[name]) return AIRED[name](arg);
    if (CUES[name] && playCue(pickVariant(name, arg))) return;
    if (LAYERS[name]) playCue(pickVariant(name, arg));
    synth[name] && synth[name](arg);
  } catch {}
}
