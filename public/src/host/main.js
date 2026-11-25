// Host / presentation screen. Walks the show step by step, drives the camera
// across the whiteboard and talks to the server. The look lives in host.css
// and the art registry; this file is only timing and logic.

import { connect as wsConnect } from '../net.js';
import { Camera } from './camera.js';
import { buildWorld, zoneEl, HOWTO_BEATS } from './world.js';
import { sfx, unlockAudio, setMuted, isMuted, sfxListeners } from '../sfx.js';
import { confetti } from './confetti.js';
import { clock } from './clock.js';
import { playMusic, unlockMusic, musicLocked, holdMusic, muteMusic, preloadMusic, duckMusic } from '../music.js';
import qrcode from '../../vendor/qrcode.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const pad2 = (n) => String(n).padStart(2, '0');
// Seed's short link to the site, shown wherever players are told where to go.
// The QR code and shared links still open the game directly, code included.
const SHORT_LINK = 'tinyurl.com/heritagenutritionquiz';

export function mountHost(root, opts = {}) {
  const params = new URLSearchParams(location.search);
  const SPEED = Number(params.get('speed')) || opts.speed || 1;
  // Every hold in the show can be cut short with Space or Next (Seed: Next is always there).
  const hold = (realMs) => new Promise((res) => {
    let done = false;
    const fin = () => { if (done) return; done = true; if (waiters.skip === fin) waiters.skip = null; res(); };
    waiters.skip = fin;
    clock.sleep(realMs).then(fin);
  });
  const wait = (ms) => hold(ms / SPEED);
  // How long each answer's cutscene holds on screen (Seed: about 12 seconds).
  // Answer close-ups (Seed, Nov 23): A holds 10 s, B and C 8 s. ?cut= overrides for tests.
  const CUT_FIXED = Number(params.get('cut')) || opts.cutMs || 0;

  // classroom: this screen is the projector. online: it runs unseen inside the creator's phone.
  const MODE = opts.mode || (params.get('mode') === 'online' ? 'online' : 'classroom');

  root.classList.add('he-host');
  root.innerHTML = `
    <div class="viewport" id="viewport"><div class="world" id="world"></div></div>
    <div class="hud" id="hud">
      <div class="hud-tl"><span class="hud-round"></span><span class="hud-q"></span></div>
      <div class="hud-timer" hidden><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52"/></svg><b>20</b><small>s</small></div>
      <div class="hud-answers" hidden><b>0</b><span>/ 0 answered</span></div>
      <div class="hud-join" hidden></div>
      <button class="hud-next" hidden><span>Next</span><kbd>Space</kbd><i class="auto"></i></button>
      <div class="hud-tools">
        <button class="tool" data-tool="mute" title="Mute (M)">Sound on</button>
        <button class="tool" data-tool="fs" title="Fullscreen (F)">Fullscreen</button>
        ${opts.connect ? '' : '<button class="tool" data-tool="back" title="Back one step (Left arrow)">Back</button>'}
        <button class="tool" data-tool="pause" title="Pause (P)">Pause</button>
        <button class="tool" data-tool="board" title="See the whole board (test mode)">Whole board</button>
        <button class="tool" data-tool="restart" title="Start over from the lobby">Restart</button>
      </div>
      <div class="hud-status" role="status"></div>
    </div>
    <canvas class="confetti" id="confetti"></canvas>`;

  // A picture that fails (a slow server waking up) tries again, up to 4 times.
  root.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !/\/img\//.test(img.src)) return;
    const n = Number(img.dataset.retry || 0);
    if (n >= 4) return;
    img.dataset.retry = n + 1;
    setTimeout(() => { img.src = `${img.src.split('?')[0]}?r=${n + 1}`; }, 800 * (n + 1));
  }, true);

  const S = {
    code: null, key: null, content: null, zones: null,
    players: [], step: 0, results: {}, standings: null,
    open: null, deadline: 0, progress: { answered: 0, total: 0 },
    started: false, running: false,
  };
  const waiters = { results: new Map(), standings: null, opened: new Map(), next: null, start: null, skip: null };

  // ---------- session ----------
  const ss = {
    get() { try { return JSON.parse(sessionStorage.getItem('he:host') || 'null'); } catch { return null; } },
    set(v) { try { sessionStorage.setItem('he:host', JSON.stringify(v)); } catch {} },
    clear() { try { sessionStorage.removeItem('he:host'); } catch {} },
  };

  const net = (opts.connect || wsConnect)({
    onOpen() {
      const saved = ss.get();
      if (S.code && S.key) net.send({ t: 'host:resume', code: S.code, key: S.key });
      else if (saved && !params.has('new') && !opts.fresh) net.send({ t: 'host:resume', code: saved.code, key: saved.key });
      else net.send({ t: 'host:create', mode: MODE });
    },
    onMessage,
    onStatus(s) {
      const el = $('.hud-status', root);
      el.textContent = s === 'online' ? '' : 'Reconnecting to the game server…';
      el.classList.toggle('show', s !== 'online');
    },
  });

  function onMessage(m) {
    switch (m.t) {
      case 'host:ok': {
        const fresh = !S.content || S.code !== m.code || m.step === 0;
        S.code = m.code; S.key = m.key; S.results = m.results || {};
        ss.set({ code: m.code, key: m.key });
        if (m.open) { S.open = { n: m.open.n, total: m.open.total }; S.deadline = clock.now() + m.open.remaining; }
        if (!S.content) {
          S.content = m.content;
          S.zones = buildWorld($('#world', root), m.content);
          cam.set(cam.frame(S.zones.lobby, 0));
          setupJoin();
          if (params.has('bots') || opts.previewBots) net.send({ t: 'host:bots', n: Number(params.get('bots')) || opts.previewBots || 8 });
        }
        const from = params.has('from') ? Number(params.get('from')) : opts.from || 0;
        // After Back (or any reload of this screen) pick the show up where the game is.
        const resumed = !params.has('new') && !opts.fresh && m.step > 0;
        let auto = false;
        try { auto = sessionStorage.getItem('he:auto') === '1'; sessionStorage.removeItem('he:auto'); } catch {}
        if (!S.running) startShow(resumed ? m.step : fresh ? from : m.step, auto || MODE === 'online');
        break;
      }
      case 'host:rewound': {
        try { sessionStorage.setItem('he:auto', '1'); } catch {}
        // Reload into the same game (drop ?new, which would start a fresh one).
        const q = new URLSearchParams(location.search); ['new', 'from', 'bots'].forEach((k) => q.delete(k));
        location.replace(location.pathname + (q.toString() ? `?${q}` : ''));
        break;
      }
      case 'host:gone': ss.clear(); net.send({ t: 'host:create', mode: MODE }); break;
      case 'host:replaced': showStatus('This game is now open on another screen.'); break;
      case 'players': updatePlayers(m.list, m.newId); break;
      case 'timer': S.deadline = clock.now() + m.remaining; break;
      case 'opened': {
        S.open = { n: m.n, total: m.total };
        S.deadline = clock.now() + m.remaining;
        const w = waiters.opened.get(m.n); if (w) { waiters.opened.delete(m.n); w(); }
        break;
      }
      case 'progress': S.progress = { answered: m.answered, total: m.total }; renderProgress(); break;
      case 'results': {
        S.results[m.n] = m; S.open = null;
        const w = waiters.results.get(m.n); if (w) { waiters.results.delete(m.n); w(m); }
        break;
      }
      case 'standings': {
        S.standings = m.list;
        if (waiters.standings) { const w = waiters.standings; waiters.standings = null; w(m.list); }
        break;
      }
      default: break;
    }
  }

  function showStatus(text) {
    const el = $('.hud-status', root);
    el.textContent = text; el.classList.add('show');
  }

  // ---------- camera ----------
  // The HUD is laid out at 1920x1080 and scaled onto the stage with the camera.
  const cam = new Camera($('#viewport', root), $('#world', root), {
    speed: SPEED,
    onFit: (fit, box) => {
      const h = $('#hud', root);
      root.style.setProperty('--fit', fit);
      h.style.transform = `translate(${box.left}px, ${box.top}px) scale(${fit})`;
    },
  });
  const Z = (id) => S.zones[id];
  const frameOf = (id, margin) => cam.frame(Z(id), margin);

  // Only the zone on screen runs its animations.
  function live(id) {
    root.querySelectorAll('.zone.live').forEach((z) => z.classList.remove('live'));
    const el = zoneEl(id, root);
    if (el) el.classList.add('live');
    return el;
  }

  // ---------- join info ----------
  async function setupJoin() {
    let base = opts.joinBase || location.origin;
    try {
      if (!opts.joinBase) {
        const info = await fetch('/api/info').then((r) => r.json());
        if (info.publicUrl) base = info.publicUrl.replace(/\/$/, '');
        else if (/^(localhost|127\.|\[::1\])/.test(location.hostname) && info.lan?.length) base = `http://${info.lan[0]}:${location.port || 80}`;
      }
    } catch {}
    const url = `${base}/join/${S.code}`;
    const shown = url.replace(/^https?:\/\//, '');
    const easy = opts.joinBase ? shown.replace(/\/join\/\d+$/, '/join') : SHORT_LINK;
    $('#join-url', root).textContent = easy;
    $('#join-code', root).textContent = S.code;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('#qr', root).innerHTML = qr.createSvgTag({ cellSize: 8, margin: 3, scalable: true });
    const j = $('.hud-join', root);
    j.innerHTML = `Join at <b>${esc(easy)}</b> · code <b>${S.code}</b>`;
  }

  // ---------- lobby players ----------
  function updatePlayers(list, newId) {
    const had = new Set(S.players.map((p) => p.id));
    S.players = list;
    const ul = $('#names', root);
    if (!ul) return;
    const ids = new Set(list.map((p) => p.id));
    ul.querySelectorAll('li').forEach((li) => { if (!ids.has(li.dataset.id)) li.remove(); });
    for (const p of list) {
      let li = ul.querySelector(`li[data-id="${p.id}"]`);
      if (!li) {
        li = document.createElement('li');
        li.dataset.id = p.id;
        li.innerHTML = `<i style="--c:${p.color}"></i><span>${esc(p.name)}</span>`;
        li.title = 'Click to remove this player';
        li.addEventListener('click', () => { if (confirm(`Remove ${p.name} from the game?`)) net.send({ t: 'host:kick', id: p.id }); });
        ul.appendChild(li);
        if (!had.has(p.id) && S.started === false) { li.classList.add('enter'); if (newId === p.id) sfx('pop'); }
      }
      li.classList.toggle('away', !p.connected);
    }
    const n = list.length;
    $('#waiting', root).textContent = n === 0 ? 'Waiting for players...' : `${n} player${n === 1 ? '' : 's'} ready`;
    fitRoster(ul);
    renderProgress();
  }

  // Names shrink as the room fills. If they still don't fit, the earliest
  // joiners fold into a "+N more" chip so the newest names stay in view.
  function fitRoster(ul) {
    const lis = [...ul.querySelectorAll('li:not(.more)')];
    const n = lis.length;
    ul.dataset.size = n > 18 ? 's' : n > 9 ? 'm' : '';
    ul.querySelector('li.more')?.remove();
    lis.forEach((li) => (li.hidden = false));
    if (ul.scrollHeight <= ul.clientHeight + 1) return;
    const more = document.createElement('li');
    more.className = 'more';
    ul.prepend(more);
    let hidden = 0;
    while (hidden < n - 1 && ul.scrollHeight > ul.clientHeight + 1) {
      lis[hidden++].hidden = true;
      more.textContent = `+${hidden} more`;
    }
  }

  // ---------- HUD ----------
  function hud({ round, q } = {}) {
    $('.hud-round', root).textContent = round || '';
    $('.hud-q', root).textContent = q || '';
    $('.hud-tl', root).classList.toggle('show', !!(round || q));
  }

  function renderProgress() {
    const el = $('.hud-answers', root);
    el.querySelector('b').textContent = S.progress.answered;
    el.querySelector('span').textContent = `/ ${S.progress.total} answered`;
  }

  let timerRaf = 0;
  function startTimer() {
    const box = $('.hud-timer', root);
    const arc = box.querySelector('.arc');
    const num = box.querySelector('b');
    const C = 2 * Math.PI * 52;
    arc.style.strokeDasharray = C;
    box.hidden = false; box.classList.remove('hurry');
    $('.hud-answers', root).hidden = false;
    let lastSec = null;
    const tick = () => {
      if (!S.open) return;
      const left = Math.max(0, S.deadline - clock.now());
      const f = left / S.open.total;
      arc.style.strokeDashoffset = C * (1 - f);
      const s = Math.ceil(left / 1000);
      if (s !== lastSec) {
        num.textContent = s;
        if (s <= 5 && s > 0) { sfx('tick'); box.classList.add('hurry'); }
        lastSec = s;
      }
      if (left > 0) timerRaf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(timerRaf);
    tick();
  }
  function stopTimer() {
    cancelAnimationFrame(timerRaf);
    $('.hud-timer', root).hidden = true;
    $('.hud-answers', root).hidden = true;
  }

  // ---------- waiting for the presenter ----------
  // Fully automatic by default: each pause advances on its own after autoMs.
  // Space / the button skip ahead. autoMs = 0 waits for the presenter.
  const AUTO = params.get('auto') !== '0' && opts.auto !== false;
  function waitNext(label = 'Next', autoMs = 0) {
    const btn = $('.hud-next', root);
    btn.querySelector('span').textContent = label;
    btn.hidden = false;
    btn.classList.remove('counting');
    let cancel = () => {};
    const ms = AUTO ? autoMs / SPEED : 0;
    if (ms > 0) { btn.style.setProperty('--t', `${ms}ms`); void btn.offsetWidth; btn.classList.add('counting'); }
    return new Promise((res) => {
      waiters.next = () => { cancel(); btn.classList.remove('counting'); btn.querySelector('span').textContent = 'Next'; btn.hidden = !S.started; waiters.next = null; res(); };
      if (ms > 0) cancel = clock.after(ms, () => waiters.next && waiters.next());
    });
  }
  // Next / Space: start, then whatever the show is waiting on. During the answer
  // timer it ends the question early.
  function advance() {
    unlockAudio(); unlockMusic();
    if (waiters.start) return waiters.start();
    if (waiters.next) return waiters.next();
    if (waiters.skip) return waiters.skip();
    if (S.open && !S.results[S.open.n]) net.send({ t: 'host:close' });
  }
  $('.hud-next', root).addEventListener('click', advance);

  preloadMusic();
  sfxListeners.push(duckMusic);
  // Browsers keep sound off until the first click or key press, so say so.
  if (musicLocked()) {
    const tip = document.createElement('div');
    tip.className = 'sound-tip';
    tip.textContent = 'Click anywhere to turn the sound on';
    root.appendChild(tip);
    const off = () => { tip.remove(); window.removeEventListener('pointerdown', off); window.removeEventListener('keydown', off); };
    window.addEventListener('pointerdown', off); window.addEventListener('keydown', off);
  }
  window.addEventListener('pointerdown', () => { unlockAudio(); unlockMusic(); });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      advance();
    }
    if (e.key === 'm' || e.key === 'M') toggleMute();
    if (e.key === 'f' || e.key === 'F') toggleFs();
    if (e.key === 'b' && !S.started) net.send({ t: 'host:bots', n: 8 });
  });
  root.querySelector('[data-tool="mute"]').addEventListener('click', toggleMute);
  root.querySelector('[data-tool="fs"]').addEventListener('click', toggleFs);
  // Pause (test mode): freezes the camera, holds, animations and the answer timer.
  function togglePause() {
    if (clock.paused) { clock.resume(); net.send({ t: 'host:unhold' }); } else { clock.pause(); net.send({ t: 'host:hold' }); }
    root.classList.toggle('paused', clock.paused);
    holdMusic(clock.paused);
    root.querySelector('[data-tool="pause"]').textContent = clock.paused ? 'Play' : 'Pause';
  }
  root.querySelector('[data-tool="pause"]').addEventListener('click', togglePause);
  window.addEventListener('keydown', (e) => { if ((e.key === 'p' || e.key === 'P') && !(e.target.closest && e.target.closest('input,textarea'))) togglePause(); });
  // Back: one step back in the show. Questions from there on are undone and play again.
  function goBack() {
    if (opts.connect || !S.started || S.step <= 1) return;
    const target = S.step - 1;
    if (clock.paused) togglePause();
    net.send({ t: 'host:back', step: target });
  }
  root.querySelector('[data-tool="back"]')?.addEventListener('click', goBack);
  window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' && !(e.target.closest && e.target.closest('input,textarea'))) goBack(); });
  // Restart: everyone keeps their seat, money and hints reset, back to the lobby.
  root.querySelector('[data-tool="restart"]').addEventListener('click', () => {
    if (!confirm('Restart the game? Everyone goes back to the lobby with $100,000.')) return;
    net.send({ t: 'host:restart' });
    setTimeout(() => location.reload(), 300);
  });
  // Whole board (test mode, to be removed in the final cut): the full tour in an overlay.
  root.querySelector('[data-tool="board"]').addEventListener('click', async () => {
    if (opts.onBoard) return opts.onBoard();
    const { mountTour } = await import('./tour.js');
    const wrap = document.createElement('div');
    wrap.className = 'board-overlay';
    document.body.appendChild(wrap);
    const t = mountTour(wrap, S.content, {
      onClose: () => { t.destroy(); wrap.remove(); },
      onPlay: (step) => { location.href = `${location.pathname}?new&bots=7&from=${step}`; },
    });
  });
  function toggleMute() { setMuted(!isMuted()); muteMusic(isMuted()); root.querySelector('[data-tool="mute"]').textContent = isMuted() ? 'Sound off' : 'Sound on'; }
  function toggleFs() { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen?.().catch(() => {}); }

  const stage = (step, st) => net.send({ t: 'host:stage', step, stage: st });

  function awaitResults(n) {
    if (S.results[n]) return Promise.resolve(S.results[n]);
    return new Promise((res) => waiters.results.set(n, res));
  }
  function awaitOpened(n) {
    if (S.open && S.open.n === n) return Promise.resolve();
    return new Promise((res) => waiters.opened.set(n, res));
  }
  function getStandings(round) {
    return new Promise((res) => { waiters.standings = res; net.send({ t: 'host:standings', round }); });
  }

  // ---------- the show ----------
  // Which song belongs at a given step, so "Play from here" or a resumed
  // show starts with the music that would be playing at that point.
  function songAt(steps, i) {
    for (let k = i; k >= 0; k--) {
      const s = steps[k];
      if (s.type === 'roundIntro') return `round${s.round}`;
      if (s.type === 'bonusIntro' || s.type === 'podium') return 'bonus';
      if (s.type === 'lobby' || s.type === 'howto') return 'lobby';
    }
    return 'lobby';
  }

  async function startShow(from, auto) {
    S.running = true;
    const steps = S.content.steps;
    if (from > 0) { S.started = true; $('.hud-next', root).hidden = false; }
    if (from > 0 && auto) playMusic(songAt(steps, from));
    else if (from > 0) {
      // Browsers only play sound after a click, and "Play from here" reloads
      // the page, so ask for one click before the show resumes.
      const gate = document.createElement('button');
      gate.className = 'start-btn play-gate';
      gate.textContent = '▶ Play from here';
      root.appendChild(gate);
      await new Promise((res) => {
        const go = () => { unlockAudio(); unlockMusic(); waiters.start = null; gate.remove(); res(); };
        waiters.start = go;
        gate.addEventListener('click', go);
      });
      playMusic(songAt(steps, from));
    }
    for (let i = from; i < steps.length; i++) {
      S.step = i;
      const s = steps[i];
      if (s.type === 'lobby') await lobby(i);
      else if (s.type === 'howto') await howto(i);
      else if (s.type === 'roundIntro') await roundIntro(i, s.round);
      else if (s.type === 'question') await question(i, s.n, i === from);
      else if (s.type === 'discovery') await discovery(i, s.round);
      else if (s.type === 'leaderboard') await leaderboard(i, s.round);
      else if (s.type === 'bonusIntro') await bonusIntro(i);
      else if (s.type === 'podium') await podium(i);
      else if (s.type === 'finale') await finale(i);
    }
  }

  const roundOf = (n) => S.content.questions.find((q) => q.n === n);
  const roundInfo = (id) => S.content.rounds.find((r) => r.id === id);

  async function lobby(step) {
    stage(step, { name: 'lobby' });
    playMusic('lobby');
    hud();
    $('.hud-join', root).hidden = true;
    const el = live('lobby');
    // Opening sequence: start close on the title, pull back to the lobby.
    const title = el.querySelector('.lobby-title');
    if (S.returning) { S.returning = false; cam.set(frameOf('lobby', 0)); el.classList.add('intro'); }
    else {
      cam.set({ ...frameOf('lobby', 0), z: frameOf('lobby', 0).z * 1.9, y: Z('lobby').y + title.offsetTop + title.offsetHeight / 2 });
      el.classList.add('intro');
      await wait(900);
      await cam.ease(frameOf('lobby', 0), 2200);
    }
    const startBtn = document.createElement('button');
    startBtn.className = 'start-btn';
    startBtn.innerHTML = 'Start the game';
    el.querySelector('.lobby-players').appendChild(startBtn);
    await new Promise((res) => {
      const go = () => { unlockAudio(); unlockMusic(); waiters.start = null; res(); };
      waiters.start = go;
      startBtn.addEventListener('click', go);
      if (S.startAsked) { S.startAsked = false; go(); }
    });
    startBtn.remove();
    S.started = true;
    $('.hud-next', root).hidden = false;
    sfx('sting');
  }

  // How to play: a short cutscene, one rule per beat. Each caption rolls in,
  // holds long enough to read, then rolls off as the camera moves on.
  async function howto(step) {
    stage(step, { name: 'howto', beat: -1 });
    playMusic('lobby'); // the lobby song carries on through the how-to
    hud({ round: 'How to play' });
    const el = live('howto');
    const beats = [...el.querySelectorAll('.beat')];
    // The whole demo fits in about 40 seconds (Seed: each rule 2-3 s longer).
    // Each beat gets a share of the time left, weighted by how much text it has to read.
    // Online (phones only, often solo): the rules are short, about 16 seconds.
    const TOTAL = (MODE === 'online' ? 16000 : 40000) / SPEED, MOVE = 1500 / SPEED;
    const t0 = clock.now();
    const chars = HOWTO_BEATS.map((b) => b.lines.join(' ').length);
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      if (i === 0) await cam.fly(frameOf('howto0', 0), 2200);
      else await cam.whoosh(frameOf(`howto${i}`, 0), 1450);
      b.classList.remove('off');
      b.classList.add('on');
      stage(step, { name: 'howto', beat: i }); // the phones show this rule now, not before
      sfx(i === beats.length - 1 ? 'sting' : 'pop');
      const left = TOTAL - (clock.now() - t0) - (beats.length - 1 - i) * MOVE;
      const share = chars[i] / chars.slice(i).reduce((x, y) => x + y, 0);
      const beatMs = Math.max((MODE === 'online' ? 3000 : 4900) / SPEED, left * share) * SPEED;
      const last = i === beats.length - 1;
      await waitNext(last ? 'Start round 1' : 'Next', beatMs);
      if (!last) { b.classList.add('off'); await wait(650); }
    }
  }


  async function roundIntro(step, r) {
    const info = roundInfo(r);
    stage(step, { name: 'roundIntro', round: r });
    playMusic(`round${r}`);
    hud(); // the round title fills the screen
    $('.hud-join', root).hidden = true;
    live(`round${r}`);
    sfx('riser', 0.9);
    await cam.fly(frameOf(`round${r}`, 0));
    sfx('impact');
    sfx('sting');
    await wait(7000);
  }

  async function question(step, n, resumed) {
    const q = roundOf(n);
    const info = q.round === 'bonus' ? null : roundInfo(q.round);
    hud({ round: info ? `Round ${q.round} · ${info.theme}` : 'Final bonus', q: q.round === 'bonus' ? 'Bonus question' : `Question ${pad2(n)} / 12` });
    const el = live(`q${n}`);
    const already = S.results[n];

    if (!already && !(S.open && S.open.n === n)) {
      stage(step, { name: 'watch', n, round: q.round });
      if (q.kind === 'mc') await mcCutscenes(step, q, el);
      else if (q.kind === 'binary') await foodIntro(step, q, el);
      else await bonusQuestionIntro(q, el);

      // The decision: everything visible, then the 20 seconds start.
      net.send({ t: 'host:open', n });
    } else {
      el.classList.add('overview', 'all-in');
      cam.set(overviewFrame(q));
    }
    if (!already) {
      await awaitOpened(n);
      el.classList.add('deciding');
      startTimer();
    }
    const res = await awaitResults(n);
    stopTimer();
    el.classList.remove('deciding');
    if (q.kind === 'mc') await mcReveal(q, el, res);
    else if (q.kind === 'binary') await foodReveal(q, el, res);
    else await bonusReveal(q, el, res);
    await waitNext(n === 13 ? 'To the winners' : 'Next', q.kind === 'binary' ? 7000 : n === 13 ? 11000 : 9000);
    el.classList.remove('live');
  }

  function overviewFrame(q) {
    if (q.kind === 'number') return frameOf(`q${q.n}`, 0);
    return frameOf(`q${q.n}`, 0.04);
  }

  async function mcCutscenes(step, q, el) {
    // Scene 1: question introduction.
    await cam.fly(frameOf(`q${q.n}title`, 0.1));
    el.classList.add('show-title');
    sfx('pop');
    await wait(8000); // Seed (Nov 24): the question holds exactly 8 seconds
    // Scenes 2-5: one mini cutscene per answer, always whooshing right.
    for (const { letter: L, text } of q.options.filter((o) => !o.all)) {
      stage(step, { name: 'watch', n: q.n, round: q.round, letter: L });
      const panel = el.querySelector(`.panel[data-letter="${L}"]`);
      sfx('whoosh');
      const t0 = clock.now();
      const move = L === 'A' ? cam.ease(frameOf(`q${q.n}${L}`, 0.07), 900) : cam.whoosh(frameOf(`q${q.n}${L}`, 0.07), 620);
      setTimeout(() => panel.classList.add('in', 'play'), 180 / SPEED);
      await move;
      // Seed (Nov 24): each option is on screen exactly 6 seconds, the camera move included.
      const holdMs = CUT_FIXED || 6000;
      await hold(Math.max(0, holdMs / SPEED - (clock.now() - t0)));
      panel.classList.remove('play');
    }
    // Scene 6: pull back to reveal everything, E underneath.
    stage(step, { name: 'watch', n: q.n, round: q.round });
    el.classList.add('overview');
    await cam.ease(frameOf(`q${q.n}`, 0.04), 1300);
    el.classList.add('all-in');
    await wait(300);
  }

  // The moment an answer lands: a hit, a little camera punch, and confetti when someone got it.
  function hype(res) {
    sfx('impact');
    const vp = $('#viewport', root);
    vp.classList.remove('punch'); void vp.offsetWidth; vp.classList.add('punch');
    if (res.correctCount > 0) confetti($('#confetti', root), { duration: 2600 / SPEED, count: 90 });
  }

  async function mcReveal(q, el, res) {
    sfx('riser');
    await wait(1100);
    el.classList.add('revealed');
    hype(res);
    // "All of the above" right: only D gets the ring; A to C are marked as part of it.
    const allL = q.options.find((o) => o.all)?.letter;
    const allRight = res.correct === allL;
    el.querySelectorAll('[data-letter]').forEach((p) => {
      const L = p.dataset.letter;
      const right = L === res.correct;
      const part = allRight && !right;
      p.classList.toggle('right', right);
      p.classList.toggle('part', part);
      p.classList.toggle('wrong', !right && !part);
      const c = p.querySelector('.count');
      if (c) c.textContent = res.counts[L] ?? 0;
    });
    sfx(res.correctCount > 0 ? 'correct' : 'wrong');
    await wait(2600);
    // The educational reveal below the question.
    const r = live(`r${q.n}`);
    el.classList.add('live');
    const stats = r.querySelector('.reveal-stats');
    stats.textContent = statsLine(res);
    await cam.fly(frameOf(`r${q.n}`, 0.04), 1500);
    r.classList.add('play');
  }

  function statsLine(res) {
    return res.answeredCount
      ? `${res.correctCount} of ${res.answeredCount} got it right${res.wonTotal ? ` · $${fmt(res.wonTotal)} won in bets` : ''}`
      : 'Nobody answered this one.';
  }

  async function foodIntro(step, q, el) {
    // Cinematic entrance: straight onto the meal, then pull back to the choice.
    // The ingredient callouts show here, before anyone votes.
    await cam.fly(frameOf(`q${q.n}plate`, 0.04));
    el.classList.add('enter');
    sfx('whoosh');
    await wait(1400);
    el.classList.add('named');
    sfx('pop');
    await wait(3100); // all three rings land first, then the High/Low choice comes in
    el.classList.add('overview');
    await cam.ease(frameOf(`q${q.n}`, 0.04), 1200);
    el.classList.add('all-in');
  }

  async function foodReveal(q, el, res) {
    sfx('riser');
    await wait(1100);
    el.classList.add('revealed');
    hype(res);
    el.querySelectorAll('.chip').forEach((c) => {
      const right = c.dataset.letter === res.correct;
      c.classList.toggle('right', right);
      c.classList.toggle('wrong', !right);
      c.querySelector('.count').textContent = res.counts[c.dataset.letter] ?? 0;
    });
    el.querySelector('.food-stats').textContent = statsLine(res);
    sfx(res.correctCount > 0 ? 'correct' : 'wrong');
    await wait(1400);
    el.classList.add('callouts-on');
  }

  async function bonusQuestionIntro(q, el) {
    await cam.fly(frameOf(`q${q.n}`, 0));
    el.classList.add('overview', 'all-in');
    sfx('pop');
    await wait(4000);
  }

  async function bonusReveal(q, el, res) {
    sfx('drumroll', 2);
    el.classList.add('revealed');
    const num = el.querySelector('#pct-num');
    const people = [...el.querySelectorAll('#people i')];
    const total = 2400 / SPEED;
    const t0 = clock.now();
    await new Promise((done) => {
      const step = () => {
        const t = Math.min(1, (clock.now() - t0) / total);
        const v = Math.round(94 * (1 - (1 - t) ** 3));
        num.textContent = v;
        people.forEach((p, i) => p.classList.toggle('on', i < v));
        if (t < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    sfx('correct');
    const list = el.querySelector('#guesses');
    list.innerHTML = (res.guesses || []).slice(0, 5).map((g) => `<li class="${g.won ? 'won' : ''}"><i style="--c:${g.color}"></i><span>${esc(g.name)}</span><b>${g.value}%</b>${g.won ? '<em>+$300,000</em>' : ''}</li>`).join('');
    await wait(400);
    el.classList.add('foot-on');
  }

  async function discovery(step, r) {
    stage(step, { name: 'discovery', round: r });
    hud();
    live(`disc${r}`);
    await cam.fly(frameOf(`disc${r}`, 0));
    sfx('sting');
    await wait(3500);
  }

  async function leaderboard(step, r) {
    stage(step, { name: 'leaderboard', round: r });
    const list = await getStandings(r);
    const el = live(`lb${r}`);
    const ol = el.querySelector('.lb-rows');
    const top = list.slice(0, 5);
    ol.innerHTML = top.length
      ? top.map((p, i) => `<li style="--i:${i}"><b class="rk">${p.rank}</b><i style="--c:${p.color}"></i><span>${esc(p.name)}</span><em data-to="${p.score}">$0</em><small></small></li>`).join('')
      : '<li class="empty">No players yet</li>';
    $('.hud-join', root).hidden = false;
    await cam.ease(frameOf(`lb${r}`, 0), 1400);
    el.classList.add('play');
    countUpMoney(ol.querySelectorAll('em[data-to]'), 1400);
    await waitNext('Next', 7000);
    $('.hud-join', root).hidden = true;
  }

  // Leaderboard money: counts every row up from $0 together.
  function countUpMoney(nodes, ms) {
    const t0 = clock.now();
    const go = () => {
      const t = Math.min(1, (clock.now() - t0) / (ms / SPEED));
      const e = 1 - (1 - t) ** 3;
      nodes.forEach((n) => (n.textContent = '$' + fmt(Math.round(Number(n.dataset.to) * e))));
      if (t < 1) requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  }

  async function bonusIntro(step) {
    stage(step, { name: 'bonusIntro', round: 'bonus' });
    playMusic('bonus');
    hud();
    live('bonusIntro');
    await cam.fly(frameOf('bonusIntro', 0));
    sfx('sting');
    await wait(2800);
  }

  async function podium(step) {
    // Slow, built-up finish. Third and second each get a short spotlight of
    // what they did, then rise. First place: the stats come first, the name
    // lands exactly on the winners' fanfare.
    stage(step, { name: 'podium' });
    hud();
    const list = await getStandings('final');
    const el = live('podium');
    await cam.fly(frameOf('podium', 0));
    const spot = el.querySelector('.spot');
    const fill = (cls, p) => {
      const who = el.querySelector(`.${cls} .who`);
      who.innerHTML = p ? `<i style="--c:${p.color}"></i><span>${esc(p.name)}</span><em>$${fmt(p.score)}</em>` : '';
    };
    fill('s3', list[2]); fill('s2', list[1]); fill('s1', list[0]);
    const lines = (p) => [
      `<b>${p.right}</b> of 12 answers right`,
      p.streaks ? `<b>${p.streaks}</b> streak bonus${p.streaks > 1 ? 'es' : ''} · +$${fmt(p.streaks * 50000)}` : 'No streak bonus this time',
      p.bonusWon ? 'Closest on the bonus question · <b>+$300,000</b>' : p.hints ? `${p.hints} hint${p.hints > 1 ? 's' : ''} used` : 'No hints used',
    ];
    async function spotlight(p, place, nameFirst) {
      spot.innerHTML = `<p class="spot-place">${place}</p>
        <p class="spot-name">${nameFirst ? `<i style="--c:${p.color}"></i>${esc(p.name)}` : '<span>Who is it?</span>'}</p>
        <ul class="spot-lines">${lines(p).map((l) => `<li>${l}</li>`).join('')}</ul>
        <p class="spot-money">$<span>0</span></p>`;
      spot.className = 'spot on';
      sfx('drumroll', 1.2);
      await wait(1500);
      for (const li of spot.querySelectorAll('li')) { li.classList.add('in'); sfx('pop'); await wait(1300); }
      spot.querySelector('.spot-money').classList.add('in');
      await countUp(spot.querySelector('.spot-money span'), p.score, 1600);
      await wait(900);
    }
    const ranks = [[list[2], 's3', 'Third place'], [list[1], 's2', 'Second place']];
    for (const [p, cls, place] of ranks) {
      if (!p) continue;
      await spotlight(p, place, true);
      await wait(1200);
      spot.className = 'spot';
      await wait(500);
      el.querySelector(`.${cls}`).classList.add('up');
      sfx('pop');
      await wait(1800);
    }
    if (list[0]) {
      await spotlight(list[0], 'And the winner is', false);
      // The fanfare's first hit is the reveal: wait for the beat it lands on.
      const toBeat = await playMusic('winners');
      if (toBeat > 0.05) await wait(toBeat * 1000 * SPEED - 30);
      spot.querySelector('.spot-name').innerHTML = `<i style="--c:${list[0].color}"></i>${esc(list[0].name)}`;
      spot.classList.add('named');
      confetti($('#confetti', root), { duration: 6000 / SPEED });
      await wait(3500);
      spot.className = 'spot';
      await wait(500);
      el.querySelector('.s1').classList.add('up');
    } else playMusic('winners');
    await waitNext('Back to the start', 14000);
  }

  async function countUp(node, to, ms) {
    const t0 = clock.now(), total = ms / SPEED;
    await new Promise((done) => {
      const tick = () => {
        const t = Math.min(1, (clock.now() - t0) / total);
        node.textContent = fmt(Math.round(to * (1 - (1 - t) ** 3)));
        if (t < 1) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame(tick);
    });
  }

  async function finale(step) {
    // Back to the home screen, ready for another game.
    stage(step, { name: 'finale' });
    playMusic('lobby');
    net.send({ t: 'host:restart' });
    S.started = false;
    S.results = {};
    root.querySelectorAll('.zone').forEach((z) => { z.className = z.className.split(' ').filter((c) => c === 'zone' || c.startsWith('z-')).join(' '); });
    S.returning = true;
    await cam.fly(frameOf('lobby', 0), 3200);
    setTimeout(() => startShow(0), 0);
  }

  return {
    state: S, cam, net,
    // A Start pressed before the lobby is ready is remembered, not lost.
    start: () => { if (waiters.start) waiters.start(); else S.startAsked = true; },
    pause: () => { togglePause(); return clock.paused; },
    back: goBack,
    next: advance,
    canBack: () => S.started && S.step > 1,
  };
}
