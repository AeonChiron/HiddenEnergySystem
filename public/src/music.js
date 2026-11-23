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

let ctx = null, out = null;
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

export async function playMusic(slot) {
  if (!ensure() || !SLOTS.includes(slot)) return;
  if (wanted === slot) return;
  wanted = slot;
  const now = ctx.currentTime;
  if (cur) {
    const old = cur; cur = null;
    const g = old.gain.gain, v = g.value;
    g.cancelScheduledValues(now);
    try { g.setValueCurveAtTime(curve(v, 0), now, FADE); } catch { g.setValueAtTime(v, now); g.linearRampToValueAtTime(0, now + FADE); }
    try { old.src.stop(now + FADE + 0.05); } catch {}
  }
  const buf = await load(slot);
  if (!buf || wanted !== slot) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime;
  src.buffer = buf;
  src.loop = slot !== 'winners';
  if (!src.loop) { // the winners track ends with its own long fade
    const end = t0 + buf.duration;
    gain.gain.setValueCurveAtTime(curve(VOLUME, 0), Math.max(t0 + FADE + 0.1, end - FADE), FADE);
  }
  gain.gain.setValueCurveAtTime(curve(0, VOLUME), t0, FADE);
  src.connect(gain).connect(out);
  src.start(t0);
  cur = { slot, src, gain };
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
