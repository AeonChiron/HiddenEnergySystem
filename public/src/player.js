// Player phone app. Pure state machine + render; the look lives in player.css.
// mountPlayer(root, { connect }) so the preview build can run it in-page.

import { connect as wsConnect } from './net.js';
import { logoMark } from './art/world.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const money = (n) => `${n < 0 ? '−' : ''}$${fmt(Math.abs(n))}`;
const short = (n) => (n >= 1000 ? `$${fmt(n / 1000)}K` : `$${fmt(n)}`);

const ICON = {
  bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
};

export function mountPlayer(root, opts = {}) {
  const params = new URLSearchParams(location.search);
  const pathCode = (location.pathname.match(/\/join\/(\d{4,5})/) || [])[1];
  // Online mode: this phone creates the game and also runs the show itself
  // (an invisible big screen), so nobody needs a projector.
  const creating = opts.create || /^\/online\/?$/.test(location.pathname);
  const state = {
    view: creating ? 'create' : 'join',
    mode: creating ? 'online' : 'classroom',
    creator: false,
    roster: [],
    code: opts.code || pathCode || params.get('code') || '',
    name: '',
    me: null,            // { id, name, color, score, hintsLeft }
    stage: { name: 'lobby' },
    open: null,          // current open question payload
    deadline: 0,
    selected: null,
    bet: null,
    lockedBet: null,
    locked: null,
    hint: null,
    result: null,
    standing: null,
    error: '',
    netStatus: 'connecting',
    joining: false,
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  const savedName = store.get('he:name');
  if (savedName) state.name = savedName;

  const net = (opts.connect || wsConnect)({
    onOpen() {
      // Re-identify after any reconnect.
      const token = state.code && store.get(`he:token:${state.code}`);
      if (state.me && token) net.send({ t: 'join', code: state.me.code, token });
      else if (token) net.send({ t: 'join', code: state.code, token });
    },
    onMessage: onMsg,
    onStatus(s) { state.netStatus = s; renderStatus(); },
  });

  function onMsg(m) {
    switch (m.t) {
      case 'joined':
        state.joining = false;
        state.me = { id: m.id, name: m.name, color: m.color, score: m.score, hintsLeft: m.hintsLeft, code: m.code };
        if (m.mode) state.mode = m.mode;
        if (m.token) store.set(`he:token:${m.code}`, m.token);
        state.code = m.code;
        if (!m.rejoined || state.view === 'join') state.view = 'lobby';
        break;
      case 'join:error':
        state.joining = false;
        // A stale token for a game that no longer exists: forget it quietly.
        if (m.code === 'bad_code' && !state.me) store.del(`he:token:${state.code}`);
        state.error = m.message;
        state.view = 'join';
        break;
      case 'stage':
        state.stage = m.stage;
        if (m.stage.mode) state.mode = m.stage.mode;
        if (!['decision', 'reveal'].includes(m.stage.name)) { state.result = null; }
        if (m.stage.name === 'watch' && (!state.open || state.open.question.n !== m.stage.n)) {
          state.open = null; state.locked = null; state.selected = null; state.hint = null; state.bet = null; state.lockedBet = null;
        }
        state.view = viewForStage(m.stage.name);
        break;
      case 'timer':
        if (state.open && state.open.question?.n === m.n) { state.deadline = performance.now() + m.remaining; state.heldLeft = m.held ? m.remaining : null; if (!m.held && state.view === 'answer') tick(); }
        break;
      case 'open':
        state.open = m;
        state.deadline = performance.now() + m.remaining;
        state.heldLeft = null;
        state.locked = m.locked;
        state.selected = m.locked;
        state.lockedBet = m.lockedBet;
        if (m.locked == null) state.bet = m.bets?.some((c) => c.amount === state.bet) ? state.bet : null;
        if (state.me) { state.me.score = m.balance ?? state.me.score; state.me.streak = m.streak ?? 0; }
        state.hint = m.hint;
        if (state.me) state.me.hintsLeft = m.hintsLeft;
        state.result = null;
        state.view = m.locked != null ? 'locked' : 'answer';
        buzz(30);
        break;
      case 'locked':
        state.locked = m.value;
        state.lockedBet = m.bet;
        state.view = 'locked';
        buzz([20, 40, 20]);
        break;
      case 'answer:late':
        state.view = 'locked';
        break;
      case 'hint':
        state.hint = m.text;
        if (state.me) state.me.hintsLeft = m.hintsLeft;
        break;
      case 'hint:error':
      case 'bet:error':
        flash(m.message);
        return;
      case 'result':
        state.result = m;
        state.open = null;
        if (state.me) state.me.score = m.score;
        state.view = 'result';
        buzz(m.correct ? [30, 60, 30] : 80);
        if (m.correct || m.won) celebrate(m.streakBonus || m.won ? 160 : 80);
        break;
      case 'standing':
        state.standing = m;
        if (state.me) state.me.score = m.score;
        if (m.final) state.view = 'final';
        break;
      case 'rewind':
        if (state.me) { state.me.score = m.score; state.me.hintsLeft = m.hintsLeft; }
        state.result = null; state.standing = null; state.open = null;
        state.locked = null; state.selected = null; state.hint = null; state.bet = null; state.lockedBet = null;
        return; // the stage message right after this draws the screen
      case 'reset':
        if (state.me) { state.me.score = m.score; state.me.hintsLeft = m.hintsLeft; }
        state.result = null; state.standing = null; state.open = null;
        state.view = 'lobby';
        break;
      case 'kicked':
        store.del(`he:token:${state.code}`);
        state.me = null;
        state.view = 'kicked';
        break;
      case 'replaced':
        state.view = 'replaced';
        break;
      default:
        return;
    }
    render();
  }

  function viewForStage(name) {
    switch (name) {
      case 'lobby': return 'lobby';
      case 'roundIntro': return 'roundIntro';
      case 'watch': return 'watch';
      case 'decision': return state.locked != null ? 'locked' : 'answer';
      case 'reveal': return state.result ? 'result' : 'watch';
      case 'discovery': return 'discovery';
      case 'leaderboard': return 'leaderboard';
      case 'bonusIntro': return 'bonusIntro';
      case 'howto': return 'howto';
      case 'podium': case 'finale': return 'final';
      default: return 'lobby';
    }
  }

  // ---------- actions ----------
  function doJoin(e) {
    e.preventDefault();
    const code = $('#pcode', root).value.replace(/\D/g, '');
    const name = $('#pname', root).value.trim();
    if (code.length < 4) { state.error = 'The game code is the 4 digits on the big screen.'; return render(); }
    if (!name) { state.error = 'Pick a nickname first.'; return render(); }
    state.code = code; state.name = name; state.error = ''; state.joining = true;
    store.set('he:name', name);
    net.send({ t: 'join', code, name, token: store.get(`he:token:${code}`) || undefined });
    render();
  }

  // ---------- online mode: create the game on this phone ----------
  let show = null;
  async function startOnline(fresh) {
    const { mountHost } = await import('./host/main.js');
    const box = document.createElement('div');
    box.className = 'he-hidden-show';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);
    show = mountHost(box, { mode: 'online', fresh });
    const t0 = Date.now();
    await new Promise((res, rej) => {
      const iv = setInterval(() => {
        if (show.state.code) { clearInterval(iv); res(); }
        else if (Date.now() - t0 > 15000) { clearInterval(iv); rej(new Error('timeout')); }
      }, 100);
    });
    state.creator = true;
    state.code = show.state.code;
    try { sessionStorage.setItem('he:online', state.code); } catch {}
    // Keep the lobby list fresh from the show's own player list.
    setInterval(() => {
      const list = (show.state.players || []).map((p) => p.name);
      if (list.join('|') !== state.roster.join('|')) { state.roster = list; if (state.view === 'lobby') render(); }
    }, 700);
  }

  async function doCreate(e) {
    e.preventDefault();
    const name = $('#pname', root).value.trim();
    if (!name) { state.error = 'Pick a nickname first.'; return render(); }
    state.name = name; state.error = ''; state.joining = true;
    store.set('he:name', name);
    render();
    try { await startOnline(true); }
    catch { state.joining = false; state.error = "We couldn't start a game. Check your connection and try again."; return render(); }
    net.send({ t: 'join', code: state.code, name });
  }

  // Only the phone that runs an online game gets these.
  function controls() {
    if (!state.creator || !show || ['create', 'join', 'lobby', 'kicked'].includes(state.view)) return '';
    return `<div class="host-ctl" role="toolbar" aria-label="Game controls">
      <button class="btn" data-act="back" ${show.canBack() ? '' : 'disabled'}>Back</button>
      <button class="btn" data-act="pause" aria-pressed="${state.paused ? 'true' : 'false'}">${state.paused ? 'Resume' : 'Pause'}</button>
    </div>${state.paused ? '<p class="paused-note">Paused for everyone</p>' : ''}`;
  }

  // Confetti on the phone when you get it right. One canvas, outside the re-rendered app.
  let confCanvas = null;
  async function celebrate(count) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const { confetti } = await import('./host/confetti.js');
      if (!confCanvas) {
        confCanvas = document.createElement('canvas');
        confCanvas.setAttribute('aria-hidden', 'true');
        confCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;display:none';
        document.body.appendChild(confCanvas);
      }
      confetti(confCanvas, { duration: 2400, count });
    } catch {}
  }

  function startGame() {
    if (show && show.start) show.start();
  }

  function pick(letter) {
    if (state.locked != null || !state.open) return;
    state.selected = letter;
    state.pop = `[data-pick="${letter}"]`;
    buzz(10);
    render();
  }

  function lockIn() {
    if (!state.open || state.selected == null || state.locked != null) return;
    if (needsBet() && state.bet == null) return;
    net.send({ t: 'answer', n: state.open.question.n, value: state.selected, bet: state.open.question.kind === 'number' ? 0 : state.bet ?? 0 });
  }

  function needsBet() {
    return !!(state.open && state.open.question.kind !== 'number' && state.open.bets?.length);
  }

  // Lock in says what is still missing, then what is at stake.
  function lockLabel() {
    const q = state.open.question;
    if (q.kind === 'number') return 'Lock in';
    if (state.selected == null) return 'Pick one';
    if (needsBet() && state.bet == null) return 'Choose a bet';
    return state.bet ? `Lock in ${short(state.bet)}` : 'Lock in';
  }

  function useHint() {
    if (!state.open || state.hint || !state.me || state.me.hintsLeft <= 0) return;
    net.send({ t: 'hint', n: state.open.question.n });
  }

  // ---------- render ----------
  let timerRaf = 0;
  // Redraws keep keyboard focus where it was. A new screen moves focus to
  // its heading, so screen readers announce what changed.
  let shownHint = null;

  // Header money counts to its new value instead of jumping.
  const tally = { shown: null, from: 0, to: 0, t0: 0, raf: 0 };
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  function animateScore() {
    const box = $('.ph .xp', root);
    if (!box || !state.me) { tally.shown = null; return; }
    const target = state.me.score;
    if (tally.shown == null || calm.matches) { tally.shown = tally.to = target; return; }
    if (target !== tally.to) {
      tally.from = tally.shown; tally.to = target; tally.t0 = performance.now();
      tally.dir = target > tally.from ? 'up' : 'down';
    }
    if (tally.shown === tally.to) return;
    box.classList.add(tally.dir);
    cancelAnimationFrame(tally.raf);
    const step = () => {
      const t = Math.min(1, (performance.now() - tally.t0) / 1100);
      tally.shown = Math.round(tally.from + (tally.to - tally.from) * (1 - (1 - t) ** 3));
      const b = $('.ph .xp b', root);
      if (b) b.textContent = money(tally.shown);
      if (t < 1) tally.raf = requestAnimationFrame(step);
      else $('.ph .xp', root)?.classList.remove('up', 'down');
    };
    step();
  }

  function focusKey() {
    const a = document.activeElement;
    if (!a || !root.contains(a)) return null;
    const d = a.dataset || {};
    if (d.pick) return `[data-pick="${d.pick}"]`;
    if (d.bet) return `[data-bet="${d.bet}"]`;
    if (d.act) return `[data-act="${d.act}"]`;
    if (d.n) return `[data-n="${d.n}"]`;
    return a.id ? `#${a.id}` : null;
  }

  function render() {
    cancelAnimationFrame(timerRaf);
    const prevView = root.dataset.view;
    const key = focusKey();
    root.dataset.view = state.view;
    // "fresh" plays the entrance only when the screen changes, not on every tap.
    const fresh = prevView !== state.view;
    root.className = `he-player v-${state.view}${fresh ? ' fresh' : ''}`;
    root.innerHTML = `
      ${state.me ? header() : ''}
      ${controls()}
      <main class="pv">${body()}</main>
      <div class="net" role="status" aria-live="polite"></div>
      <div class="toast" role="status" aria-live="polite"></div>`;
    bind();
    renderStatus();
    if (state.view === 'answer') tick();
    if (state.pop) { root.querySelector(state.pop)?.classList.add('pop'); state.pop = null; }
    const hint = $('.hinttext', root);
    if (hint && state.hint !== shownHint) hint.classList.add('new');
    shownHint = state.hint;
    animateScore();
    if (key && prevView === state.view) root.querySelector(key)?.focus({ preventScroll: true });
    else if (prevView && prevView !== state.view && state.view !== 'join') {
      const h = root.querySelector('main h2, main h1, main .q');
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    }
  }

  // Dark letters on light colours, white on dark ones.
  function initialInk(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const l = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return l > 0.2 ? 'var(--ink)' : '#fff';
  }

  function header() {
    const m = state.me;
    return `<header class="ph">
      <span class="avatar" style="--c:${m.color};color:${initialInk(m.color)}">${esc(Array.from(m.name)[0] || '?').toUpperCase()}</span>
      <span class="who">${esc(m.name)}</span>
      <span class="xp"><b>${money(m.score)}</b></span>
      <button class="leave" data-act="leave" aria-label="Leave the game">Leave</button>
    </header>`;
  }

  function body() {
    const s = state.stage;
    switch (state.view) {
      case 'join': return `
        <form class="join" autocomplete="off">
          <div class="join-brand">${logoMark()}<h1 class="brand"><span>The Hidden</span>Energy System</h1></div>
          <p class="lede">Enter the game code and pick a name. That's all it takes.</p>
          <label>Game code<input id="pcode" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="0000" value="${esc(state.code)}" ${state.code ? '' : 'autofocus'}></label>
          <label>Nickname<input id="pname" maxlength="16" placeholder="Your nickname" value="${esc(state.name)}" ${state.code ? 'autofocus' : ''}></label>
          ${state.error ? `<p class="err">${esc(state.error)}</p>` : ''}
          <button class="btn primary" ${state.joining ? 'disabled' : ''}>${state.joining ? 'Joining…' : 'Play'}</button>
          <p class="fine">No account, no email. Just a nickname.</p>
        </form>`;
      case 'create': return `
        <form class="join create" autocomplete="off">
          <div class="join-brand">${logoMark()}<h1 class="brand"><span>The Hidden</span>Energy System</h1></div>
          <p class="lede">Online game: everyone plays on their own phone. You start it, share the link, and the game runs itself. You can also play alone.</p>
          <label>Your nickname<input id="pname" maxlength="16" placeholder="Your nickname" value="${esc(state.name)}" autofocus></label>
          ${state.error ? `<p class="err">${esc(state.error)}</p>` : ''}
          <button class="btn primary" ${state.joining ? 'disabled' : ''}>${state.joining ? 'Creating…' : 'Create the game'}</button>
          <p class="fine">Keep this screen open while you play. It runs the game for everyone.</p>
        </form>`;
      case 'lobby': return state.mode === 'online' ? onlineLobby() : `
        <section class="center">
          <div class="big-avatar" style="--c:${state.me.color};color:${initialInk(state.me.color)}">${esc(Array.from(state.me.name)[0] || '?').toUpperCase()}</div>
          <h2>You're in.</h2>
          <p>Find your name on the big screen. The game starts once everyone has joined.</p>
        </section>`;
      case 'roundIntro': return `
        <section class="center">
          ${online() ? pic(`art/round${s.round}`, 'stage-pic') : ''}
          <p class="kicker">Round ${esc(s.round)}${s.roundInfo?.theme ? ` · ${esc(s.roundInfo.theme)}` : ''}</p>
          <h2>${esc(s.roundInfo?.name)}</h2>
          <p>${esc(s.roundInfo?.tagline)}</p>
          <p class="pill">Bet up to 50% of your money</p>
        </section>`;
      case 'watch': return online() ? onlineWatch(s) : `
        <section class="center watch">
          <span class="eye">${ICON.eye}</span>
          <h2>Watch the big screen</h2>
          ${s.question ? `<p class="q">${esc(s.question.title ? s.question.title : s.question.prompt)}</p>` : ''}
          ${s.letter && s.letter.length === 1 ? `<p class="now">Now showing <b class="ltr l-${s.letter}">${s.letter}</b></p>` : ''}
          <p class="fine">Your answers open when every option has been shown.</p>
        </section>`;
      case 'answer': return answerView();
      case 'locked': return `
        <section class="center">
          <span class="lockmark">${ICON.lock}</span>
          <h2>Locked in${state.locked != null ? `: <b>${esc(labelFor(state.locked))}</b>` : ''}</h2>
          ${state.lockedBet ? `<p class="pill">Bet ${money(state.lockedBet)}</p>` : state.locked != null && typeof state.locked !== 'number' ? '<p class="pill">No bet</p>' : ''}
          <p>Your answer is in. Waiting on the rest of the room.</p>
        </section>`;
      case 'result': return resultView();
      case 'discovery': return `
        <section class="center">
          <p class="kicker">Round ${esc(s.round)} discovery</p>
          <h2 class="discovery">${esc(s.roundInfo?.discovery)}</h2>
        </section>`;
      case 'leaderboard': return `
        <section class="center">
          <p class="kicker">Round ${esc(s.round)} complete</p>
          ${state.standing ? `<p class="rank">#${state.standing.rank}</p><p>of ${state.standing.of} players</p>` : '<h2>Leaderboard</h2>'}
          <p class="pill">${money(state.me?.score)}</p>
        </section>`;
      case 'howto': {
        // Each rule shows up here at the same moment it appears on the big screen.
        const beat = Number.isInteger(s?.beat) ? s.beat : -1;
        if (beat < 0) return `
        <section class="center howto-p">
          <p class="kicker">How to play</p>
          <h2>${online() ? 'Here come the rules' : 'Look at the big screen'}</h2>
        </section>`;
        return `
        <section class="center howto-p">
          <p class="kicker">How to play</p>
          <ul class="rules">${RULES.slice(0, beat + 1).map((r, i) => `<li class="${i === beat ? 'latest' : ''}">${r}</li>`).join('')}</ul>
          ${online() ? '' : '<p class="fine">Keep watching the big screen.</p>'}
        </section>`;
      }
      case 'bonusIntro': return `
        <section class="center">
          <p class="kicker">Final challenge</p>
          <h2>Bonus question</h2>
          <p>Guess one number from 0 to 100. The closest guess wins <b>$300,000</b>. If there's a perfect tie, everyone tied wins it.</p>
        </section>`;
      case 'final': return `
        <section class="center">
          <p class="kicker">Final results</p>
          ${state.standing ? `<p class="rank">#${state.standing.rank}</p><p>of ${state.standing.of} players</p>` : '<h2>Thank you for playing</h2>'}
          <p class="pill">${money(state.me?.score)}</p>
          ${state.standing?.recap ? `<div class="recap"><p class="recap-total"><b>${state.standing.recap.right}</b> / ${state.standing.recap.total} right</p>
            <ul>${state.standing.recap.rounds.map((r) => `<li><span>${esc(r.name)}</span><b>${r.right} / ${r.total}</b></li>`).join('')}</ul></div>` : ''}
          ${online() ? '' : '<p class="fine">Watch the big screen for the winners.</p>'}
        </section>`;
      case 'kicked': return `<section class="center"><h2>You've been removed from this game</h2><button class="btn" data-act="rejoin">Join again</button></section>`;
      case 'replaced': return `<section class="center"><h2>You're playing in another tab</h2><p>This screen is no longer connected.</p></section>`;
      default: return '';
    }
  }

  function online() { return state.mode === 'online'; }

  // The same four rules as the big screen's how-to, in the same order.
  const RULES = [
    'Three rounds: <b>food, energy, repair</b>. Answer on your phone. Most money wins.',
    'You start with <b>$100,000</b>. Bet 10, 15, 25 or 50% of it on each answer.',
    'Get 3 right in a row, with a bet on each: <b>$50,000 bonus</b>.',
    '<b>2 hints</b> for the whole game. Only you see them.',
  ];

  // Pictures: the game's own files, or the inlined copies in the preview build.
  function pic(key, cls = 'stage-pic') {
    const src = globalThis.HE_IMG?.[key] || globalThis.HE_IMG?.[key.replace(/^food\//, '')] || `/img/${key}.webp`;
    return `<figure class="${cls}"><img src="${src}" alt="" loading="eager" onerror="const n=+(this.dataset.retry||0);if(n>=3){this.parentNode.remove();return;}this.dataset.retry=n+1;setTimeout(()=>{this.src=this.src.split('?')[0]+'?r='+(n+1)},800*(n+1))"></figure>`;
  }

  function onlineLobby() {
    const link = `${location.origin}/join/${state.code}`;
    if (!state.creator) return `
      <section class="center">
        <div class="big-avatar" style="--c:${state.me.color};color:${initialInk(state.me.color)}">${esc(Array.from(state.me.name)[0] || '?').toUpperCase()}</div>
        <h2>You're in.</h2>
        <p>The game starts as soon as the host presses Start.</p>
      </section>`;
    const others = state.roster.filter((n) => n !== state.me.name);
    return `
      <section class="center online-lobby">
        <p class="kicker">Game code</p>
        <p class="code-big">${esc(state.code)}</p>
        <p>Friends join at <b>${esc(location.host)}/join</b> with this code, or with your link.</p>
        <button class="btn" data-act="share">Share the link</button>
        <ul class="roster">${[state.me.name, ...others].map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        <p class="fine">${others.length ? `${others.length + 1} players ready` : 'Just you so far. You can play alone.'}</p>
        <button class="btn primary start" data-act="start">${others.length ? 'Start the game' : 'Start playing alone'}</button>
      </section>`;
  }

  function onlineWatch(s) {
    const q = s.question;
    if (!q) return `<section class="center"><h2>Get ready</h2></section>`;
    if (q.kind === 'binary') return `
      <section class="center watch online-watch">
        ${pic(`food/${q.food}`, 'stage-pic food')}
        <p class="kicker">Question ${q.n} of 12</p>
        <h2>${esc(q.title)}</h2>
        ${q.caption ? `<p>${esc(q.caption)}</p>` : ''}
        <p class="q">${esc(q.prompt)}</p>
      </section>`;
    const o = s.letter && q.options?.find((x) => x.letter === s.letter);
    if (o) return `
      <section class="center watch online-watch">
        ${o.scene ? pic(`art/${o.scene}`) : ''}
        <p class="opt"><b class="ltr l-${o.letter}">${o.letter}</b><span>${esc(o.text)}</span></p>
        <p class="fine">${esc(q.prompt)}</p>
      </section>`;
    return `
      <section class="center watch online-watch">
        <p class="kicker">${q.n === 13 ? 'Bonus question' : `Question ${q.n} of 12`}</p>
        <h2 class="q-big">${esc(q.prompt)}</h2>
        ${q.options ? '<p class="fine">Here are your choices, one at a time.</p>' : ''}
      </section>`;
  }

  function labelFor(v) {
    if (v === 'HIGH') return 'High carb';
    if (v === 'LOW') return 'Low carb';
    if (typeof v === 'number') return `${v}%`;
    return v;
  }

  function answerView() {
    const o = state.open;
    const q = o.question;
    const hintBtn = q.hasHint
      ? `<button class="btn hint" data-act="hint" aria-label="${state.hint ? 'Hint shown' : `Use a hint, ${state.me.hintsLeft} of 2 left`}" ${state.hint || state.me.hintsLeft <= 0 ? 'disabled' : ''}>${ICON.bulb}<span>Hint</span><small class="lives" aria-label="${state.me.hintsLeft} of 2 hints left">${[0, 1].map((i) => `<i class="${i < state.me.hintsLeft ? 'on' : ''}"></i>`).join('')}</small></button>`
      : '';
    let choices;
    if (q.kind === 'number') {
      const v = state.selected ?? 50;
      choices = `
        <div class="numpick">
          <output class="numval"><span id="numv">${v}</span><small>%</small></output>
          <input type="range" id="num" min="${q.min}" max="${q.max}" value="${v}" aria-label="Your guess in percent">
          <div class="nudge"><button class="btn" data-n="-1" aria-label="Minus one">−1</button><button class="btn" data-n="1" aria-label="Plus one">+1</button></div>
        </div>`;
    } else {
      choices = `<div class="choices k-${q.kind}">${q.options.map((op) => `
        <button class="choice l-${op.all ? 'all' : op.letter} ${state.selected === op.letter ? 'sel' : ''}" data-pick="${op.letter}" aria-pressed="${state.selected === op.letter}">
          ${q.kind === 'mc' ? `<b class="ltr">${op.letter}</b>` : ''}<span>${esc(op.text)}</span>
        </button>`).join('')}</div>`;
    }
    return `
      <div class="timer" aria-hidden="true"><i></i></div>
      <section class="answer">
        <div class="qhead"><span class="secs" aria-live="off">20</span><p class="q">${esc(q.title ? q.prompt : q.prompt)}</p></div>
        ${state.hint ? `<p class="hinttext">${ICON.bulb}<span>${esc(state.hint)}</span></p>` : ''}
        ${choices}
        ${q.kind !== 'number' && o.bets?.length ? `<div class="bets" role="radiogroup" aria-label="Your bet">
          <p class="bets-head">Your bet <span>You have ${money(state.me.score)}</span></p>${o.bets.some((c) => c.comeback) ? `<p class="fine comeback-note">Low on money? Take the comeback bet. Right adds $10,000, wrong can't take you below $0, and three right in a row still wins $50,000.</p>` : ""}
          <div class="bet-row">${o.bets.map(({ pct, amount: v, comeback }) => `<button class="bet ${state.bet === v ? 'sel' : ''}${comeback ? ' comeback' : ''}" data-bet="${v}" role="radio" aria-checked="${state.bet === v}">${comeback ? `<b>Comeback</b> <small>${short(v)}</small>` : pct === 0 ? 'No bet' : `<b>${pct}%</b> <small>${short(v)}</small>`}</button>`).join('')}</div>
        </div>` : ''}
        <div class="actions">
          ${hintBtn}
          <button class="btn primary lockin" data-act="lock" ${(state.selected == null || (needsBet() && state.bet == null)) && q.kind !== 'number' ? 'disabled' : ''}>${ICON.lock}<span>${lockLabel()}</span></button>
        </div>
      </section>`;
  }

  function resultView() {
    const r = state.result;
    if (r.kind === 'number') {
      return `<section class="center res">
        <p class="kicker">The answer</p>
        <p class="rank">${r.answer}%</p>
        ${r.value != null ? `<p>You guessed <b>${r.value}%</b>. ${r.distance === 0 ? 'Exactly right.' : `That's ${r.distance} away.`}</p>` : '<p>No guess this time.</p>'}
        ${r.won ? `<p class="pill">Closest guess: +${money(r.gained)}</p>` : ''}
        <p class="expl">${esc(r.explanation)}</p>
      </section>`;
    }
    const ok = r.correct;
    const ex = online() && state.stage?.explain;
    return `<section class="center res ${ok ? 'ok' : 'no'}">
      ${ex?.scene ? pic(`art/${ex.scene}`, 'stage-pic small') : ''}
      <span class="mark">${ok ? ICON.check : ICON.cross}</span>
      <h2>${ok ? 'Correct' : r.value == null ? "Time's up" : 'Not quite'}</h2>
      ${ok ? `<p class="pill gain">${r.bet ? `+${money(r.bet)}` : 'No bet placed'}</p>` : `<p>The answer was <b>${esc(labelFor(r.answer))}</b>.</p>${r.gained < 0 ? `<p class="pill loss">${money(r.gained)}</p>` : r.bet ? '<p class="pill">Nothing lost</p>' : ''}`}
      ${r.streakBonus ? `<p class="streak">Three in a row. Bonus +${money(r.streakBonus)}</p>` : ok && r.streak === 2 ? '<p class="streak hot">2 in a row. One more pays $50,000!</p>' : ok && r.streak ? `<p class="fine">${r.streak} right in a row with a bet. Three pays a $50,000 bonus.</p>` : ''}
      <p class="expl">${esc(r.explanation)}</p>
    </section>`;
  }

  function bind() {
    const form = $('form.join', root);
    if (form) form.addEventListener('submit', state.view === 'create' ? doCreate : doJoin);
    $('[data-act="start"]', root)?.addEventListener('click', startGame);
    $('[data-act="pause"]', root)?.addEventListener('click', () => { state.paused = show.pause(); render(); });
    $('[data-act="back"]', root)?.addEventListener('click', () => { if (show.canBack()) { state.paused = false; show.back(); } });
    $('[data-act="share"]', root)?.addEventListener('click', async () => {
      const url = `${location.origin}/join/${state.code}`;
      try { if (navigator.share) await navigator.share({ title: 'The Hidden Energy System', url }); else { await navigator.clipboard.writeText(url); const t = $('.toast', root); if (t) { t.textContent = 'Link copied'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); } } } catch {}
    });
    root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.pick)));
    const lock = $('[data-act="lock"]', root);
    if (lock) lock.addEventListener('click', () => {
      if (state.open?.question.kind === 'number' && state.selected == null) state.selected = Number($('#num', root).value);
      lockIn();
    });
    root.querySelectorAll('[data-bet]').forEach((btn) => btn.addEventListener('click', () => { state.bet = Number(btn.dataset.bet); state.pop = `[data-bet="${btn.dataset.bet}"]`; buzz(10); render(); }));
    const hint = $('[data-act="hint"]', root);
    if (hint) hint.addEventListener('click', useHint);
    const leave = $('[data-act="leave"]', root);
    if (leave) leave.addEventListener('click', () => {
      if (!confirm('Leave the game? Your money will be lost.')) return;
      net.send({ t: 'leave' });
      store.del(`he:token:${state.code}`);
      state.me = null; state.open = null; state.result = null; state.standing = null;
      state.view = 'join'; render();
    });
    const rejoin = $('[data-act="rejoin"]', root);
    if (rejoin) rejoin.addEventListener('click', () => { state.view = 'join'; render(); });
    const num = $('#num', root);
    if (num) {
      const set = (v) => { state.selected = Math.max(0, Math.min(100, v)); num.value = state.selected; $('#numv', root).textContent = state.selected; };
      num.addEventListener('input', () => set(Number(num.value)));
      root.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => set(Number(num.value) + Number(b.dataset.n))));
    }
  }

  function tick() {
    const bar = $('.timer i', root);
    const secs = $('.secs', root);
    if (!bar || !state.open) return;
    const total = state.open.total;
    const left = state.heldLeft ?? Math.max(0, state.deadline - performance.now());
    bar.style.transform = `scaleX(${left / total})`;
    const s = Math.ceil(left / 1000);
    if (secs.textContent !== String(s)) secs.textContent = s;
    root.classList.toggle('hurry', left < 5000);
    if (left > 0 && state.heldLeft == null) timerRaf = requestAnimationFrame(tick);
  }

  function renderStatus() {
    const el = $('.net', root);
    if (!el) return;
    el.textContent = state.netStatus === 'online' ? '' : state.netStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…';
    el.classList.toggle('show', state.netStatus !== 'online');
  }

  let toastT = 0;
  function flash(text) {
    const el = $('.toast', root);
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }

  if (creating) {
    let saved = null;
    try { saved = sessionStorage.getItem('he:online'); } catch {}
    const token = saved && store.get(`he:token:${saved}`);
    if (token) {
      state.view = 'join'; state.joining = true; state.code = saved;
      startOnline(false).then(() => net.send({ t: 'join', code: state.code, token })).catch(() => { state.view = 'create'; state.joining = false; render(); });
    }
  }

  render();
  return { state, net };
}
