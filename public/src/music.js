// Background music for the big screen. One track per part of the show:
//   lobby, howto, round1, round2, round3, bonus, winners
// Drop MP3s in /music/<slot>.mp3. A missing file just means silence there.
// Tracks crossfade when the show moves on, and follow Pause and Mute.

const SLOTS = ['lobby', 'howto', 'round1', 'round2', 'round3', 'bonus', 'winners'];
const VOLUME = 0.45;
const FADE_MS = 1400;
const base = () => globalThis.HE_MUSIC_BASE ?? (globalThis.HE_IMG ? null : '/music/');

const tracks = {};
let current = null;
let muted = false;
let held = false;
let wanted = null; // slot asked for before the browser allowed sound

function track(slot) {
  if (!base() || !SLOTS.includes(slot)) return null;
  if (!tracks[slot]) {
    const a = new Audio(`${base()}${slot}.mp3`);
    a.loop = slot !== 'winners';
    a.preload = 'auto';
    a.volume = 0;
    a.addEventListener('error', () => { a.dead = true; });
    tracks[slot] = a;
  }
  return tracks[slot].dead ? null : tracks[slot];
}

function fade(a, to, ms, done) {
  const from = a.volume, t0 = performance.now();
  clearInterval(a.fader);
  a.fader = setInterval(() => {
    const t = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t >= 1) { clearInterval(a.fader); done && done(); }
  }, 40);
}

export function playMusic(slot) {
  if (current && current.slot === slot) return;
  const prev = current;
  if (prev) fade(prev.a, 0, FADE_MS, () => prev.a.pause());
  const a = track(slot);
  current = a ? { slot, a } : null;
  if (!a) return;
  a.currentTime = 0;
  if (held) return;
  a.play().then(() => fade(a, muted ? 0 : VOLUME, FADE_MS)).catch(() => { wanted = slot; });
}

// Call from a click/keypress: browsers only allow sound after one.
export function unlockMusic() {
  if (wanted && current && current.slot === wanted && !held) {
    wanted = null;
    current.a.play().then(() => fade(current.a, muted ? 0 : VOLUME, FADE_MS)).catch(() => {});
  }
}

export function holdMusic(on) {
  held = on;
  if (!current) return;
  if (on) current.a.pause();
  else current.a.play().then(() => fade(current.a, muted ? 0 : VOLUME, 400)).catch(() => {});
}

export function muteMusic(on) {
  muted = on;
  if (current) fade(current.a, on ? 0 : VOLUME, 300);
}

// Preload every slot so changes are instant.
export function preloadMusic() { SLOTS.forEach(track); }
