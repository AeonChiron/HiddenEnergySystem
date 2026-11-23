// Builds the one continuous whiteboard: every scene of the show is a zone
// placed somewhere on the same canvas. Returns zone rects for the camera and
// element handles for the director.

import { art, foodArt, artDefs } from '../art/index.js';
import { logoMark } from '../art/world.js';
import { paperGround } from '../art/kit.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Where each reveal callout points on the meal photo (percent of the cutout).
// Side: where the label sits (l, r, t = above, b = below the ring).
const CALLOUTS = {
  acai: [[17, 58, 'b'], [36, 33, 't'], [64, 62, 'r']],
  burger: [[44, 16, 't'], [13, 82, 'b']],
  quinoa: [[50, 28, 'r'], [22, 34, 'l'], [70, 76, 'r']],
  alfredo: [[82, 30, 't'], [42, 60, 'b']],
};

// Layout constants (world px).
const Q_W = 1800, Q_H = 1000;       // question overview
const PANEL_W = 420, PANEL_H = 560, PANEL_GAP = 40;
const PANELS_X = (Q_W - (3 * PANEL_W + 2 * PANEL_GAP)) / 2; // three answers, centred
const ROW_GAP = 900;
const ZONE_GAP = 700;

export function buildWorld(worldEl, content) {
  const { rounds, questions } = content;
  const zones = {};
  let html = '';

  const place = (id, x, y, w, h, inner, cls = '') => {
    zones[id] = { id, x, y, w, h };
    html += `<section class="zone ${cls}" id="z-${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${inner}</section>`;
  };

  // Row 0: lobby
  place('lobby', 0, 0, 1920, 1080, lobbyHTML(), 'z-lobby');
  place('howto', 1920 + ZONE_GAP, 0, 1920, 1080, howtoHTML(), 'z-howto');

  let y = 1080 + ROW_GAP;
  for (const r of rounds) {
    let x = 0;
    const qs = questions.filter((q) => q.round === r.id);
    place(`round${r.id}`, x, y, 1920, 1080, roundIntroHTML(r), `z-round z-round${r.id}`);
    x += 1920 + ZONE_GAP;
    for (const q of qs) {
      if (q.kind === 'binary') { place(`q${q.n}`, x, y, Q_W, Q_H, foodHTML(q), 'z-food'); }
      else { place(`q${q.n}`, x, y, Q_W, Q_H, mcHTML(q), 'z-mc'); place(`r${q.n}`, x, y + Q_H + 160, Q_W, 860, revealHTML(q), 'z-reveal'); }
      x += Q_W + ZONE_GAP;
    }
    place(`disc${r.id}`, x, y, 1920, 1080, discoveryHTML(r), 'z-disc');
    place(`lb${r.id}`, x, y + 1080 + 160, 1920, 1080, leaderboardHTML(r), 'z-lb');
    y += (r.id === 1 ? 1080 : 1080 + 160 + 1080) + ROW_GAP;
  }

  const bonus = questions.find((q) => q.kind === 'number');
  place('bonusIntro', 0, y, 1920, 1080, bonusIntroHTML(bonus), 'z-bonusintro');
  place('q13', 1920 + ZONE_GAP, y, 1920, 1080, bonusHTML(bonus), 'z-bonus');
  place('podium', (1920 + ZONE_GAP) * 2, y, 1920, 1080, podiumHTML(), 'z-podium');

  worldEl.innerHTML = artDefs() + html;

  // Bounds of the whole journey, for the final zoom-out.
  const all = Object.values(zones);
  const minX = Math.min(...all.map((z) => z.x)), minY = Math.min(...all.map((z) => z.y));
  const maxX = Math.max(...all.map((z) => z.x + z.w)), maxY = Math.max(...all.map((z) => z.y + z.h));
  zones.all = { id: 'all', x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  // Sub-rects the camera frames inside a question zone.
  for (const q of questions) {
    const z = zones[`q${q.n}`];
    if (q.kind === 'mc') {
      zones[`q${q.n}title`] = { x: z.x + 150, y: z.y, w: Q_W - 300, h: 260 };
      q.options.filter((o) => !o.all).forEach(({ letter: L }, i) => {
        zones[`q${q.n}${L}`] = { x: z.x + PANELS_X + i * (PANEL_W + PANEL_GAP), y: z.y + 200, w: PANEL_W, h: PANEL_H };
      });
    }
    if (q.kind === 'binary') zones[`q${q.n}plate`] = { x: z.x, y: z.y, w: Q_W, h: Q_H };
  }

  return zones;
}

export const zoneEl = (id, scope = document) => scope.querySelector(`#z-${id}`);

// ---------- zone templates ----------
function howtoHTML() {
  const cards = [
    ['1', 'Answer on your phone', 'Pick an answer before the 20 seconds run out.'],
    ['$', 'Bet to win money', 'You start with $100,000. Bet 10%, 15%, 25% or 50% of your money on each answer. Right, you win it. Wrong, you lose it.'],
    ['3', 'Three in a row', 'Three right answers in a row, each with a bet, pay a $50,000 bonus.'],
    ['?', 'Two hints', 'You get 2 hints for the whole game. Only you see them.'],
  ];
  return `
    <div class="howto">
      <p class="kicker">How it works</p>
      <h2 class="howto-title">Three rounds. One bonus. The richest player wins.</h2>
      <p class="howto-rounds"><span>Food</span><i></i><span>Energy</span><i></i><span>Repair</span><i></i><span class="b">Bonus: closest guess wins $300,000</span></p>
      <ol class="howto-cards">${cards.map(([k, h, t], i) => `<li style="--i:${i}"><b>${k}</b><h3>${h}</h3><p>${t}</p></li>`).join('')}</ol>
    </div>`;
}

function lobbyHTML() {
  return `
    <div class="lobby">
      <aside class="about">
        <h3>What did you catch from the video?</h3>
        <p>You just watched the video. Now test what you learned in a live quiz with everyone in the room.</p>
        <ul>
          <li><b>Three rounds, one winner</b><span>Food, energy, then repair. The richest player wins.</span></li>
          <li><b>Bet on what you know</b><span>Everyone starts with $100,000. The surer you are, the more you bet.</span></li>
          <li><b>Two private hints</b><span>Only you see them. Once they're gone, they're gone.</span></li>
        </ul>
      </aside>
      <div class="lobby-center">
        <div class="lobby-title">
          <div class="mark">${logoMark()}</div>
          <h1 class="logo"><span>The Hidden</span>Energy System</h1>
        </div>
        <p class="live-pill"><i></i>Live multiplayer quiz</p>
        <div class="lobby-join">
          <div class="qr" id="qr" aria-label="QR code to join"></div>
          <div class="join-info">
            <p class="join-head">Join the challenge</p>
            <p class="join-url"><span id="join-url"></span></p>
            <p class="join-code">Game code <b id="join-code">····</b></p>
            <p class="join-steps">Scan · Choose a nickname · Play</p>
          </div>
        </div>
        <div class="lobby-players">
          <p class="waiting" id="waiting">Waiting for players...</p>
          <ul class="names" id="names"></ul>
        </div>
      </div>
      <div class="lobby-art">${art('lobby')}</div>
    </div>`;
}

function roundIntroHTML(r) {
  return `
    <div class="round-intro">
      <div class="round-art">${art(`round${r.id}`)}</div>
      <p class="kicker">Round ${r.id} · ${esc(r.theme)}</p>
      <h2 class="round-name">${esc(r.name)}</h2>
      <p class="round-tag">${esc(r.tagline)}</p>
      <p class="round-pts">Bet up to 50% of your money on each answer</p>
    </div>`;
}

function foodHTML(q) {
  return `
    <div class="food">
      <div class="plate" data-food="${q.food}">
        <div class="photo-box">${foodArt(q.food)}
        <ul class="callouts">${q.reveal.callouts.map((c, i) => { const [x, y, side] = (CALLOUTS[q.food] || [])[i] || [50, 50, 'r']; return `<li class="callout c${i} side-${side}" style="--x:${x}%;--y:${y}%"><i class="ring"></i><span>${esc(c)}</span></li>`; }).join('')}</ul></div>
      </div>
      <div class="food-side">
        <p class="food-num">${String(q.n).padStart(2, '0')}</p>
        <h3 class="food-title">${esc(q.title)}</h3>
        <p class="food-cap">${esc(q.caption)}</p>
        <p class="food-prompt">${esc(q.prompt)}</p>
        <div class="chips">
          ${q.options.map((o) => `<div class="chip l-${o.letter}" data-letter="${o.letter}"><span>${esc(o.text)}</span><i class="count"></i></div>`).join('')}
        </div>
        <p class="food-reveal">${esc(q.reveal.text)}</p>
      </div>
    </div>`;
}

function mcHTML(q) {
  const four = q.options.filter((o) => !o.all);
  const e = q.options.find((o) => o.all);
  return `
    <div class="mc">
      <h3 class="q-title">${esc(q.prompt)}</h3>
      <div class="panels">
        ${four.map((o) => `
          <article class="panel l-${o.letter}" data-letter="${o.letter}">
            <div class="panel-ground">${paperGround(o.letter.charCodeAt(0) + q.n)}</div>
            <div class="panel-art">${art(o.scene)}</div>
            <div class="panel-text"><b class="ltr">${o.letter}</b><p>${esc(o.text)}</p></div>
            <i class="count"></i>
          </article>`).join('')}
      </div>
      <div class="panel-e l-all" data-letter="${e.letter}"><b class="ltr">${e.letter}</b><p>${esc(e.text)}</p><i class="count"></i></div>
    </div>`;
}

function revealHTML(q) {
  return `
    <div class="reveal-card">
      <div class="reveal-art">${art(q.reveal.scene)}</div>
      <div class="reveal-text">
        <p class="kicker">The discovery</p>
        <p class="reveal-body">${esc(q.reveal.text)}</p>
        ${q.reveal.note ? `<p class="reveal-note">${esc(q.reveal.note)}</p>` : ''}
        <p class="reveal-stats"></p>
      </div>
    </div>`;
}

function discoveryHTML(r) {
  return `
    <div class="discovery">
      <p class="kicker">End of round ${r.id}</p>
      <h2 class="disc-text">${esc(r.discovery)}</h2>
    </div>`;
}

function leaderboardHTML(r) {
  return `
    <div class="leaderboard">
      <h2 class="lb-title">Round ${r.id} complete</h2>
      <ol class="lb-rows" id="lb-rows-${r.id}"></ol>
    </div>`;
}

function bonusIntroHTML(q) {
  return `
    <div class="bonus-intro">
      <p class="kicker">Final challenge</p>
      <h2 class="round-name">${esc(q.title)}</h2>
      <p class="round-tag">Guess one number. The closest guess wins $300,000. If there's a perfect tie, everyone tied wins it.</p>
    </div>`;
}

function bonusHTML(q) {
  return `
    <div class="bonus">
      <h3 class="q-title">${esc(q.prompt)}</h3>
      <div class="bonus-main">
        <div class="pct"><span id="pct-num">?</span><small>%</small></div>
        <div class="people" id="people">${Array.from({ length: 100 }, () => `<i>${art('person')}</i>`).join('')}</div>
      </div>
      <div class="bonus-foot">
        <p class="reveal-body">${esc(q.reveal.text)}</p>
        <p class="reveal-note">${esc(q.reveal.note)}</p>
        <ol class="guesses" id="guesses"></ol>
      </div>
    </div>`;
}

function podiumHTML() {
  return `
    <div class="podium">
      <h2 class="podium-title">The winners</h2>
      <div class="steps">
        <div class="step s2"><div class="who"></div><div class="block"><b>2</b></div></div>
        <div class="step s1"><div class="trophy">${art('trophy')}</div><div class="who"></div><div class="block"><b>1</b></div></div>
        <div class="step s3"><div class="who"></div><div class="block"><b>3</b></div></div>
      </div>
    </div>`;
}
