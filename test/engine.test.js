import test from 'node:test';
import assert from 'node:assert/strict';
import { Hub } from '../shared/engine.js';
import { QUESTIONS, START_MONEY, betOptions } from '../shared/content.js';

// Deterministic clock + timers.
function fakeTime() {
  let now = 1_000_000;
  let timers = [];
  let id = 0;
  return {
    now: () => now,
    setTimeout: (f, ms) => { const t = { id: ++id, at: now + ms, f }; timers.push(t); return t.id; },
    clearTimeout: (tid) => { timers = timers.filter((t) => t.id !== tid); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const t = timers[0];
        if (!t || t.at > end) break;
        timers.shift();
        now = t.at;
        t.f();
      }
      now = end;
    },
  };
}

function client() {
  const c = { inbox: [], send(m) { c.inbox.push(m); }, last(t) { return [...c.inbox].reverse().find((m) => m.t === t); }, all(t) { return c.inbox.filter((m) => m.t === t); } };
  return c;
}

function setup(nPlayers = 3) {
  const clock = fakeTime();
  let seed = 7;
  const hub = new Hub({ ...clock, random: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) });
  const host = client();
  hub.handle(host, { t: 'host:create' });
  const { code, key } = host.last('host:ok');
  const players = [];
  for (let i = 0; i < nPlayers; i++) {
    const p = client();
    hub.handle(p, { t: 'join', code, name: `Player ${i + 1}` });
    players.push(p);
  }
  return { hub, host, players, code, key, clock };
}

test('players join with a nickname only and appear on the host screen', () => {
  const { host, players } = setup(3);
  const list = host.last('players').list;
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((p) => p.name), ['Player 1', 'Player 2', 'Player 3']);
  assert.ok(players[0].last('joined').token);
});

test('duplicate nicknames get a number, bad codes and blank names are refused', () => {
  const { hub, code, host } = setup(0);
  const a = client(), b = client(), c = client(), d = client();
  hub.handle(a, { t: 'join', code, name: 'Sam' });
  hub.handle(b, { t: 'join', code, name: 'sam' });
  hub.handle(c, { t: 'join', code: '0000', name: 'X' });
  hub.handle(d, { t: 'join', code, name: '   ' });
  assert.equal(b.last('joined').name, 'sam 2');
  assert.equal(c.last('join:error').code, 'bad_code');
  assert.equal(d.last('join:error').code, 'name');
  assert.equal(host.last('players').list.length, 2);
});

test('betting: a doubling chip capped per round, streak bonus every 3 in a row with bets', () => {
  assert.deepEqual(betOptions(100_000, 1), [0, 10_000, 20_000, 40_000]);
  assert.deepEqual(betOptions(100_000, 2), [0, 10_000, 20_000, 40_000, 80_000]);
  assert.deepEqual(betOptions(100_000, 3), [0, 10_000, 20_000, 40_000, 80_000]);
  assert.deepEqual(betOptions(300_000, 3), [0, 10_000, 20_000, 40_000, 80_000, 160_000]);
  assert.deepEqual(betOptions(3_000, 1), [0, 10_000]);
  const { hub, host, players, clock } = setup(2);
  const [a, b] = players;
  assert.equal(a.last('joined').score, START_MONEY);
  // Q5 right with 40K, Q6 right with no bet (a streak needs a bet, so it breaks),
  // then Q7 (80K), Q8 (10K) and Q9 (20K) right: three in a row pays 100K.
  const plays = [[5, 3], [6, 0], [7, 4], [8, 1], [9, 2]];
  let aScore = START_MONEY, bScore = START_MONEY;
  for (const [n, idx] of plays) {
    const r = QUESTIONS[n - 1].round, bet = betOptions(aScore, r)[idx], bBet = betOptions(bScore, r)[1];
    hub.handle(host, { t: 'host:open', n });
    hub.handle(a, { t: 'answer', n, value: QUESTIONS[n - 1].answer, bet });
    hub.handle(b, { t: 'answer', n, value: 'C', bet: bBet });
    clock.advance(1_000);
    aScore += bet; bScore -= bBet;
    if (n === 7) assert.equal(a.last('result').streakBonus, 0);
  }
  assert.equal(a.last('result').streakBonus, 100_000);
  assert.equal(a.last('result').score, aScore + 100_000);
  assert.equal(a.last('result').score, 350_000);
  assert.equal(b.last('result').score, 50_000);
  // A bet that is not on the chip ladder is refused.
  hub.handle(host, { t: 'host:open', n: 10 });
  hub.handle(b, { t: 'answer', n: 10, value: 'A', bet: 50_000 });
  assert.equal(b.last('bet:error').t, 'bet:error');
});

test('the timer closes the question after 20 seconds', () => {
  const { hub, host, players, clock } = setup(2);
  hub.handle(host, { t: 'host:open', n: 5 });
  hub.handle(players[0], { t: 'answer', n: 5, value: 'B' });
  clock.advance(19_000);
  assert.equal(host.all('results').length, 0);
  clock.advance(2_000);
  const r = host.last('results');
  assert.equal(r.correct, 'A');
  assert.equal(r.counts.B, 1);
  assert.equal(players[0].last('result').correct, false);
  assert.equal(players[1].last('result').value, null);
  // Late answers are ignored.
  hub.handle(players[1], { t: 'answer', n: 5, value: 'A' });
  assert.equal(players[1].last('answer:late').t, 'answer:late');
});

test('the question closes early once everyone has locked in', () => {
  const { hub, host, players, clock } = setup(2);
  hub.handle(host, { t: 'host:open', n: 6 });
  players.forEach((p) => hub.handle(p, { t: 'answer', n: 6, value: 'B' }));
  clock.advance(1000);
  assert.equal(host.last('results').correctCount, 2);
  assert.equal(players[0].last('result').gained, 0, 'no bet, no change');
});

test('lock-in is final', () => {
  const { hub, host, players, clock } = setup(1);
  hub.handle(host, { t: 'host:open', n: 7 });
  hub.handle(players[0], { t: 'answer', n: 7, value: 'A' });
  hub.handle(players[0], { t: 'answer', n: 7, value: 'C' });
  clock.advance(1000);
  assert.equal(players[0].last('result').value, 'A');
});

test('hints: two per game, one per question, private, no point penalty', () => {
  const { hub, host, players, clock } = setup(2);
  const [p, other] = players;
  for (const n of [5, 6, 7]) {
    hub.handle(host, { t: 'host:open', n });
    hub.handle(p, { t: 'hint', n });
    hub.handle(p, { t: 'hint', n }); // second ask on same question costs nothing
    if (n < 7) hub.handle(p, { t: 'answer', n, value: QUESTIONS[n - 1].answer });
    clock.advance(21_000);
  }
  const hints = p.all('hint');
  assert.equal(hints[0].text, QUESTIONS[4].hint);
  assert.equal(hints[0].hintsLeft, 1);
  assert.equal(hints[2].hintsLeft, 0);
  assert.equal(p.last('hint:error').message, 'No hints left.');
  assert.equal(other.all('hint').length, 0, 'hint never reaches other players');
  assert.equal(host.all('hint').length, 0, 'hint never reaches the host screen');
  assert.equal(p.last('result').score, START_MONEY, 'no penalty for hints');
});

test('phones never receive the correct answer before the reveal', () => {
  const { hub, host, players } = setup(1);
  hub.handle(host, { t: 'host:stage', step: 3, stage: { name: 'watch', n: 5, letter: 'A' } });
  hub.handle(host, { t: 'host:open', n: 5 });
  const seen = JSON.stringify(players[0].inbox);
  assert.ok(!seen.includes('"answer"'));
  assert.ok(!seen.includes(QUESTIONS[4].hint));
  assert.ok(!seen.includes(QUESTIONS[4].reveal.text));
});

test('bonus: the closest guess wins $300,000, and the phone gets a per-round recap', () => {
  const { hub, host, players, clock } = setup(3);
  const [a, b, c] = players;
  hub.handle(host, { t: 'host:open', n: 5 });
  [a, b].forEach((p) => hub.handle(p, { t: 'answer', n: 5, value: 'A', bet: 10_000 }));
  hub.handle(c, { t: 'answer', n: 5, value: 'D' });
  clock.advance(1000);
  hub.handle(host, { t: 'host:open', n: 13 });
  hub.handle(a, { t: 'answer', n: 13, value: 60 });
  hub.handle(b, { t: 'answer', n: 13, value: 91 });
  hub.handle(c, { t: 'answer', n: 13, value: 94 });
  clock.advance(1000);
  const res = host.last('results');
  assert.deepEqual(res.guesses.map((g) => g.value), [94, 91, 60]);
  assert.deepEqual(res.guesses.map((g) => g.won), [true, false, false]);
  assert.equal(c.last('result').gained, 300_000);
  hub.handle(host, { t: 'host:standings', round: 'final' });
  const list = host.last('standings').list;
  assert.deepEqual(list.map((x) => x.name), ['Player 3', 'Player 2', 'Player 1']);
  assert.deepEqual(list.map((x) => x.score), [400_000, 110_000, 110_000]);
  const recap = a.last('standing').recap;
  assert.deepEqual(recap.rounds.map((r) => r.right), [0, 1, 0]);
  assert.equal(recap.right, 1);
  assert.equal(recap.total, 12);
});

test('bonus: a perfect tie pays everyone tied', () => {
  const { hub, host, players, clock } = setup(2);
  const [a, b] = players;
  hub.handle(host, { t: 'host:open', n: 13 });
  hub.handle(a, { t: 'answer', n: 13, value: 90 });
  hub.handle(b, { t: 'answer', n: 13, value: 98 });
  clock.advance(1000);
  assert.equal(a.last('result').score, 400_000);
  assert.equal(b.last('result').score, 400_000);
});

test('a phone that reloads rejoins with the same score', () => {
  const { hub, host, players, code, clock } = setup(1);
  hub.handle(host, { t: 'host:open', n: 9 });
  hub.handle(players[0], { t: 'answer', n: 9, value: 'B', bet: 20_000 });
  clock.advance(1000);
  const token = players[0].last('joined').token;
  hub.drop(players[0]);
  const again = client();
  hub.handle(again, { t: 'join', code, token });
  assert.equal(again.last('joined').score, 120_000);
  assert.equal(again.last('joined').rejoined, true);
  assert.equal(host.last('players').list.length, 1);
});

test('a reloaded host resumes the same game', () => {
  const { hub, host, code, key } = setup(2);
  hub.handle(host, { t: 'host:stage', step: 4, stage: { name: 'watch', n: 2 } });
  hub.drop(host);
  const h2 = client();
  hub.handle(h2, { t: 'host:resume', code, key });
  const ok = h2.last('host:ok');
  assert.equal(ok.step, 4);
  assert.equal(h2.last('players').list.length, 2);
  const bad = client();
  hub.handle(bad, { t: 'host:resume', code, key: 'nope' });
  assert.equal(bad.last('host:gone').t, 'host:gone');
});

test('practice bots answer on their own and a disconnected phone does not block the round', () => {
  const { hub, host, players, clock } = setup(1);
  hub.handle(host, { t: 'host:bots', n: 6 });
  assert.equal(host.last('players').list.length, 7);
  hub.handle(host, { t: 'host:open', n: 10 });
  hub.drop(players[0]);
  clock.advance(17_000);
  const r = host.last('results');
  assert.ok(r, 'closed early because all remaining players answered');
  assert.equal(r.answeredCount, 6);
});

test('a full game can be played step by step', () => {
  const { hub, host, players, clock } = setup(4);
  hub.handle(host, { t: 'host:bots', n: 10 });
  const steps = host.last('host:ok').content.steps;
  steps.forEach((s, i) => {
    hub.handle(host, { t: 'host:stage', step: i, stage: { name: s.type === 'question' ? 'watch' : s.type, n: s.n, round: s.round } });
    if (s.type === 'question') {
      hub.handle(host, { t: 'host:open', n: s.n });
      const q = QUESTIONS[s.n - 1];
      players.forEach((p, k) => hub.handle(p, { t: 'answer', n: s.n, value: q.kind === 'number' ? 90 + k : (k % 2 ? q.answer : q.options[0].letter) }));
      clock.advance(21_000);
    }
    if (s.type === 'leaderboard') hub.handle(host, { t: 'host:standings', round: s.round });
  });
  const final = players.map((p) => p.last('standing'));
  assert.ok(final.every((s) => s.final));
  assert.equal(new Set(final.map((s) => s.rank)).size, 4);
});

test('pause holds the answer timer and resumes with the time that was left', () => {
  const { hub, host, players, clock } = setup(2);
  hub.handle(host, { t: 'host:open', n: 5 });
  clock.advance(5_000);
  hub.handle(host, { t: 'host:hold' });
  assert.equal(players[0].last('timer').held, true);
  assert.equal(players[0].last('timer').remaining, 15_000);
  clock.advance(60_000);
  assert.equal(host.all('results').length, 0);
  hub.handle(host, { t: 'host:unhold' });
  assert.equal(host.last('timer').remaining, 15_000);
  clock.advance(14_000);
  assert.equal(host.all('results').length, 0);
  clock.advance(2_000);
  assert.equal(host.all('results').length, 1);
});

test('a broke player gets a comeback bet that never takes them below $0', async () => {
  const { betChoices, COMEBACK_BET } = await import('../shared/content.js');
  assert.deepEqual(betChoices(0, 1).map((c) => c.amount), [0, COMEBACK_BET]);
  assert.ok(betChoices(0, 1)[1].comeback);
  assert.ok(!betChoices(100000, 1).some((c) => c.comeback));
});
