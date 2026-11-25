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

// A track that fails to download (a slow server waking up) is tried again,
// up to 4 times, and a failure is never remembered, so the next call retries.
function fetchTrack(slot, tries = 4) {
  return fetch(`${base()}${slot}.mp3`)
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
    .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
    .catch((e) => (tries > 1 ? new Promise((res) => setTimeout(res, 1500)).then(() => fetchTrack(slot, tries - 1)) : Promise.reject(e)));
}
function load(slot) {
  if (!(slot in bufs)) {
    bufs[slot] = fetchTrack(slot).catch(() => { delete bufs[slot]; return null; });
  }
  return bufs[slot];
}

export function preloadMusic() { if (ensure()) { SLOTS.forEach(load); loadGrid(); } }

// --- Transitions, the way a DJ mixes ---------------------------------------
// Two full tracks overlapping for seconds sounds muddy: two basslines and two
// drum grooves at different tempos fight. So the outgoing track is low-passed
// (it sinks away, losing its highs and its groove) while the incoming track
// enters high-passed (bright and light, no bass) and its low end blooms in
// only as the old one is gone. Volume follows equal-power curves.
export const MIX = { FADE, volume: VOLUME, out: FADE * 1.1, inDelay: 0.35, lpEnd: 220, hpStart: 520 };

export function fadeOutVoice(ctx, v, at = ctx.currentTime, ms = MIX.out) {
  const g = v.gain.gain, f = v.lp.frequency, gv = at > ctx.currentTime ? MIX.volume : g.value;
  if (g.cancelAndHoldAtTime) { g.cancelAndHoldAtTime(at); f.cancelAndHoldAtTime(at); } else { g.cancelScheduledValues(at); f.cancelScheduledValues(at); }
  f.setValueAtTime(20000, at);
  f.exponentialRampToValueAtTime(MIX.lpEnd, at + ms);
  try { g.setValueCurveAtTime(curve(gv, 0), at, ms); } catch { g.setValueAtTime(gv, at); g.linearRampToValueAtTime(0, at + ms); }
  try { v.src.stop(at + ms + 0.05); } catch {}
}

export function startVoice(ctx, dest, buf, { loop = true, at = ctx.currentTime, fade = MIX.FADE, volume = VOLUME, offset = 0 } = {}) {
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
  src.start(at, offset);
  return { src, hp, lp, gain };
}

// --- Changing tracks on the beat ---------------------------------------------
// The way game composers handle a cue that can come at any moment (Wwise and
// FMOD call it horizontal re-sequencing): never cut where the click lands.
// Wait for the outgoing track's next beat, let the new track's own pickup run
// up to that beat so its first downbeat lands exactly there, and let the old
// track echo out in tempo instead of stopping. A soft swell rises into the
// switch and hides the seam. beats.json holds every track's beat times.
let grid = null;
const loadGrid = () => grid || (grid = fetch(`${base()}beats.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

const PREROLL = 0.8; // seconds of the new track's pickup allowed before the switch
const SWAP = 1.8;    // seconds for the new track to open fully after the beat
const CUT = 1.2;     // the old track drops out faster; its echo carries the tail

function nextBeat(g, pos, after) {
  // first beat at least `after` seconds past `pos` in a looping track
  const b = g.beats;
  for (let lap = 0; lap < 3; lap++) {
    for (const t of b) { const tt = t + lap * g.dur; if (tt - pos >= after) return tt - pos; }
  }
  return after;
}

function swell(ctx, dest, at, len) {
  // filtered noise that rises into the switch and falls just after it
  const n = Math.ceil(ctx.sampleRate * (len + 1.2));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(400, at - len);
  bp.frequency.exponentialRampToValueAtTime(5000, at);
  bp.frequency.exponentialRampToValueAtTime(1200, at + 1.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at - len);
  g.gain.exponentialRampToValueAtTime(0.05, at - 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
  src.connect(bp).connect(g).connect(dest);
  src.start(at - len); src.stop(at + 1.25);
}

function echoOut(ctx, dest, v, at, beat) {
  // the old track's last beat repeats in tempo, darker each time, and fades
  const send = ctx.createGain(), dl = ctx.createDelay(2), fb = ctx.createGain(), tone = ctx.createBiquadFilter();
  send.gain.value = 0;
  send.gain.setValueAtTime(0, at);
  send.gain.linearRampToValueAtTime(0.4, at + 0.05);
  send.gain.setValueAtTime(0.4, at + beat);
  send.gain.linearRampToValueAtTime(0, at + beat * 2);
  dl.delayTime.value = Math.min(1.9, beat);
  fb.gain.value = 0.35;
  tone.type = 'lowpass'; tone.frequency.value = 2600;
  v.lp.connect(send).connect(dl).connect(tone).connect(fb).connect(dl);
  tone.connect(dest);
  if (typeof setTimeout === 'function' && !(ctx instanceof OfflineAudioContext)) setTimeout(() => { try { send.disconnect(); dl.disconnect(); fb.disconnect(); tone.disconnect(); } catch {} }, (at - ctx.currentTime + 12) * 1000);
}

// Resolves with the seconds until the new track's first downbeat lands, so
// the picture can hit that moment (0 when there is no music).
export async function playMusic(slot) {
  if (!ensure() || !SLOTS.includes(slot)) return 0;
  if (wanted === slot) return 0;
  wanted = slot;
  const [buf, g] = await Promise.all([load(slot), loadGrid()]);
  if (wanted !== slot) return 0;
  const old = cur;
  cur = null;
  const now = ctx.currentTime;
  const gin = g[slot], gout = old && g[old.slot];
  const loop = slot !== 'winners';
  if (!buf) {
    // Still no file: keep the old song going and try this one again shortly.
    cur = old; wanted = null;
    setTimeout(() => { if (wanted === null) playMusic(slot); }, 4000);
    return 0;
  }
  if (!old || !gout || !gin || !gin.beats.length || ctx.state !== 'running') {
    if (old) fadeOutVoice(ctx, old);
    const at = now + MIX.inDelay;
    cur = { slot, startAt: at, ...startVoice(ctx, duck, buf, { loop, at }) };
    return ctx.state === 'running' ? Math.max(0, at + (gin?.beats?.[0] || 0) - ctx.currentTime) : 0;
  }
  cur = crossTo(ctx, duck, old, slot, buf, gin, gout, now, loop);
  return Math.max(0, cur.T - ctx.currentTime);
}

// Beat-matched change from voice `old` (playing track gout) to `buf` (track gin).
export function crossTo(ctx, dest, old, slot, buf, gin, gout, now = ctx.currentTime, loop = true) {
  // when the new track's first downbeat should land
  const pickup = Math.min(PREROLL, gin.beats[0]);
  const pos = (((now - old.startAt) % gout.dur) + gout.dur) % gout.dur;
  const T = now + nextBeat(gout, pos, pickup + 0.12);
  const offset = gin.beats[0] - pickup;
  const start = T - pickup;
  const beat = gout.beats.length > 1 ? gout.beats[1] - gout.beats[0] : 0.5;
  // Keep the total level steady: the old track eases down a little while the
  // new pickup comes in thin and quiet, then they swap on the beat with
  // equal-power curves, and the new bass only blooms once the old one is gone.
  const og = old.gain.gain;
  if (og.cancelAndHoldAtTime) og.cancelAndHoldAtTime(now); else og.cancelScheduledValues(now);
  og.setValueAtTime(VOLUME, now);
  og.linearRampToValueAtTime(VOLUME * 0.8, T);
  const f = old.lp.frequency;
  if (f.cancelAndHoldAtTime) f.cancelAndHoldAtTime(now); else f.cancelScheduledValues(now);
  f.setValueAtTime(20000, T);
  f.exponentialRampToValueAtTime(MIX.lpEnd, T + CUT);
  try { og.setValueCurveAtTime(curve(VOLUME * 0.8, 0), T, CUT); } catch { og.linearRampToValueAtTime(0, T + CUT); }
  try { old.src.stop(T + CUT + 0.05); } catch {}
  echoOut(ctx, dest, old, T, beat);
  swell(ctx, dest, T, Math.max(0.6, T - now - 0.05));
  if (!loop) {
    // A one-shot finish (the winners' fanfare) hits at full strength on the beat.
    const at = T - gin.beats[0];
    const v = startVoice(ctx, dest, buf, { loop, at, fade: 0.1, offset: 0 });
    v.gain.gain.cancelScheduledValues(at);
    v.gain.gain.setValueAtTime(0, at);
    v.gain.gain.linearRampToValueAtTime(VOLUME, at + 0.02);
    v.gain.gain.setValueAtTime(VOLUME, Math.max(at + 0.03, at + buf.duration - MIX.FADE));
    v.gain.gain.linearRampToValueAtTime(0, at + buf.duration);
    v.hp.frequency.cancelScheduledValues(at); v.hp.frequency.setValueAtTime(20, at);
    return { slot, startAt: at, T, ...v };
  }
  const v = startVoice(ctx, dest, buf, { loop, at: start, fade: 0.1, offset });
  const ng = v.gain.gain, hp = v.hp.frequency;
  ng.cancelScheduledValues(start); hp.cancelScheduledValues(start);
  ng.setValueAtTime(0, start);
  ng.linearRampToValueAtTime(VOLUME * 0.22, T);
  try { ng.setValueCurveAtTime(curve(VOLUME * 0.22, VOLUME), T, SWAP * 0.85); } catch { ng.linearRampToValueAtTime(VOLUME, T + SWAP * 0.85); }
  hp.setValueAtTime(MIX.hpStart, start);
  hp.setValueAtTime(MIX.hpStart, T + 0.15);
  hp.exponentialRampToValueAtTime(20, T + SWAP + 0.3);
  return { slot, startAt: start - offset, T, ...v };
}

// Sidechain: sound effects push the music down for a moment so they read
// clearly, then the music swells back.
const DUCK = { riser: [0.6, 1.6], impact: [0.45, 1.3], sting: [0.45, 1.4], reveal: [0.5, 1.2], correct: [0.5, 1.2], wrong: [0.55, 1.0], fanfare: [0.4, 2.2], drumroll: [0.55, 1.8], lock: [0.75, 0.5] };
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
export const musicLocked = () => !!ctx && ctx.state === 'suspended';
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
