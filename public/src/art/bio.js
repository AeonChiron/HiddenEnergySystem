// Organs, vessels and cells: simplified but recognizable anatomy in paper layers.
import { C, paper, paperCircle, paperEllipse, blob, blobXY, glucose, ketone, droplet, fatty, smooth } from './kit.js';

const f = (n) => Math.round(n * 10) / 10;

// ---------- cells ----------
// A body cell (generic). `door` adds a glucose channel on the membrane.
export function cell(cx, cy, r, o = {}) {
  const { fill = C.sageXL, membrane = C.sage, nucleus = true, seed = 3, cls = '', face = '', inner = '' } = o;
  return `<g class="cell ${cls}">
    ${paper(blob(cx, cy, r + 6, .05, 10, seed), membrane, { grain: .18, dx: 3, dy: 5 })}
    ${paper(blob(cx, cy, r, .05, 10, seed), fill, { shadow: false, grain: .1 })}
    ${nucleus ? paper(blob(cx + r * .12, cy - r * .08, r * .34, .07, 8, seed + 2), C.tealL, { dx: 2, dy: 3, grain: .14 }) : ''}
    ${nucleus ? `<circle cx="${f(cx + r * .18)}" cy="${f(cy - r * .14)}" r="${f(r * .1)}" fill="${C.teal}"/>` : ''}
    ${inner}${face}
  </g>`;
}

// Mitochondrion: burnt-orange bean with folded inner membrane.
export function mito(cx, cy, w = 60, rot = 0, cls = '') {
  const h = w * .46;
  let fold = `M${f(-w / 2 + 8)} 0`;
  for (let i = 0; i < 5; i++) fold += `L${f(-w / 2 + 14 + i * (w - 24) / 5)} ${i % 2 ? h * .32 : -h * .32}`;
  return `<g class="${cls}"><g class="mito" transform="translate(${cx} ${cy}) rotate(${rot})">
    ${paperEllipse(0, 0, w / 2, h / 2, C.orange, { dx: 2, dy: 3, grain: .2 })}
    <ellipse cx="0" cy="0" rx="${w / 2 - 5}" ry="${h / 2 - 5}" fill="${C.orangeL}"/>
    <path d="${fold}L${f(w / 2 - 8)} 0" stroke="${C.orange}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  </g></g>`;
}

// Lysosome: small ochre sac holding enzymes (dots).
export function lysosome(cx, cy, r = 14, cls = '') {
  return `<g class="lyso ${cls}">${paperCircle(cx, cy, r, C.ochre, { dx: 1.5, dy: 2.5, grain: .2 })}<circle cx="${cx - r * .3}" cy="${cy - r * .2}" r="${r * .16}" fill="${C.ochreD}"/><circle cx="${cx + r * .25}" cy="${cy + r * .1}" r="${r * .16}" fill="${C.ochreD}"/><circle cx="${cx - r * .05}" cy="${cy + r * .4}" r="${r * .14}" fill="${C.ochreD}"/></g>`;
}

// Damaged component: a cracked, faded mitochondrion-like fragment.
export function damaged(cx, cy, s = 1, rot = 0, cls = '') {
  return `<g class="${cls}"><g class="damaged" transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s})">
    <path d="M-26 -6C-24 -16 -8 -18 0 -14L4 -4L10 -14C20 -14 28 -6 26 4C24 12 10 16 -2 14L-6 4L-12 14C-22 12 -28 4 -26 -6Z" fill="#b9ada0" stroke="#857a6d" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-16 -2l6 4M12 0l6 -4" stroke="#857a6d" stroke-width="2" stroke-linecap="round"/>
  </g></g>`;
}

// Building blocks: amino-acid beads returned for reuse.
export function blocks(cx, cy, n = 5, s = 1, cls = '') {
  const cols = [C.sage, C.tealL, C.ochreL, C.sageD, C.orangeL];
  return `<g class="blocks ${cls}">${Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `<circle class="b" cx="${f(cx + Math.cos(a) * 14 * s)}" cy="${f(cy + Math.sin(a) * 14 * s)}" r="${6 * s}" fill="${cols[i % cols.length]}" stroke="${C.ink}" stroke-opacity=".25" stroke-width="1.4"/>`;
  }).join('')}</g>`;
}

// ---------- vessels ----------
// Horizontal blood vessel cutaway from x0 to x1 centred at y.
export function vessel(x0, x1, y, h = 70, cls = '') {
  return `<g class="vessel ${cls}">
    ${paper(`M${x0} ${y - h / 2 - 12}H${x1}V${y + h / 2 + 12}H${x0}Z`, C.orange, { dx: 0, dy: 6, grain: .22 })}
    <rect x="${x0}" y="${y - h / 2}" width="${x1 - x0}" height="${h}" fill="${C.orangeXL}"/>
    <path d="M${x0} ${y - h / 2}H${x1}M${x0} ${y + h / 2}H${x1}" stroke="${C.orangeD}" stroke-width="2" opacity=".5"/>
    ${[0.15, 0.45, 0.75].map((t, i) => `<ellipse cx="${f(x0 + (x1 - x0) * t)}" cy="${y + (i % 2 ? 14 : -14)}" rx="13" ry="7" fill="${C.orangeL}" opacity=".85"/>`).join('')}
  </g>`;
}

// ---------- organs ----------
export function stomach(cx, cy, s = 1, o = {}) {
  const { fill = C.blush, cls = '', face = '' } = o;
  const d = 'M-30 -78C-30 -96 -6 -100 -4 -82C-2 -60 10 -52 34 -56C70 -62 92 -30 86 6C80 46 40 70 2 64C-24 60 -40 70 -48 86C-56 96 -74 90 -70 76C-62 50 -40 46 -38 20C-36 -6 -30 -40 -30 -78Z';
  return `<g class="stomach ${cls}" transform="translate(${cx} ${cy}) scale(${s})">
    ${paper(d, fill, { grain: .2, dx: 3, dy: 6 })}
    <path d="M0 -40C10 -30 40 -34 60 -20M-4 0C20 14 50 8 70 18M-20 30C0 40 30 42 50 36" stroke="${C.blushD}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>
    ${face}
  </g>`;
}

export function pancreas(cx, cy, s = 1, o = {}) {
  const { cls = '' } = o;
  const d = 'M-110 6C-118 -14 -96 -30 -74 -22C-48 -12 -20 -24 8 -26C40 -28 74 -38 102 -30C120 -24 118 -4 100 2C70 10 40 4 12 12C-20 20 -40 34 -70 34C-92 34 -104 24 -110 6Z';
  return `<g class="pancreas ${cls}" transform="translate(${cx} ${cy}) scale(${s})">
    ${paper(d, C.ochreL, { grain: .22, dx: 3, dy: 5 })}
    ${Array.from({ length: 7 }, (_, i) => `<circle cx="${-80 + i * 28}" cy="${(i % 2 ? -4 : 6)}" r="7" fill="${C.ochre}" opacity=".5"/>`).join('')}
  </g>`;
}

export function liver(cx, cy, s = 1, o = {}) {
  const { cls = '' } = o;
  const d = 'M-120 -20C-116 -58 -40 -70 30 -62C90 -56 128 -40 122 -14C116 10 70 16 30 30C-10 44 -60 70 -96 50C-118 38 -122 10 -120 -20Z';
  return `<g class="liver ${cls}" transform="translate(${cx} ${cy}) scale(${s})">
    ${paper(d, C.orangeD, { grain: .24, dx: 3, dy: 6 })}
    <path d="M10 -60C0 -30 4 0 22 28" stroke="${C.orange}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M-100 -30C-60 -46 -20 -48 0 -44" stroke="#a9502a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
  </g>`;
}

export function brain(cx, cy, s = 1, o = {}) {
  const { cls = '', fill = C.blush } = o;
  const d = 'M-92 10C-110 -16 -96 -56 -62 -64C-50 -92 -8 -96 10 -80C34 -98 78 -86 86 -56C112 -48 118 -10 100 10C108 36 84 58 56 52C40 70 6 70 -8 56C-30 70 -66 62 -70 40C-90 40 -100 26 -92 10Z';
  return `<g class="brain ${cls}" transform="translate(${cx} ${cy}) scale(${s})">
    ${paper(d, fill, { grain: .22, dx: 3, dy: 6 })}
    <path d="M-60 -30C-40 -44 -20 -24 -36 -10C-50 2 -30 18 -14 6M10 -60C2 -36 30 -30 24 -12C18 6 44 10 52 -8M62 -20C78 -6 72 18 54 22M-70 20C-50 14 -40 34 -20 30M4 22C10 40 34 42 40 30" stroke="${C.blushD}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M-2 -78C4 -40 -6 0 6 54" stroke="${C.blushD}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>
  </g>`;
}

export function heart(cx, cy, s = 1, o = {}) {
  const { cls = '' } = o;
  const d = 'M0 70C-40 40 -86 10 -84 -30C-82 -62 -46 -74 -22 -56C-12 -48 -4 -40 0 -32C4 -40 12 -48 22 -56C46 -74 82 -62 84 -30C86 10 40 40 0 70Z';
  return `<g class="heart ${cls}" transform="translate(${cx} ${cy}) scale(${s})">
    <path d="M-20 -60C-24 -84 -14 -96 -4 -96M18 -58C22 -80 36 -88 48 -86" stroke="${C.orangeD}" stroke-width="14" fill="none" stroke-linecap="round"/>
    ${paper(d, C.orange, { grain: .22, dx: 3, dy: 6 })}
    <path d="M-50 -30C-40 0 -20 20 0 40" stroke="${C.orangeL}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>
  </g>`;
}

// Front-facing human silhouette with key organs (Round 2 world).
export function body(cx, cy, s = 1, o = {}) {
  const { cls = '', organs = true } = o;
  const R = [[0, -472], [34, -462], [50, -432], [48, -398], [36, -372], [24, -352], [26, -334], [80, -318], [116, -300], [132, -270], [140, -200], [146, -120], [152, -40], [156, 4], [160, 30], [150, 48], [134, 36], [130, 0], [122, -80], [114, -160], [106, -226], [100, -200], [96, -120], [100, -40], [110, 30], [112, 110], [104, 220], [94, 330], [96, 404], [104, 432], [36, 436], [34, 404], [28, 300], [18, 160], [6, 76], [0, 70]];
  const L = R.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  const outline = smooth([...R, ...L], true, .85);
  return `<g class="body ${cls}" transform="translate(${cx} ${cy}) scale(${s})">
    ${paper(outline, C.ivory, { grain: .18, dx: 5, dy: 8 })}
    <path d="${outline}" fill="none" stroke="${C.ivoryD}" stroke-width="3"/>
    ${organs ? `
      <path class="artery" d="M0 -330V60M0 -250C-60 -240 -110 -200 -130 -120M0 -250C60 -240 110 -200 130 -120M0 60C-30 140 -60 260 -66 400M0 60C30 140 60 260 66 400" stroke="${C.orange}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".55"/>
      ${brain(0, -405, .5)}
      ${heart(-10, -230, .32)}
      ${liver(-26, -150, .5)}
      ${stomach(36, -140, .48)}
      ${pancreas(6, -92, .42)}
    ` : ''}
  </g>`;
}

export { glucose, ketone, droplet, fatty };
