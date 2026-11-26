// Game engine: rooms, players, timer, scoring, hints, bots.
// Transport-agnostic. A "conn" is any object with send(obj). The Node server
// wraps WebSockets; the in-browser preview wraps plain function calls.

import {
  QUESTIONS, ROUNDS, ANSWER_SECONDS, STARTING_HINTS, REGULAR_MAX_XP,
  START_MONEY, STREAK_LEN, STREAK_BONUS, BONUS_PRIZE, betOptions, betChoices,
  buildSteps, publicQuestion, pointsFor,
} from './content.js';

const STEPS = buildSteps();
const CLOSE_GRACE_MS = 400;      // network slack after the deadline
const ALL_IN_DELAY_MS = 700;     // pause after the last player locks in
const ROOM_TTL_MS = 8 * 3600e3;

const COLORS = ['#1d5e5f', '#c45a2c', '#d39b2e', '#5f7d66', '#5f9c98', '#8f3b1a', '#94ae96', '#c98b72', '#9c6c14', '#13282b', '#e59a72', '#123f40'];
const BOT_NAMES = ['Mito Chondria', 'Kenny Ketone', 'Gluco Steve', 'Insulin Ivy', 'Lipid Larry', 'Ribo Sue', 'Avo Cado', 'Pan Creas',
  'Lyso Lisa', 'Fatty Acid Fred', 'Quinoa Quinn', 'Zoodle Zoe', 'Granola Greg', 'Honey Bea', 'Beta Cell Bob', 'Liver Liv'];
const BLOCKED = /(fuck|shit|bitch|cunt|nigg|fag|dick|cock|pussy|whore|slut|rape|nazi|hitler|porn|sex)/i;

const qByN = new Map(QUESTIONS.map((q) => [q.n, q]));

function cleanName(raw) {
  let s = String(raw ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, 16).join('');
  return s;
}

export class Hub {
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.setTimeout = opts.setTimeout || ((f, ms) => setTimeout(f, ms));
    this.clearTimeout = opts.clearTimeout || ((t) => clearTimeout(t));
    this.random = opts.random || Math.random;
    this.answerMs = (opts.answerSeconds ?? ANSWER_SECONDS) * 1000;
    this.rushBots = !!opts.rushBots; // demo: once every real player has answered, bots answer at once
    this.rooms = new Map();          // code -> Room
    this.meta = new Map();           // conn -> { room, role, playerId }
  }

  // ---------- connection plumbing ----------
  handle(conn, msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    try {
      if (msg.t === 'ping') return conn.send({ t: 'pong', at: msg.at, serverNow: this.now() });
      if (msg.t === 'host:create') return this.hostCreate(conn, msg.mode);
      if (msg.t === 'host:resume') return this.hostResume(conn, msg);
      if (msg.t === 'join') return this.join(conn, msg);
      const m = this.meta.get(conn);
      if (!m) return conn.send({ t: 'error', code: 'no_session', message: 'Not in a game.' });
      const room = this.rooms.get(m.room);
      if (!room) return conn.send({ t: 'error', code: 'no_room', message: 'That game has ended.' });
      room.lastActive = this.now();
      if (m.role === 'host') return this.hostMsg(room, conn, msg);
      if (m.role === 'player') return this.playerMsg(room, room.players.get(m.playerId), msg);
    } catch (err) {
      conn.send({ t: 'error', code: 'internal', message: 'Something went wrong.' });
      if (typeof console !== 'undefined') console.error(err);
    }
  }

  drop(conn) {
    const m = this.meta.get(conn);
    this.meta.delete(conn);
    if (!m) return;
    const room = this.rooms.get(m.room);
    if (!room) return;
    if (m.role === 'host' && room.host === conn) room.host = null;
    if (m.role === 'player') {
      const p = room.players.get(m.playerId);
      if (p && p.conn === conn) {
        p.conn = null;
        this.sendPlayers(room);
        this.checkAllIn(room);
      }
    }
  }

  sweep() {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActive > ROOM_TTL_MS) {
        if (room.open) this.clearTimeout(room.open.timer);
        this.rooms.delete(code);
      }
    }
  }

  // ---------- host ----------
  newCode() {
    for (let i = 0; i < 500; i++) {
      const code = String(1000 + Math.floor(this.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    return String(10000 + this.rooms.size);
  }

  // mode: 'classroom' (a big screen plus phones) or 'online' (phones only).
  hostCreate(conn, mode) {
    const code = this.newCode();
    const key = Array.from({ length: 4 }, () => Math.floor(this.random() * 2 ** 32).toString(36)).join('');
    const room = {
      code, key, host: conn, mode: mode === 'online' ? 'online' : 'classroom',
      players: new Map(), order: 0, colorIx: 0,
      step: 0, stage: { name: 'lobby' },
      open: null, results: {}, botTimers: [], snaps: {},
      createdAt: this.now(), lastActive: this.now(),
    };
    this.rooms.set(code, room);
    this.meta.set(conn, { room: code, role: 'host' });
    conn.send({ t: 'host:ok', code, key, ...this.hostSnapshot(room) });
    this.sendPlayers(room);
  }

  hostResume(conn, { code, key }) {
    const room = this.rooms.get(String(code));
    if (!room || room.key !== key) return conn.send({ t: 'host:gone' });
    if (room.host && room.host !== conn) {
      room.host.send({ t: 'host:replaced' });
      this.meta.delete(room.host);
    }
    room.host = conn;
    this.meta.set(conn, { room: room.code, role: 'host' });
    conn.send({ t: 'host:ok', code: room.code, key: room.key, ...this.hostSnapshot(room) });
    this.sendPlayers(room);
    if (room.open) conn.send(this.openForHost(room));
  }

  hostSnapshot(room) {
    return {
      content: { rounds: ROUNDS, questions: QUESTIONS, steps: STEPS, answerSeconds: this.answerMs / 1000, maxXp: REGULAR_MAX_XP, hints: STARTING_HINTS },
      step: room.step,
      mode: room.mode,
      stage: room.stage,
      results: room.results,
      open: room.open ? { n: room.open.n, remaining: this.remaining(room), total: this.answerMs } : null,
      serverNow: this.now(),
    };
  }

  hostMsg(room, conn, msg) {
    switch (msg.t) {
      case 'host:stage': {
        const step = Number(msg.step);
        if (Number.isInteger(step) && step >= 0 && step < STEPS.length) room.step = step;
        room.stage = sanitizeStage(msg.stage);
        this.broadcastStage(room);
        return;
      }
      case 'host:open': return this.openQuestion(room, Number(msg.n));
      case 'host:close': return this.closeQuestion(room);
      case 'host:standings': return this.sendStandings(room, msg.round ?? null);
      case 'host:bots': return this.addBots(room, Math.max(0, Math.min(40, Number(msg.n) || 0)));
      case 'host:kick': return this.kick(room, String(msg.id));
      case 'host:restart': return this.restart(room);
      case 'host:hold': return this.hold(room);
      case 'host:unhold': return this.unhold(room);
      case 'host:back': return this.rewind(room, Number(msg.step));
      default: return;
    }
  }

  // What a phone needs to know about the current moment of the show.
  stageFor(room) {
    const s = { ...room.stage, mode: room.mode };
    const q = s.n && qByN.get(s.n);
    if (q) s.question = publicQuestion(q);
    // The explanation goes out only once the answer is revealed.
    if (q && s.name === 'reveal' && q.reveal) s.explain = { scene: q.reveal.scene || null, text: q.reveal.text || null, headline: q.reveal.headline || null };
    if (s.round && ROUNDS.find((r) => r.id === s.round)) {
      const r = ROUNDS.find((x) => x.id === s.round);
      s.roundInfo = { id: r.id, name: r.name, theme: r.theme, tagline: r.tagline, points: r.points, discovery: r.discovery };
    }
    return s;
  }

  broadcastStage(room) {
    const s = this.stageFor(room);
    for (const p of room.players.values()) if (p.conn) p.conn.send({ t: 'stage', stage: s });
    // A finished game tells every phone where it placed.
    if (s.name === 'podium' || s.name === 'finale') this.sendStandings(room, 'final');
  }

  // ---------- players ----------
  join(conn, { code, name, token }) {
    const room = this.rooms.get(String(code ?? '').trim());
    if (!room) return conn.send({ t: 'join:error', code: 'bad_code', message: "We couldn't find a game with that code." });

    // Rejoin with a saved token: same player, same score.
    if (token) {
      for (const p of room.players.values()) {
        if (p.token === token && !p.bot) {
          if (p.conn && p.conn !== conn) { p.conn.send({ t: 'replaced' }); this.meta.delete(p.conn); }
          p.conn = conn;
          this.meta.set(conn, { room: room.code, role: 'player', playerId: p.id });
          this.welcome(room, p, true);
          this.sendPlayers(room);
          return;
        }
      }
    }

    const clean = cleanName(name);
    if (!clean) return conn.send({ t: 'join:error', code: 'name', message: 'Pick a nickname first.' });
    if (BLOCKED.test(clean.replace(/[^a-z]/gi, ''))) return conn.send({ t: 'join:error', code: 'name', message: 'Try a different nickname.' });
    if (room.players.size >= 200) return conn.send({ t: 'join:error', code: 'full', message: 'This game is full.' });

    const taken = new Set([...room.players.values()].map((p) => p.name.toLowerCase()));
    let final = clean;
    for (let i = 2; taken.has(final.toLowerCase()); i++) final = `${clean.slice(0, 13)} ${i}`;

    const p = this.makePlayer(room, final, false);
    p.conn = conn;
    this.meta.set(conn, { room: room.code, role: 'player', playerId: p.id });
    this.welcome(room, p, false);
    this.sendPlayers(room, p.id);
  }

  makePlayer(room, name, bot) {
    const id = 'p' + (++room.order).toString(36) + Math.floor(this.random() * 1e6).toString(36);
    const token = bot ? null : Array.from({ length: 3 }, () => Math.floor(this.random() * 2 ** 32).toString(36)).join('');
    const p = {
      id, name, token, bot, conn: null,
      color: COLORS[room.colorIx++ % COLORS.length],
      score: START_MONEY, streak: 0, hintsLeft: STARTING_HINTS, hintedOn: new Set(), answers: {},
      joinedAt: this.now(), order: room.order,
    };
    room.players.set(id, p);
    return p;
  }

  welcome(room, p, rejoined) {
    p.conn.send({
      t: 'joined', rejoined,
      id: p.id, token: p.token, name: p.name, color: p.color, code: room.code, mode: room.mode,
      score: p.score, hintsLeft: p.hintsLeft, maxXp: REGULAR_MAX_XP,
    });
    this.broadcastStageTo(room, p);
    if (room.open) p.conn.send(this.openForPlayer(room, p));
    else {
      const n = room.stage.n;
      if (n && room.results[n]) p.conn.send(this.resultFor(room, p, n));
    }
  }

  broadcastStageTo(room, p) {
    p.conn.send({ t: 'stage', stage: this.stageFor(room) });
  }

  sendPlayers(room, newId = null) {
    if (!room.host) return;
    const list = [...room.players.values()]
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, connected: !!p.conn || p.bot, bot: p.bot, score: p.score }));
    room.host.send({ t: 'players', list, newId });
  }

  playerMsg(room, p, msg) {
    if (!p) return;
    if (msg.t === 'answer') return this.answer(room, p, msg);
    if (msg.t === 'hint') return this.useHint(room, p, msg);
    if (msg.t === 'leave') {
      room.players.delete(p.id);
      if (p.conn) this.meta.delete(p.conn);
      this.sendPlayers(room);
      this.checkAllIn(room);
    }
  }

  // ---------- questions ----------
  openQuestion(room, n) {
    const q = qByN.get(n);
    if (!q) return;
    if (room.open) this.closeQuestion(room);
    if (room.results[n]) {
      // Already played (host reloaded mid-reveal): just resend the results.
      return room.host && room.host.send({ t: 'results', ...room.results[n] });
    }
    // What everyone had before this question, so Back can undo it.
    room.snaps[n] = new Map([...room.players.values()].map((p) => [p.id, { score: p.score, streak: p.streak, hintsLeft: p.hintsLeft, hinted: [...p.hintedOn] }]));
    const deadline = this.now() + this.answerMs;
    room.open = { n, deadline, timer: this.setTimeout(() => this.closeQuestion(room), this.answerMs + CLOSE_GRACE_MS) };
    room.stage = { name: 'decision', n, round: q.round };
    for (const p of room.players.values()) if (p.conn) p.conn.send(this.openForPlayer(room, p));
    if (room.host) room.host.send(this.openForHost(room));
    this.scheduleBots(room, q);
    this.sendProgress(room);
    if (room.held) this.hold(room);
  }

  remaining(room) {
    if (room.open.heldLeft != null) return room.open.heldLeft;
    return Math.max(0, room.open.deadline - this.now());
  }

  // Test mode pause: freeze the open question's timer, then pick it back up.
  hold(room) {
    room.held = true;
    if (!room.open || room.open.heldLeft != null) return;
    room.open.heldLeft = this.remaining(room);
    this.clearTimeout(room.open.timer);
    const msg = { t: 'timer', n: room.open.n, remaining: room.open.heldLeft, held: true };
    for (const p of room.players.values()) if (p.conn) p.conn.send(msg);
  }

  unhold(room) {
    room.held = false;
    const o = room.open;
    if (!o || o.heldLeft == null) return;
    o.deadline = this.now() + o.heldLeft;
    o.timer = this.setTimeout(() => this.closeQuestion(room), o.heldLeft + CLOSE_GRACE_MS);
    o.heldLeft = null;
    const msg = { t: 'timer', n: o.n, remaining: this.remaining(room) };
    for (const p of room.players.values()) if (p.conn) p.conn.send(msg);
    if (room.host) room.host.send(msg);
  }

  openForHost(room) {
    return { t: 'opened', n: room.open.n, remaining: this.remaining(room), total: this.answerMs, serverNow: this.now() };
  }

  openForPlayer(room, p) {
    const q = qByN.get(room.open.n);
    const a = p.answers[q.n];
    return {
      t: 'open',
      question: publicQuestion(q),
      remaining: this.remaining(room), total: this.answerMs,
      hintsLeft: p.hintsLeft,
      hint: p.hintedOn.has(q.n) ? q.hint : null,
      locked: a ? a.value : null,
      lockedBet: a ? a.bet : null,
      balance: p.score, streak: p.streak,
      bets: q.kind === 'number' ? [] : betChoices(p.score, q.round),
    };
  }

  answer(room, p, { n, value, bet }) {
    if (!room.open || room.open.n !== Number(n)) return p.conn?.send({ t: 'answer:late' });
    const q = qByN.get(room.open.n);
    if (p.answers[q.n]) return; // lock-in is final
    let v = value;
    if (q.kind === 'number') {
      v = Math.round(Number(value));
      if (!Number.isFinite(v)) return;
      v = Math.max(q.min, Math.min(q.max, v));
    } else if (!q.options.some((o) => o.letter === v)) return;
    const b = q.kind === 'number' ? 0 : Number(bet) || 0;
    if (b && !betOptions(p.score, q.round).includes(b)) return p.conn?.send({ t: 'bet:error', message: "That bet isn't available. Pick another amount." });
    p.answers[q.n] = { value: v, bet: b, at: this.now() - (room.open.deadline - this.answerMs) };
    p.conn?.send({ t: 'locked', n: q.n, value: v, bet: b });
    this.sendProgress(room);
    this.checkAllIn(room);
  }

  useHint(room, p, { n }) {
    if (!room.open || room.open.n !== Number(n)) return;
    const q = qByN.get(room.open.n);
    if (!q.hint) return p.conn?.send({ t: 'hint:error', message: 'No hint for this one.' });
    if (p.answers[q.n]) return p.conn?.send({ t: 'hint:error', message: "You've already locked in." });
    if (p.hintedOn.has(q.n)) return p.conn?.send({ t: 'hint', n: q.n, text: q.hint, hintsLeft: p.hintsLeft });
    if (p.hintsLeft <= 0) return p.conn?.send({ t: 'hint:error', message: 'No hints left.' });
    p.hintsLeft -= 1;
    p.hintedOn.add(q.n);
    p.conn?.send({ t: 'hint', n: q.n, text: q.hint, hintsLeft: p.hintsLeft });
  }

  activePlayers(room) {
    return [...room.players.values()].filter((p) => p.bot || p.conn);
  }

  sendProgress(room) {
    if (!room.open || !room.host) return;
    const active = this.activePlayers(room);
    const answered = active.filter((p) => p.answers[room.open.n]).length;
    room.host.send({ t: 'progress', n: room.open.n, answered, total: active.length });
  }

  checkAllIn(room) {
    if (!room.open || room.open.allIn) return;
    this.sendProgress(room);
    const active = this.activePlayers(room);
    if (active.length === 0) return;
    const humans = active.filter((p) => !p.bot);
    if (this.rushBots && humans.length && humans.every((p) => p.answers[room.open.n])) {
      const q = qByN.get(room.open.n);
      active.filter((p) => p.bot && !p.answers[q.n]).forEach((p) => this.botAnswer(room, p, q));
    }
    if (room.open.allIn) return;
    if (active.every((p) => p.answers[room.open.n])) {
      room.open.allIn = true;
      this.clearTimeout(room.open.timer);
      room.open.timer = this.setTimeout(() => this.closeQuestion(room), ALL_IN_DELAY_MS);
    }
  }

  closeQuestion(room) {
    if (!room.open) return;
    const { n, timer } = room.open;
    this.clearTimeout(timer);
    room.botTimers.forEach((t) => this.clearTimeout(t));
    room.botTimers = [];
    room.open = null;
    const q = qByN.get(n);
    const pts = pointsFor(q);

    const counts = {};
    if (q.options) q.options.forEach((o) => (counts[o.letter] = 0));
    let correctCount = 0;
    let answeredCount = 0;
    const guesses = [];

    let wonTotal = 0;
    for (const p of room.players.values()) {
      const a = p.answers[n];
      if (!a) { if (q.kind !== 'number') p.streak = 0; continue; }
      answeredCount++;
      if (q.kind === 'number') {
        a.distance = Math.abs(a.value - q.answer);
        guesses.push({ id: p.id, name: p.name, color: p.color, value: a.value, distance: a.distance });
      } else {
        counts[a.value] = (counts[a.value] || 0) + 1;
        a.correct = a.value === q.answer;
        a.streakBonus = 0;
        if (a.correct) {
          correctCount++;
          p.streak = a.bet > 0 ? p.streak + 1 : 0; // a streak needs a bet on every answer
          if (p.streak >= STREAK_LEN) { a.streakBonus = STREAK_BONUS; p.streak = 0; }
          a.delta = a.bet + a.streakBonus;
        } else {
          p.streak = 0;
          a.delta = -Math.min(a.bet, Math.max(0, p.score)); // never below $0
        }
        p.score += a.delta;
        if (a.delta > 0) wonTotal += a.delta;
      }
    }
    guesses.sort((x, y) => x.distance - y.distance);
    // Bonus: the closest guess wins the prize. Everyone tied for closest wins it too.
    if (q.kind === 'number' && guesses.length) {
      const best = guesses[0].distance;
      for (const g of guesses) {
        const p = room.players.get(g.id);
        const a = p.answers[n];
        a.won = g.distance === best;
        a.delta = a.won ? BONUS_PRIZE : 0;
        g.won = a.won;
        if (a.won) { p.score += BONUS_PRIZE; wonTotal += BONUS_PRIZE; }
      }
    }

    const res = {
      n, correct: q.answer, counts, correctCount, answeredCount,
      playerCount: this.activePlayers(room).length, points: pts, wonTotal,
      guesses: q.kind === 'number' ? guesses.slice(0, 10) : undefined,
    };
    room.results[n] = res;
    room.stage = { name: 'reveal', n, round: q.round };
    if (room.host) room.host.send({ t: 'results', ...res });
    for (const p of room.players.values()) if (p.conn) p.conn.send(this.resultFor(room, p, n));
    this.sendPlayers(room);
  }

  resultFor(room, p, n) {
    const q = qByN.get(n);
    const a = p.answers[n];
    const base = { t: 'result', n, kind: q.kind, score: p.score, answer: q.answer, explanation: q.reveal?.text ?? '' };
    if (q.kind === 'number') {
      return { ...base, value: a ? a.value : null, distance: a ? a.distance : null, won: !!(a && a.won), gained: a ? a.delta || 0 : 0 };
    }
    return { ...base, value: a ? a.value : null, correct: !!(a && a.correct), bet: a ? a.bet : 0, gained: a ? a.delta : 0, streakBonus: a ? a.streakBonus : 0, streak: p.streak };
  }

  // ---------- standings ----------
  standings(room) {
    const bonus = room.results[13] ? 13 : null;
    return [...room.players.values()]
      .map((p) => ({
        id: p.id, name: p.name, color: p.color, score: p.score, bot: p.bot,
        right: QUESTIONS.filter((q) => q.kind !== 'number' && p.answers[q.n]?.correct).length,
        streaks: Object.values(p.answers).filter((a) => a.streakBonus > 0).length,
        hints: STARTING_HINTS - p.hintsLeft,
        bonusWon: !!(p.answers[13] && p.answers[13].won),
        bonus: bonus && p.answers[13] ? p.answers[13].value : null,
        distance: bonus && p.answers[13] ? p.answers[13].distance : Infinity,
        order: p.order,
      }))
      .sort((a, b) => b.score - a.score || a.distance - b.distance || a.order - b.order)
      .map((p, i) => ({ ...p, rank: i + 1, distance: Number.isFinite(p.distance) ? p.distance : null }));
  }

  sendStandings(room, round) {
    const list = this.standings(room);
    if (room.host) room.host.send({ t: 'standings', round, list });
    for (const s of list) {
      const p = room.players.get(s.id);
      if (p?.conn) p.conn.send({ t: 'standing', round, rank: s.rank, of: list.length, score: s.score, final: round === 'final', ...(round === 'final' ? { recap: this.recap(p) } : {}) });
    }
  }

  // How many each player got right in each round (shown only on their own phone).
  recap(p) {
    const rounds = ROUNDS.map((r) => {
      const qs = QUESTIONS.filter((q) => q.round === r.id);
      return { id: r.id, name: r.name, right: qs.filter((q) => p.answers[q.n]?.correct).length, total: qs.length };
    });
    return { rounds, right: rounds.reduce((s, r) => s + r.right, 0), total: rounds.reduce((s, r) => s + r.total, 0) };
  }

  // ---------- bots (practice / rehearsal) ----------
  addBots(room, n) {
    const used = new Set([...room.players.values()].map((p) => p.name));
    const pool = BOT_NAMES.filter((x) => !used.has(x));
    for (let i = 0; i < n; i++) {
      const name = pool.length ? pool.splice(Math.floor(this.random() * pool.length), 1)[0] : `Bot ${room.order + 1}`;
      const p = this.makePlayer(room, name, true);
      p.skill = 0.45 + this.random() * 0.45;
    }
    this.sendPlayers(room);
    if (room.open) this.scheduleBots(room, qByN.get(room.open.n));
  }

  scheduleBots(room, q) {
    for (const p of room.players.values()) {
      if (!p.bot || p.answers[q.n]) continue;
      const delay = 1500 + this.random() * (this.answerMs * 0.8);
      room.botTimers.push(this.setTimeout(() => this.botAnswer(room, p, q), delay));
    }
  }

  botAnswer(room, p, q) {
        if (!room.open || room.open.n !== q.n || !room.players.has(p.id) || p.answers[q.n]) return;
        let value;
        if (q.kind === 'number') value = Math.round(Math.max(0, Math.min(100, 94 - 40 * this.random() + 25 * this.random())));
        else if (this.random() < p.skill) value = q.answer;
        else { const wrong = q.options.filter((o) => o.letter !== q.answer); value = wrong[Math.floor(this.random() * wrong.length)].letter; }
        const opts = betOptions(p.score, q.round);
        const bet = q.kind === 'number' ? 0 : opts[Math.min(opts.length - 1, Math.floor(this.random() * (opts.length + 1)))];
        this.answer(room, p, { n: q.n, value, bet });
  }

  kick(room, id) {
    const p = room.players.get(id);
    if (!p) return;
    room.players.delete(id);
    if (p.conn) { p.conn.send({ t: 'kicked' }); this.meta.delete(p.conn); }
    this.sendPlayers(room);
    this.checkAllIn(room);
  }

  restart(room) {
    if (room.open) { this.clearTimeout(room.open.timer); room.open = null; }
    room.botTimers.forEach((t) => this.clearTimeout(t));
    room.botTimers = [];
    room.results = {};
    room.snaps = {};
    room.step = 0;
    room.stage = { name: 'lobby' };
    for (const p of room.players.values()) {
      p.score = START_MONEY; p.streak = 0; p.hintsLeft = STARTING_HINTS; p.hintedOn = new Set(); p.answers = {};
      if (p.conn) p.conn.send({ t: 'reset', score: START_MONEY, hintsLeft: STARTING_HINTS });
    }
    this.broadcastStage(room);
    if (room.host) room.host.send({ t: 'host:ok', code: room.code, key: room.key, ...this.hostSnapshot(room) });
    this.sendPlayers(room);
  }
}

// Back: undo every question from `step` on (money, streaks, hints, answers)
// and put the game at that step. The host then replays from there.
Hub.prototype.rewind = function rewind(room, step) {
  if (!Number.isInteger(step) || step < 0 || step >= STEPS.length) return;
  if (room.open) { this.clearTimeout(room.open.timer); room.open = null; }
  room.botTimers.forEach((t) => this.clearTimeout(t));
  room.botTimers = [];
  room.held = false;
  const undo = STEPS.slice(step).filter((s) => s.type === 'question').map((s) => s.n);
  const first = undo.find((n) => room.snaps[n]);
  if (first) {
    for (const [id, v] of room.snaps[first]) {
      const p = room.players.get(id);
      if (p) { p.score = v.score; p.streak = v.streak; p.hintsLeft = v.hintsLeft; p.hintedOn = new Set(v.hinted); }
    }
  }
  for (const n of undo) {
    delete room.results[n]; delete room.snaps[n];
    for (const p of room.players.values()) delete p.answers[n];
  }
  const s = STEPS[step];
  room.step = step;
  room.stage = s.type === 'question' ? { name: 'watch', n: s.n, round: qByN.get(s.n)?.round } : { name: s.type, ...(s.round ? { round: s.round } : {}) };
  for (const p of room.players.values()) if (p.conn) p.conn.send({ t: 'rewind', score: p.score, hintsLeft: p.hintsLeft });
  this.broadcastStage(room);
  this.sendPlayers(room);
  if (room.host) room.host.send({ t: 'host:rewound', step });
};

function sanitizeStage(s) {
  const out = { name: 'lobby' };
  if (!s || typeof s !== 'object') return out;
  const names = ['lobby', 'howto', 'roundIntro', 'watch', 'decision', 'reveal', 'discovery', 'leaderboard', 'bonusIntro', 'podium', 'finale'];
  if (names.includes(s.name)) out.name = s.name;
  if (Number.isInteger(s.n) && qByN.has(s.n)) out.n = s.n;
  if (Number.isInteger(s.round) && s.round >= 1 && s.round <= 3) out.round = s.round;
  if (s.round === 'bonus') out.round = 'bonus';
  if (Number.isInteger(s.beat) && s.beat >= -1 && s.beat < 10) out.beat = s.beat;
  if (typeof s.letter === 'string' && /^[A-E]$|^(HIGH|LOW)$/.test(s.letter)) out.letter = s.letter;
  return out;
}
