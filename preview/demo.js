// In-browser preview: the real engine, host screen and phone running in one
// page with practice bots, so the whole game can be tried without a server.
import { Hub } from '../shared/engine.js';
import { mountHost } from '../public/src/host/main.js';
import { mountPlayer } from '../public/src/player.js';
import { mountTour } from '../public/src/host/tour.js';
import { ROUNDS, QUESTIONS, buildSteps } from '../shared/content.js';

const hub = new Hub({ rushBots: true });

// Same shape as net.js connect(): messages are cloned and delivered async.
function localConnect({ onOpen, onMessage, onStatus }) {
  const conn = { send: (m) => setTimeout(() => onMessage(JSON.parse(JSON.stringify(m))), 0) };
  setTimeout(() => { onStatus && onStatus('online'); onOpen && onOpen(); }, 0);
  return {
    send: (m) => setTimeout(() => hub.handle(conn, JSON.parse(JSON.stringify(m))), 0),
    serverOffset: () => 0,
    close() { hub.drop(conn); },
  };
}

// "Play from here" in the tour reloads the page and starts the show at that step.
let from = 0;
try { from = Number(sessionStorage.getItem('he:from')) || 0; sessionStorage.removeItem('he:from'); } catch {}
const host = mountHost(document.getElementById('host'), { from, connect: localConnect, joinBase: 'https://your-quiz-site', previewBots: 7, onBoard: () => { location.hash = '#tour'; } });
const wait = setInterval(() => {
  if (!host.state.code) return;
  clearInterval(wait);
  mountPlayer(document.getElementById('phone'), { connect: localConnect, code: host.state.code });
}, 50);

// Tour mode: the whole board with no game running, for reviewing each scene.
let tour = null;
const tourWrap = document.getElementById('tour-wrap');
function setMode() {
  const mode = location.hash === '#tour' ? 'tour' : 'play';
  document.querySelectorAll('.pv-mode').forEach((a) => a.setAttribute('aria-current', String(a.dataset.mode === mode)));
  tourWrap.hidden = mode !== 'tour';
  if (mode === 'tour' && !tour) {
    tour = mountTour(document.getElementById('tour'), { rounds: ROUNDS, questions: QUESTIONS, steps: buildSteps() }, {
      onClose: () => { location.hash = '#play'; },
      onPlay: (step) => {
        try { sessionStorage.setItem('he:from', String(step)); } catch {}
        location.hash = '#play';
        location.reload();
      },
    });
    window.__tour = tour;
  }
}
window.addEventListener('hashchange', setMode);
setMode();

// Auto-play: the preview phone plays by itself and always answers right, so
// the whole show can be watched hands-free. Remembered across "Play from here".
const autoBtn = document.getElementById('pv-auto');
let auto = false;
try { auto = sessionStorage.getItem('he:auto') === '1'; } catch {}
function showAuto() { autoBtn.setAttribute('aria-pressed', String(auto)); autoBtn.querySelector('b').textContent = auto ? 'On' : 'Off'; }
autoBtn.addEventListener('click', () => { auto = !auto; try { sessionStorage.setItem('he:auto', auto ? '1' : '0'); } catch {} showAuto(); });
showAuto();
let seenN = null, seenAt = 0;
setInterval(() => {
  if (!auto) return;
  const ph = document.getElementById('phone');
  const name = ph.querySelector('#pname');
  if (name) {
    if (!name.value.trim()) name.value = 'You';
    const btn = name.closest('form')?.querySelector('button.btn.primary');
    if (btn && !btn.disabled) btn.click();
    return;
  }
  const lock = ph.querySelector('[data-act="lock"]');
  const room = [...hub.rooms.values()][0];
  const n = room?.open?.n;
  if (!lock || n == null) return;
  if (seenN !== n) { seenN = n; seenAt = Date.now(); return; }
  if (Date.now() - seenAt < 1500) return; // a beat to read, like a person
  const q = QUESTIONS.find((x) => x.n === n);
  if (!q) return;
  if (q.kind === 'number') {
    const r = ph.querySelector('#num');
    if (r && Number(r.value) !== q.answer) { r.value = String(q.answer); r.dispatchEvent(new Event('input', { bubbles: true })); return; }
  } else {
    const pick = ph.querySelector(`[data-pick="${q.answer}"]`);
    if (pick && pick.getAttribute('aria-pressed') !== 'true') { pick.click(); return; }
    const chips = [...ph.querySelectorAll('[data-bet]')];
    const want = chips.find((c) => c.querySelector('b')?.textContent === '25%') || chips[chips.length - 1];
    if (want && want.getAttribute('aria-checked') !== 'true') { want.click(); return; }
  }
  if (!lock.disabled) lock.click();
}, 350);
