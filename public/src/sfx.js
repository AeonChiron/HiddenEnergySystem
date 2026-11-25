// Short game sound effects, synthesized with Web Audio so the site works
// offline with no audio files. Replaceable later with recorded sounds:
// put files in /sfx/<name>.mp3 and they are used instead.

let ctx = null;
let master = null;
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
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
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
    tone(110, t, dur, { type: 'sawtooth', gain: 0.03, bend: 2, attack: dur * 0.9 });
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
    synth[name] && synth[name](arg);
  } catch {}
}
