// Tour mode: the whole big-screen board with no game running. Glide stop by
// stop (arrow keys or buttons), or zoom out and click any part of the board.
// Every stop plays its own animation, so scenes can be reviewed one by one.

import { Camera } from './camera.js';
import { buildWorld, zoneEl, HOWTO_BEATS } from './world.js';

const SAMPLE = [
  ['Insulin Ivy', '#1d5e5f', 385000], ['Kenny Ketone', '#c45a2c', 310000], ['Lyso Lisa', '#d39b2e', 245000],
  ['Mito Chondria', '#5f7d66', 160000], ['Gluco Steve', '#5f9c98', 95000],
];

export function mountTour(root, content, opts = {}) {
  const { questions, rounds } = content;
  root.classList.add('he-host', 'he-tour');
  root.innerHTML = `
    <div class="viewport" id="tour-viewport"><div class="world" id="tour-world"></div></div>
    <nav class="tour-bar" aria-label="Tour controls">
      <button class="tour-btn" data-t="all" title="See the whole board (Esc)">Whole board</button>
      <button class="tour-btn icon" data-t="prev" title="Previous (←)" aria-label="Previous">←</button>
      <p class="tour-label"><b></b><span></span></p>
      <button class="tour-btn icon" data-t="next" title="Next (→)" aria-label="Next">→</button>
      <button class="tour-btn" data-t="replay" title="Replay the animation (R)">Replay</button>
      ${opts.onPlay ? '<button class="tour-btn play" data-t="play" title="Play the real show from this screen, with timing">&#9654; Play from here</button>' : ''}
      ${opts.onClose ? '<button class="tour-btn close" data-t="close">Back to the game</button>' : ''}
    </nav>`;
  const world = root.querySelector('#tour-world');
  const zones = buildWorld(world, content);
  const cam = new Camera(root.querySelector('#tour-viewport'), world);
  const base = new Map([...world.querySelectorAll('.zone')].map((z) => [z, z.className]));
  const frame = (id, m = 0.04) => cam.frame(zones[id], m);
  const qOf = (n) => questions.find((q) => q.n === n);

  // Fill the parts the live game fills with real players.
  world.querySelector('#join-code').textContent = '4821';
  world.querySelector('#join-url').textContent = 'your-quiz-site/join';
  world.querySelector('#waiting').textContent = 'Players appear here as they join';
  world.querySelector('#names').innerHTML = SAMPLE.map(([n, c]) => `<li><i style="--c:${c}"></i><span>${n}</span></li>`).join('');
  world.querySelectorAll('.lb-rows').forEach((ol) => {
    ol.innerHTML = SAMPLE.map(([n, c, s], i) => `<li style="--i:${i}"><b class="rk">${i + 1}</b><i style="--c:${c}"></i><span>${n}</span><em>$${s.toLocaleString('en-US')}</em><small></small></li>`).join('');
  });
  ['s1', 's2', 's3'].forEach((cls, i) => {
    const [n, c, s] = SAMPLE[i];
    const who = world.querySelector(`.podium .${cls} .who`);
    if (who) who.innerHTML = `<i style="--c:${c}"></i><span>${n}</span><em>$${s.toLocaleString('en-US')}</em>`;
  });
  world.querySelectorAll('.reveal-stats').forEach((p) => (p.textContent = '5 of 8 got it right · sample numbers'));
  const guesses = world.querySelector('#guesses');
  if (guesses) guesses.innerHTML = SAMPLE.map(([n, c], i) => `<li class="${i ? '' : 'won'}"><i style="--c:${c}"></i><span>${n}</span><b>${[95, 90, 89, 85, 76][i]}%</b>${i ? '' : '<em>+$300,000</em>'}</li>`).join('');

  // ---------- the stops ----------
  const stops = [];
  const add = (zone, label, sub, rect, setup = () => {}) => stops.push({ zone, label, sub, rect, setup });
  const mark = (el, answer, all) => el.querySelectorAll('[data-letter]').forEach((p) => {
    const right = p.dataset.letter === answer;
    const part = !!all && answer === all && !right;
    p.classList.toggle('right', right); p.classList.toggle('part', part); p.classList.toggle('wrong', !right && !part);
  });

  add('lobby', 'Lobby', 'Home screen and join card', 'lobby', (el) => el.classList.add('intro'));
  HOWTO_BEATS.forEach((b, i) => add('howto', 'How to play', b.lines.join(' '), `howto${i}`, (el) => {
    el.querySelectorAll('.beat').forEach((x, j) => { x.classList.remove('off'); x.classList.toggle('on', j === i); });
  }));
  for (const r of rounds) {
    add(`round${r.id}`, `Round ${r.id}`, r.name, `round${r.id}`);
    for (const q of questions.filter((x) => x.round === r.id)) {
      const z = `q${q.n}`;
      const name = `Question ${q.n}`;
      if (q.kind === 'binary') {
        add(z, name, `${q.title}: close-up`, `${z}plate`, (el) => el.classList.add('enter', 'named'));
        add(z, name, `${q.title}: the choice`, z, (el) => el.classList.add('enter', 'named', 'overview', 'all-in'));
        add(z, name, `${q.title}: the answer`, z, (el) => { el.classList.add('enter', 'named', 'overview', 'all-in', 'revealed', 'callouts-on'); mark(el, q.answer); });
      } else {
        add(z, name, 'The question', `${z}title`, (el) => el.classList.add('show-title'));
        for (const o of q.options.filter((x) => !x.all)) {
          add(z, name, `Answer ${o.letter}: ${o.text}`, `${z}${o.letter}`, (el) => {
            el.classList.add('show-title');
            el.querySelectorAll('.panel').forEach((p) => p.classList.add('in'));
            el.querySelector(`.panel[data-letter="${o.letter}"]`).classList.add('play');
          });
        }
        add(z, name, 'All answers, time to choose', z, (el) => el.classList.add('show-title', 'overview', 'all-in'));
        add(z, name, 'The right answer', z, (el) => { el.classList.add('show-title', 'overview', 'all-in', 'revealed'); mark(el, q.answer, q.options.find((o) => o.all)?.letter); });
        add(`r${q.n}`, name, 'The answer, explained', `r${q.n}`, (el) => el.classList.add('play'));
      }
    }
    add(`disc${r.id}`, `Round ${r.id}`, 'Round discovery', `disc${r.id}`);
    if (zones[`lb${r.id}`]) add(`lb${r.id}`, `Round ${r.id}`, 'Leaderboard (sample players)', `lb${r.id}`, (el) => el.classList.add('play'));
  }
  const bonus = questions.find((q) => q.kind === 'number');
  add('bonusIntro', 'Final bonus', 'Intro', 'bonusIntro');
  add('q13', 'Final bonus', 'The question', 'q13', (el) => el.classList.add('overview', 'all-in'));
  add('q13', 'Final bonus', 'The answer (sample guesses)', 'q13', (el) => {
    el.classList.add('overview', 'all-in', 'revealed', 'foot-on');
    el.querySelector('#pct-num').textContent = bonus.answer;
    el.querySelectorAll('#people i').forEach((p, i) => p.classList.toggle('on', i < bonus.answer));
  });
  add('podium', 'Podium', 'The winners (sample players)', 'podium', (el) => el.querySelectorAll('.step').forEach((s) => s.classList.add('up')));

  // ---------- moving ----------
  let at = -1;
  let current = null;
  const reset = (el) => {
    el.className = base.get(el);
    el.querySelectorAll('.play, .in, .right, .wrong, .up, .on').forEach((n) => n.classList.remove('play', 'in', 'right', 'wrong', 'up', 'on'));
  };
  // The whole-board view shows every zone in its finished, still state.
  let full = false;
  function showAll() {
    full = true;
    base.forEach((_, z) => { z.classList.add('enter', 'named', 'show-title', 'overview', 'all-in', 'settled'); z.querySelectorAll('.panel').forEach((p) => p.classList.add('in')); });
    world.querySelectorAll('.podium .step').forEach((st) => st.classList.add('up'));
    world.querySelectorAll('.z-lb').forEach((z) => z.classList.add('play'));
  }
  function apply(stop) {
    if (full) { base.forEach((_, z) => reset(z)); full = false; }
    if (current) reset(current);
    const el = zoneEl(stop.zone, world);
    reset(el);
    void el.offsetWidth; // restart CSS animations
    el.classList.add('live');
    stop.setup(el);
    current = el;
  }
  function label(text, sub) {
    root.querySelector('.tour-label b').textContent = text;
    root.querySelector('.tour-label span').textContent = sub;
  }
  async function go(i, how) {
    if (i < 0 || i >= stops.length) return;
    const prev = stops[at];
    at = i;
    const s = stops[i];
    label(`${i + 1} / ${stops.length} · ${s.label}`, s.sub);
    const target = frame(s.rect, s.rect.length > 4 && /[A-D]$/.test(s.rect) ? 0.07 : 0.04);
    const near = prev && prev.zone === s.zone;
    if (how === 'jump') { apply(s); await cam.fly(target); return; }
    if (near) { apply(s); await cam.whoosh(target, 900); return; }
    await cam.fly(target);
    if (at === i) apply(s);
  }
  async function overview() {
    if (current) { reset(current); current = null; }
    showAll();
    at = -1;
    label(`${stops.length} stops`, 'Click any part of the board to zoom in. Use the arrows to glide.');
    await cam.fly(frame('all', 0.02));
  }

  root.querySelector('.tour-bar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (t === 'next') go(at + 1);
    else if (t === 'prev') go(Math.max(0, at - 1));
    else if (t === 'all') overview();
    else if (t === 'replay' && at >= 0) apply(stops[at]);
    else if (t === 'close') opts.onClose();
    else if (t === 'play') opts.onPlay(stepFor(at >= 0 ? stops[at].zone : 'lobby'));
  });
  // Which step of the real show a board zone belongs to.
  function stepFor(zone) {
    const steps = content.steps || [];
    const m = zone.match(/^(lobby|howto|round|q|r|disc|lb|bonusIntro|podium)(\d*)/);
    if (!m) return 0;
    const [, k, d] = m; const n = Number(d);
    const i = steps.findIndex((s) =>
      (k === 'lobby' && s.type === 'lobby') || (k === 'howto' && s.type === 'howto') ||
      (k === 'round' && s.type === 'roundIntro' && s.round === n) ||
      ((k === 'q' || k === 'r') && s.type === 'question' && s.n === n) ||
      (k === 'disc' && s.type === 'discovery' && s.round === n) ||
      (k === 'lb' && s.type === 'leaderboard' && s.round === n) ||
      (k === 'bonusIntro' && s.type === 'bonusIntro') || (k === 'podium' && s.type === 'podium'));
    return Math.max(0, i);
  }
  // Click on the board: jump to the nearest stop in that zone.
  world.addEventListener('click', (e) => {
    const z = e.target.closest('.zone');
    if (!z) return;
    const id = z.id.slice(2);
    let i = stops.findIndex((s) => s.zone === id);
    // Inside a question zone, a click on a panel goes straight to that answer.
    const letter = e.target.closest('.panel')?.dataset.letter;
    if (letter) i = stops.findIndex((s) => s.rect === `${id}${letter}`);
    if (i >= 0 && i !== at) go(i, 'jump');
  });
  const onKey = (e) => {
    if (!root.isConnected || root.closest('[hidden]')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === ' ') go(at + 1);
    else if (k === 'ArrowLeft') go(Math.max(0, at - 1));
    else if (k === 'Escape') overview();
    else if (k === 'r' || k === 'R') { if (at >= 0) apply(stops[at]); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', onKey, true);

  cam.set(frame('all', 0.02));
  overview();
  return { go, overview, stops, destroy() { window.removeEventListener('keydown', onKey, true); cam.ro.disconnect(); } };
}
