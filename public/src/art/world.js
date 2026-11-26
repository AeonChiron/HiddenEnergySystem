// Large world pieces: logo, the living cell, the body, the trophy, people icons.
import { C, paper, paperCircle, paperEllipse, blob, blobXY, glucose, ketone, fatty, droplet, protein, svg, smooth } from './kit.js';
import { cell, mito, lysosome, damaged, blocks, body, brain, liver, pancreas, stomach, heart } from './bio.js';

const f = (n) => Math.round(n * 10) / 10;

// Seed's logo (Nov 2026): a blue pinwheel that turns slowly, with a little
// momentum: it eases into each turn, coasts, and settles like a real wheel.
export function logoMark() {
  const src = (globalThis.HE_IMG && globalThis.HE_IMG.logo) || '/img/logo.webp';
  // Layers cut to the logo's own shape: a soft glow, a crisp rim with a light
  // running around it, the logo, and a sheen that sweeps across its face.
  return `<span class="he-logo" style="--logo:url('${src}')"><i class="glow"></i><i class="rim"></i><img src="${src}" alt="" draggable="false"><i class="sheen"></i></span>`;
}

export function logoMarkOld(size = 96) {
  return svg('0 0 120 120', `
    ${paper(blob(60, 62, 50, .05, 10, 4), C.sage, { dx: 2, dy: 4, grain: .2 })}
    ${paper(blob(60, 60, 41, .05, 10, 4), C.ivory, { shadow: false, grain: .1 })}
    ${paperCircle(74, 44, 13, C.tealL, { dx: 1.5, dy: 2.5 })}
    <circle cx="76" cy="42" r="4" fill="${C.teal}"/>
    ${glucose(52, 66, 1.55)}
    ${mito(38, 88, 26, -20)}
  `, { cls: 'logo-mark', label: 'Hidden Energy System logo' });
}

// The living cell: Round 3 world and the lobby's hero.
export function bigCell(o = {}) {
  const { recycling = true } = o;
  const cx = 400, cy = 400;
  const organelles = `
    <g class="er">${[0, 1, 2].map((i) => `<path d="M${250 + i * 14} ${300 - i * 22}C${300 + i * 10} ${250 - i * 20} ${380} ${270 - i * 18} ${420} ${236 - i * 16}" stroke="${C.sage}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"/>`).join('')}</g>
    ${mito(250, 470, 92, 24, 'float f1')}
    ${mito(560, 520, 84, -32, 'float f2')}
    ${mito(520, 240, 70, 12, 'float f3')}
    ${lysosome(300, 560, 18, 'float f2')}
    ${lysosome(610, 380, 15, 'float f1')}
    ${lysosome(210, 360, 13, 'float f3')}
    <g class="golgi">${[0, 1, 2, 3].map((i) => `<path d="M${470 + i * 4} ${560 + i * 14}c30 -10 60 -10 90 0" stroke="${C.tealL}" stroke-width="9" fill="none" stroke-linecap="round"/>`).join('')}</g>
  `;
  const recycle = recycling ? `
    <g class="autophagy">
      <g class="phago">
        <circle cx="610" cy="640" r="44" fill="none" stroke="${C.teal}" stroke-width="7" stroke-dasharray="230 60" class="phago-ring"/>
        <circle cx="610" cy="640" r="34" fill="none" stroke="${C.tealL}" stroke-width="4" stroke-dasharray="180 50" class="phago-ring2"/>
        ${damaged(610, 640, .9, 20, 'dmg')}
      </g>
      ${blocks(330, 650, 5, 1, 'reuse')}
    </g>` : '';
  return svg('0 0 800 800', `
    ${paper(blob(cx, cy, 352, .045, 12, 11), C.sage, { dx: 6, dy: 10, grain: .22 })}
    ${paper(blob(cx, cy, 334, .045, 12, 11), C.sageL, { shadow: false, grain: .12 })}
    ${paper(blob(cx, cy, 318, .045, 12, 11), C.sageXL, { shadow: false, grain: .08 })}
    ${organelles}
    <g class="nucleus float f3">
      ${paper(blob(410, 390, 118, .05, 10, 5), C.teal, { dx: 4, dy: 7, grain: .22 })}
      ${paper(blob(410, 390, 104, .05, 10, 5), C.tealL, { shadow: false, grain: .14 })}
      ${paperCircle(440, 372, 34, C.teal, { dx: 2, dy: 3 })}
      <path d="M350 400c20 -16 40 10 60 -6s40 12 60 -4M360 430c24 -10 40 8 64 -4" stroke="${C.tealXL}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
    </g>
    ${recycle}
  `, { cls: 'big-cell', label: 'A living cell' });
}

export function bodyWorld() {
  return svg('-300 -520 600 980', body(0, 0, 1), { cls: 'body-world', label: 'The human body: brain, heart, liver, stomach and pancreas' });
}

export function round1Art() {
  const meals = [['acai', -230, -150, .9, -6], ['burger', 220, -170, .85, 5], ['quinoa', -220, 190, .9, 4], ['chicken', 230, 200, .9, -4]];
  return `<div class="meal-fan">${meals.map(([m, x, y, s, r]) => `<img src="${(globalThis.HE_IMG && globalThis.HE_IMG[m]) || `/img/food/${m}.webp`}" alt="" style="--x:${x}px;--y:${y}px;--s:${s};--r:${r}deg" class="fan-${m}">`).join('')}</div>`;
}

export function trophy() {
  return svg('0 0 200 200', `
    ${paper('M50 30H150V70C150 110 124 128 100 128C76 128 50 110 50 70Z', C.ochre, { dx: 3, dy: 5, grain: .25 })}
    <path d="M52 44H24C24 74 38 88 58 90M148 44H176C176 74 162 88 142 90" stroke="${C.ochreD}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M72 40C70 70 80 96 96 108" stroke="${C.ochreL}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <rect x="90" y="126" width="20" height="26" fill="${C.ochreD}"/>
    ${paper('M64 152H136L142 176H58Z', C.teal, { dx: 2, dy: 4, grain: .2 })}
  `, { cls: 'trophy-art', label: 'Trophy' });
}

// Simple person icon for the 94 out of 100 grid.
export function personIcon() {
  return `<svg class="art pi" viewBox="0 0 30 40" aria-hidden="true"><circle cx="15" cy="8" r="6.5" fill="currentColor"/><path d="M4 38C4 24 8 17 15 17S26 24 26 38Z" fill="currentColor"/></svg>`;
}

export { glucose, ketone, fatty, droplet, protein };
