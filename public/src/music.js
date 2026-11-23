// Background music for the big screen. One track per part of the show:
//   lobby, howto, round1, round2, round3, bonus, winners
// Files live in /music/<slot>.mp3. They are pre-cut so each loops with no
// seam (the tail is blended into the head) and levelled to the same loudness.
// Playback uses Web Audio so loops are gapless; parts crossfade, and the
// whole mix follows Pause and Mute. A missing file just means silence there.

const SLOTS = ['lobby', 'howto', 'round1', 'round2', 'round3', 'bonus', 'winners'];
const VOLUME = 0.55;
const FADE = 4; // seconds: long, smooth fades in and out

// Equal-power curves so a crossfade never dips or bumps in loudness.
const curve = (from, to) => Float32Array.from({ length: 64 }, (_, i) => {
  const t = i / 63;
  return from + (to - from) * (to > from ? Math.sin((t * Math.PI) / 2) : 1 - Math.cos((t * Math.PI) / 2));
});
const base = () => globalThis.HE_MUSIC_BASE ?? (globalThis.HE_IMG ? null : '/music/');

let ctx = null, out = null, duck = null;
const bufs = {};
let cur = null;      // { slot, src, gain }
let wanted = null;   // latest slot asked for
let muted = false, held = false;

function ensure() {
  if (ctx || !base()) return !!ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  out = ctx.createGain();
  duck = ctx.createGain();
  duck.connect(out);
  out.connect(ctx.destination);
  return true;
}

function load(slot) {
  if (!(slot in bufs)) {
    bufs[slot] = fetch(`${base()}${slot}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)) : null))
      .catch(() => null);
  }
  return bufs[slot];
}

export function preloadMusic() { if (ensure()) SLOTS.forEach(load); }

// --- Transitions, the way a DJ mixes ---------------------------------------
// Two full tracks overlapping for seconds sounds muddy: two basslines and two
// drum grooves at different tempos fight. So the outgoing track is low-passed
// (it sinks away, losing its highs and its groove) while the incoming track
// enters high-passed (bright and light, no bass) and its low end blooms in
// only as the old one is gone. Volume follows equal-power curves.
export const MIX = { FADE, volume: VOLUME, out: FADE * 1.1, inDelay: 0.35, lpEnd: 220, hpStart: 520 };

export function fadeOutVoice(ctx, v, at = ctx.currentTime, ms = MIX.out) {
  const g = v.gain.gain, f = v.lp.frequency, gv = at > ctx.currentTime ? MIX.volume : g.value;
  g.cancelScheduledValues(at); f.cancelScheduledValues(at);
  f.setValueAtTime(20000, at);
  f.exponentialRampToValueAtTime(MIX.lpEnd, at + ms);
  try { g.setValueCurveAtTime(curve(gv, 0), at, ms); } catch { g.setValueAtTime(gv, at); g.linearRampToValueAtTime(0, at + ms); }
  try { v.src.stop(at + ms + 0.05); } catch {}
}

export function startVoice(ctx, dest, buf, { loop = true, at = ctx.currentTime, fade = MIX.FADE, volume = VOLUME } = {}) {
  const src = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const lp = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buf; src.loop = loop;
  hp.type = 'highpass'; hp.Q.value = 0.5;
  hp.frequency.setValueAtTime(MIX.hpStart, at);
  hp.frequency.exponentialRampToValueAtTime(20, at + fade * 1.15);
  lp.type = 'lowpass'; lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(20000, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.setValueCurveAtTime(curve(0, volume), at, fade);
  if (!loop) gain.gain.setValueCurveAtTime(curve(volume, 0), Math.max(at + fade + 0.1, at + buf.duration - fade), fade);
  src.connect(hp).connect(lp).connect(gain).connect(dest);
  src.start(at);
  return { src, hp, lp, gain };
}

export async function playMusic(slot) {
  if (!ensure() || !SLOTS.includes(slot)) return;
  if (wanted === slot) return;
  wanted = slot;
  if (cur) { fadeOutVoice(ctx, cur); cur = null; }
  const buf = await load(slot);
  if (!buf || wanted !== slot) return;
  cur = { slot, ...startVoice(ctx, duck, buf, { loop: slot !== 'winners', at: ctx.currentTime + MIX.inDelay }) };
}

// Sidechain: sound effects push the music down for a moment so they read
// clearly, then the music swells back.
const DUCK = { sting: [0.45, 1.4], reveal: [0.5, 1.2], correct: [0.5, 1.2], wrong: [0.55, 1.0], fanfare: [0.4, 2.2], drumroll: [0.55, 1.8], lock: [0.75, 0.5] };
export function duckMusic(name) {
  const d = DUCK[name];
  if (!d || !duck) return;
  const [depth, release] = d, t = ctx.currentTime, g = duck.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(depth, t + 0.06);
  g.setTargetAtTime(1, t + 0.25, release / 3);
}

// Browsers only allow sound after a click or key press.
export function unlockMusic() { if (ctx && !held && ctx.state === 'suspended') ctx.resume(); }

export function holdMusic(on) {
  held = on;
  if (!ctx) return;
  if (on) ctx.suspend(); else ctx.resume();
}

export function muteMusic(on) {
  muted = on;
  if (!out) return;
  const t = ctx.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(out.gain.value, t);
  out.gain.linearRampToValueAtTime(on ? 0 : 1, t + 0.3);
}
