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
  const state = {
    view: 'join',
    code: opts.code || pathCode || params.get('code') || '',
    name: '',
    me: null,            // { id, name, color, score, hintsLeft }
    stage: { name: 'lobby' },
    open: null,          // current open question payload
    deadline: 0,
    selected: null,
    bet: 0,
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
        if (!['decision', 'reveal'].includes(m.stage.name)) { state.result = null; }
        if (m.stage.name === 'watch' && (!state.open || state.open.question.n !== m.stage.n)) {
          state.open = null; state.locked = null; state.selected = null; state.hint = null; state.bet = 0; state.lockedBet = null;
        }
        state.view = viewForStage(m.stage.name);
        break;
      case 'open':
        state.open = m;
        state.deadline = performance.now() + m.remaining;
        state.locked = m.locked;
        state.selected = m.locked;
        state.lockedBet = m.lockedBet;
        if (m.locked == null) state.bet = m.bets?.some((c) => c.amount === state.bet) ? state.bet : 0;
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
        break;
      case 'standing':
        state.standing = m;
        if (state.me) state.me.score = m.score;
        if (m.final) state.view = 'final';
        break;
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

  function pick(letter) {
    if (state.locked != null || !state.open) return;
    state.selected = letter;
    buzz(10);
    render();
  }

  function lockIn() {
    if (!state.open || state.selected == null || state.locked != null) return;
    net.send({ t: 'answer', n: state.open.question.n, value: state.selected, bet: state.open.question.kind === 'number' ? 0 : state.bet });
  }

  function useHint() {
    if (!state.open || state.hint || !state.me || state.me.hintsLeft <= 0) return;
    net.send({ t: 'hint', n: state.open.question.n });
  }

  // ---------- render ----------
  let timerRaf = 0;
  function render() {
    cancelAnimationFrame(timerRaf);
    root.className = `he-player v-${state.view}`;
    root.innerHTML = `
      ${state.me ? header() : ''}
      <main class="pv">${body()}</main>
      <div class="net" role="status" aria-live="polite"></div>
      <div class="toast" role="status" aria-live="polite"></div>`;
    bind();
    renderStatus();
    if (state.view === 'answer') tick();
  }

  function header() {
    const m = state.me;
    return `<header class="ph">
      <span class="avatar" style="--c:${m.color}">${esc(Array.from(m.name)[0] || '?').toUpperCase()}</span>
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
          <p class="lede">Enter the code from the big screen and pick a name. That's all it takes.</p>
          <label>Game code<input id="pcode" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="0000" value="${esc(state.code)}" ${state.code ? '' : 'autofocus'}></label>
          <label>Nickname<input id="pname" maxlength="16" placeholder="Your nickname" value="${esc(state.name)}" ${state.code ? 'autofocus' : ''}></label>
          ${state.error ? `<p class="err">${esc(state.error)}</p>` : ''}
          <button class="btn primary" ${state.joining ? 'disabled' : ''}>${state.joining ? 'Joining…' : 'Play'}</button>
          <p class="fine">No account, no email. Just a nickname.</p>
        </form>`;
      case 'lobby': return `
        <section class="center">
          <div class="big-avatar" style="--c:${state.me.color}">${esc(Array.from(state.me.name)[0] || '?').toUpperCase()}</div>
          <h2>You're in.</h2>
          <p>Find your name on the big screen. The game starts once everyone has joined.</p>
        </section>`;
      case 'roundIntro': return `
        <section class="center">
          <p class="kicker">Round ${esc(s.round)}</p>
          <h2>${esc(s.roundInfo?.name)}</h2>
          <p>${esc(s.roundInfo?.tagline)}</p>
          <p class="pill">Bet up to 50% of your money</p>
        </section>`;
      case 'watch': return `
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
      case 'howto': return `
        <section class="center howto-p">
          <p class="kicker">How to play</p>
          <h2>Watch the big screen</h2>
          <ul class="rules">
            <li>You start with <b>$100,000</b>.</li>
            <li>Bet part of it on every answer. Right, you win your bet. Wrong, you lose it.</li>
            <li>Three right in a row, with a bet each time: <b>$50,000 extra</b>.</li>
            <li><b>2 hints</b> for the whole game. Only you see them.</li>
            <li>Bonus question at the end: closest guess takes <b>$300,000</b>.</li>
          </ul>
        </section>`;
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
          <p class="fine">Watch the big screen for the winners.</p>
        </section>`;
      case 'kicked': return `<section class="center"><h2>You've been removed from this game</h2><button class="btn" data-act="rejoin">Join again</button></section>`;
      case 'replaced': return `<section class="center"><h2>You're playing in another tab</h2><p>This screen is no longer connected.</p></section>`;
      default: return '';
    }
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
      ? `<button class="btn hint" data-act="hint" ${state.hint || state.me.hintsLeft <= 0 ? 'disabled' : ''}>${ICON.bulb}<span>${state.hint ? 'Hint shown' : 'Use a hint'}</span><small class="lives" aria-label="${state.me.hintsLeft} of 2 hints left">${[0, 1].map((i) => `<i class="${i < state.me.hintsLeft ? 'on' : ''}"></i>`).join('')}</small></button>`
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
          <p class="bets-head">Your bet <span>You have ${money(state.me.score)}</span></p>
          <div class="bet-row">${o.bets.map(({ pct, amount: v }) => `<button class="bet ${state.bet === v ? 'sel' : ''}" data-bet="${v}" role="radio" aria-checked="${state.bet === v}">${pct === 0 ? 'No bet' : `<b>${pct}%</b> <small>${short(v)}</small>`}</button>`).join('')}</div>
        </div>` : ''}
        <div class="actions">
          ${hintBtn}
          <button class="btn primary lockin" data-act="lock" ${state.selected == null && q.kind !== 'number' ? 'disabled' : ''}>${ICON.lock}<span>Lock in</span></button>
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
    return `<section class="center res ${ok ? 'ok' : 'no'}">
      <span class="mark">${ok ? ICON.check : ICON.cross}</span>
      <h2>${ok ? 'Correct' : r.value == null ? "Time's up" : 'Not quite'}</h2>
      ${ok ? `<p class="pill gain">${r.bet ? `+${money(r.bet)}` : 'No bet placed'}</p>` : `<p>The answer was <b>${esc(labelFor(r.answer))}</b>.</p>${r.bet ? `<p class="pill loss">${money(-r.bet)}</p>` : ''}`}
      ${r.streakBonus ? `<p class="streak">Three in a row. Bonus +${money(r.streakBonus)}</p>` : ok && r.streak ? `<p class="fine">${r.streak} right in a row with a bet. Three pays a $50,000 bonus.</p>` : ''}
      <p class="expl">${esc(r.explanation)}</p>
    </section>`;
  }

  function bind() {
    const form = $('form.join', root);
    if (form) form.addEventListener('submit', doJoin);
    root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.pick)));
    const lock = $('[data-act="lock"]', root);
    if (lock) lock.addEventListener('click', () => {
      if (state.open?.question.kind === 'number' && state.selected == null) state.selected = Number($('#num', root).value);
      lockIn();
    });
    root.querySelectorAll('[data-bet]').forEach((btn) => btn.addEventListener('click', () => { state.bet = Number(btn.dataset.bet); buzz(10); render(); }));
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
    const left = Math.max(0, state.deadline - performance.now());
    bar.style.transform = `scaleX(${left / total})`;
    const s = Math.ceil(left / 1000);
    if (secs.textContent !== String(s)) secs.textContent = s;
    root.classList.toggle('hurry', left < 5000);
    if (left > 0) timerRaf = requestAnimationFrame(tick);
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

  render();
  return { state, net };
}
