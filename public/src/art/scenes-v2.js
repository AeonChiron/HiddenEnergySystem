// Second pass after Seed's review: simpler, bigger shapes, slow motion and
// everyday analogies instead of a cell in every scene. These override the
// first-pass scenes with the same ids.
import { C, paper, paperCircle, paperRect, paperEllipse, roundRect, blob, glucose, fatty, droplet, ketone, insulin, protein, tag, svg } from './kit.js';
import { cell, brain, mito, damaged, blocks, vessel } from './bio.js';
import { person } from './people.js';

const VB = '0 0 420 380';
const RV = '0 0 760 620';
const f = (n) => Math.round(n * 10) / 10;
const T = (x, y, s, size = 18, fill = C.ink, anchor = 'middle', w = 800) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${w}" fill="${fill}" font-family="Bricolage, sans-serif">${s}</text>`;

// ---------- shared objects ----------
// Glass storage jar; `fill` 0..1 shows how full it is (hexagons inside).
function jar(x, y, w, h, cls = '') {
  const hex = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) hex.push(glucose(x + 26 + c * ((w - 52) / 2), y + h - 30 - r * 30, 1.05, `jf j${r}`));
  return `<g class="${cls}">
    ${paperRect(x + 10, y - 22, w - 20, 26, 8, C.teal, { dx: 2, dy: 3, grain: .2 })}
    ${paperRect(x, y, w, h, 22, '#eef5f2', { dx: 4, dy: 7, grain: .08 })}
    <path d="${roundRect(x, y, w, h, 22)}" fill="none" stroke="${C.tealL}" stroke-width="4"/>
    ${hex.join('')}
    <path d="M${x + 16} ${y + 20}v${h - 60}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>
  </g>`;
}
// Battery with a level bar (class "lvl" animates its width).
function battery(x, y, w, h, color, level = 1, cls = '') {
  const inner = w - 24;
  return `<g class="${cls}">
    ${paperRect(x, y, w, h, 16, C.ivory, { dx: 4, dy: 7, grain: .16 })}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="none" stroke="${C.ink}" stroke-width="6"/>
    <rect x="${x + w}" y="${y + h * .3}" width="12" height="${h * .4}" rx="4" fill="${C.ink}"/>
    <rect class="lvl" x="${x + 12}" y="${y + 12}" width="${f(inner * level)}" height="${h - 24}" rx="8" fill="${color}"/>
  </g>`;
}
// Recycling loop: three curved arrows around a centre.
function recycleLoop(cx, cy, r, color = C.teal, cls = '') {
  const arc = (a0, a1) => {
    const p = (a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const ah = a1 + .0;
    const tip = [cx + Math.cos(ah) * r, cy + Math.sin(ah) * r];
    const tx = -Math.sin(ah), ty = Math.cos(ah); // tangent
    const nx = Math.cos(ah), ny = Math.sin(ah);
    const s = r * .26;
    return `<path d="M${f(x0)} ${f(y0)}A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}" stroke="${color}" stroke-width="${f(r * .2)}" fill="none" stroke-linecap="round"/>
      <path d="M${f(tip[0] + tx * s)} ${f(tip[1] + ty * s)}L${f(tip[0] + nx * s * .9)} ${f(tip[1] + ny * s * .9)}L${f(tip[0] - nx * s * .9)} ${f(tip[1] - ny * s * .9)}Z" fill="${color}"/>`;
  };
  const third = (Math.PI * 2) / 3;
  return `<g class="${cls}">${[0, 1, 2].map((i) => arc(-Math.PI / 2 + i * third + .28, -Math.PI / 2 + (i + 1) * third - .42)).join('')}</g>`;
}
// Kitchen shelf unit with optional items: [[shelfIndex, x, svg]].
function shelves(x, y, w, h, n, items = '') {
  const gap = h / n;
  return `<g>
    ${paperRect(x, y, w, h, 14, '#efe4cc', { dx: 4, dy: 7, grain: .2 })}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="none" stroke="${C.ivoryD}" stroke-width="5"/>
    ${Array.from({ length: n - 1 }, (_, i) => `<rect x="${x + 6}" y="${f(y + gap * (i + 1) - 4)}" width="${w - 12}" height="8" rx="4" fill="${C.ochreD}" opacity=".5"/>`).join('')}
    ${items}
  </g>`;
}
function smallJar(x, y, fill) {
  return `<g>${paperRect(x - 20, y - 50, 40, 50, 10, fill, { dx: 2, dy: 3, grain: .14 })}${paperRect(x - 16, y - 60, 32, 12, 4, C.teal, { dx: 1, dy: 2, grain: 0 })}</g>`;
}
function plate(x, y, r = 46) {
  return `<g>${paperEllipse(x, y, r, r * .3, '#fbf8f1', { dx: 0, dy: 4, grain: .1 })}<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .3}" fill="none" stroke="${C.ivoryD}" stroke-width="3"/><ellipse cx="${x}" cy="${y}" rx="${r * .62}" ry="${r * .18}" fill="none" stroke="${C.ivoryD}" stroke-width="2"/></g>`;
}
// Round analog gauge with a needle (class "needle" rotates around its base).
function gauge(cx, cy, r, label, angle, cls = '') {
  const ticks = Array.from({ length: 7 }, (_, i) => {
    const a = Math.PI + (i / 6) * Math.PI;
    return `<path d="M${f(cx + Math.cos(a) * (r - 16))} ${f(cy + Math.sin(a) * (r - 16))}L${f(cx + Math.cos(a) * (r - 4))} ${f(cy + Math.sin(a) * (r - 4))}" stroke="${C.ink}" stroke-width="4" stroke-linecap="round" opacity=".5"/>`;
  }).join('');
  return `<g class="${cls}">
    ${paper(`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}Z`, C.ivory, { dx: 4, dy: 7, grain: .16 })}
    <path d="M${cx - r + 14} ${cy}A${r - 14} ${r - 14} 0 0 1 ${f(cx + (r - 14) * Math.cos(Math.PI * 1.66))} ${f(cy + (r - 14) * Math.sin(Math.PI * 1.66))}" stroke="${C.sage}" stroke-width="12" fill="none"/>
    <path d="M${f(cx + (r - 14) * Math.cos(Math.PI * 1.66))} ${f(cy + (r - 14) * Math.sin(Math.PI * 1.66))}A${r - 14} ${r - 14} 0 0 1 ${cx + r - 14} ${cy}" stroke="${C.orange}" stroke-width="12" fill="none"/>
    ${ticks}
    <g transform="translate(${cx} ${cy})"><g class="needle" style="--a:${angle}deg"><path d="M-7 0L0 ${-r + 26}L7 0Z" fill="${C.ink}" transform="rotate(${angle})"/></g></g>
    <circle cx="${cx}" cy="${cy}" r="12" fill="${C.ink}"/>
    ${T(cx, cy + 40, label, 22)}
  </g>`;
}
// Clock face; hands carry classes so they can turn slowly.
function clock(cx, cy, r) {
  return `<g>
    ${paperCircle(cx, cy, r, C.ivory, { dx: 4, dy: 7, grain: .16 })}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.teal}" stroke-width="8"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${f(cx + Math.cos(a) * (r - 18))}" cy="${f(cy + Math.sin(a) * (r - 18))}" r="${i % 3 ? 3 : 5}" fill="${C.ink}" opacity=".55"/>`; }).join('')}
    <g transform="translate(${cx} ${cy})"><g class="hand-h"><path d="M0 6V${-r * .45}" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/></g><g class="hand-m"><path d="M0 8V${-r * .7}" stroke="${C.orange}" stroke-width="5" stroke-linecap="round"/></g></g>
    <circle cx="${cx}" cy="${cy}" r="8" fill="${C.ink}"/>
  </g>`;
}
function butterBlock(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    ${paper('M-46 -8L22 -20L52 -6L-16 8Z', '#f7dc8a', { dx: 0, dy: 0, grain: .1 })}
    ${paper('M-46 -8L-16 8V34L-46 18Z', C.ochreL, { shadow: false, grain: .12 })}
    ${paper('M-16 8L52 -6V20L-16 34Z', '#f3cf6e', { shadow: false, grain: .12 })}
  </g>`;
}

export const scenes = {
  // Round 2 world: the three fuels, not a full body.
  round2: () => svg('0 0 600 700', `
    ${paperCircle(300, 160, 120, C.ivory, { dx: 5, dy: 9, grain: .18 })}${glucose(300, 160, 5.2)}
    ${paperCircle(170, 460, 110, C.ivory, { dx: 5, dy: 9, grain: .18 })}${fatty(184, 470, 3.4)}
    ${paperCircle(440, 470, 110, C.ivory, { dx: 5, dy: 9, grain: .18 })}${ketone(440, 470, 5.4)}
    ${T(300, 320, 'sugar', 30)}${T(170, 610, 'fat', 30)}${T(440, 620, 'ketones', 30)}
  `, { cls: 'fuels', label: 'Three fuels: sugar, fat and ketones' }),

  // ---------- Q5 ----------
  sugarIntoCells: () => svg(VB, `
    ${vessel(-10, 430, 70, 64)}
    ${glucose(210, 64, 1.1)}${glucose(380, 76, 1.1)}${glucose(36, 74, 1.1)}
    <g class="slowfall">${glucose(120, 70, 1.3, 'sf s0')}${glucose(300, 70, 1.3, 'sf s1')}</g>
    ${jar(56, 190, 130, 150, 'jar')}
    ${battery(236, 220, 140, 76, C.teal, .3, 'charge')}
    ${T(121, 368, 'stored', 18)}${T(306, 340, 'used', 18)}
  `, { cls: 'sc sc-sugarIntoCells', label: 'Sugar leaves the blood to fill a storage jar and charge a battery' }),

  // ---------- Q6 ----------
  sugarVanish: () => svg(VB, `
    <path d="M10 330H410" stroke="${C.ivoryD}" stroke-width="5" stroke-linecap="round"/>
    ${person({ x: 150, y: 330, s: 1.1, shirt: C.teal, pants: C.ink, skin: C.skin2, hairStyle: 'short', face: 'smile', armR: [38, 4], armL: [-20, 70] })}
    <g class="broom"><path d="M196 178L262 318" stroke="${C.ochreD}" stroke-width="8" stroke-linecap="round"/>${paper('M240 312L286 296L304 336L250 340Z', C.ochre, { dx: 2, dy: 3, grain: .2 })}</g>
    <g class="swept">${glucose(320, 318, 1.2, 'sw w0')}${glucose(352, 320, 1.2, 'sw w1')}${glucose(336, 294, 1.2, 'sw w2')}</g>
  `, { cls: 'sc sc-sugarVanish', label: 'Someone sweeps sugar away with no effort' }),

  // ---------- Q7 ----------
  emptyBattery: () => svg(VB, `
    ${battery(70, 130, 250, 130, C.orange, .62, 'drain')}
    ${T(195, 312, 'energy', 22, C.ink)}
  `, { cls: 'sc sc-emptyBattery', label: 'A big battery slowly running empty' }),

  proteinGenerator: () => svg(VB, `
    ${paperRect(110, 120, 200, 200, 26, C.ink, { dx: 5, dy: 8, grain: .1 })}
    ${paperRect(140, 170, 140, 110, 18, '#2c3b3d', { shadow: false, grain: 0 })}
    <g class="flame">${paper('M210 270C170 270 160 236 178 210C186 230 196 226 192 206C190 186 204 172 214 166C212 190 236 196 238 220C252 206 252 196 250 190C268 214 256 270 210 270Z', C.orange, { shadow: false, grain: .1 })}
      ${paper('M210 270C190 270 186 250 196 236C200 246 208 244 206 232C214 238 226 248 226 258C224 268 218 270 210 270Z', C.ochreL, { shadow: false, grain: 0 })}</g>
    ${protein(150, 272, 1.3)}${protein(196, 282, 1.3)}
    ${tag(210, 100, 'protein', { fill: C.sageD, size: 17 })}
  `, { cls: 'sc sc-proteinGenerator', label: 'Protein chains burning as the main fuel in a stove' }),

  butterScale: () => svg(VB, `
    ${paperRect(90, 210, 240, 120, 30, C.ivory, { dx: 5, dy: 8, grain: .16 })}
    <rect x="150" y="236" width="120" height="44" rx="10" fill="${C.ink}"/>
    <text class="num" x="210" y="268" text-anchor="middle" font-size="28" font-weight="800" fill="${C.ochreL}" font-family="Bricolage, sans-serif"><tspan class="n1">82 kg</tspan><tspan class="n2" x="210">79 kg</tspan><tspan class="n3" x="210">75 kg</tspan></text>
    ${butterBlock(210, 186, 1.5)}
    <path class="arrow" d="M362 220v50m-16 -16l16 16l16 -16" stroke="${C.orange}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `, { cls: 'sc sc-butterScale', label: 'A block of butter on a bathroom scale makes the number go down' }),

  // ---------- Q8 ----------
  ketoneBrain: () => svg(VB, `
    ${brain(250, 190, 1.2)}
    <g class="ko slow">${ketone(60, 120, 2.1, 'k1')}${ketone(80, 200, 2.1, 'k2')}${ketone(60, 280, 2.1, 'k3')}</g>
  `, { cls: 'sc sc-ketoneBrain', label: 'Ketones flow into the brain as fuel' }),

  hungerMeter: () => svg(VB, `
    ${clock(150, 190, 100)}
    ${plate(320, 300, 60)}
    <path d="M300 200v70M292 200v26q8 8 16 0v-26" stroke="${C.ink}" stroke-opacity=".45" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M346 200c12 4 12 40 0 48v22" stroke="${C.ink}" stroke-opacity=".45" stroke-width="5" fill="none" stroke-linecap="round"/>
  `, { cls: 'sc sc-hungerMeter', label: 'Time passes on a clock while an empty plate waits' }),

  fatReserves: () => svg(VB, `
    <g class="reserve">${droplet(96, 150, 34, 'r0')}${droplet(76, 236, 26, 'r1')}${droplet(140, 214, 22, 'r2')}</g>
    ${tag(100, 300, 'stored fat', { fill: C.ochreD, size: 16 })}
    <path d="M186 200H232m-12 -12l12 12l-12 12" stroke="${C.ink}" stroke-opacity=".45" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${battery(244, 160, 110, 80, C.teal, 1, 'fillup')}
  `, { cls: 'sc sc-fatReserves', label: 'Stored fat charges an energy battery' }),

  revealAllKetosis: () => svg(RV, `
    ${[[190, 170], [570, 170], [380, 440]].map(([x, y]) => paperCircle(x, y, 120, C.ivory, { dx: 4, dy: 8, grain: .16 })).join('')}
    ${brain(190, 160, .62)}${ketone(120, 196, 1.2)}${ketone(260, 200, 1.2)}
    ${clock(570, 164, 66)}
    ${droplet(346, 434, 28)}<path d="M382 434h26m-8 -8l8 8l-8 8" stroke="${C.ink}" stroke-opacity=".5" stroke-width="4" fill="none" stroke-linecap="round"/>${battery(416, 414, 50, 40, C.teal, 1)}
    ${tag(190, 310, 'A · fuel for the brain', { fill: C.teal, size: 17 })}${tag(570, 310, 'B · less hunger', { fill: C.teal, size: 17 })}
    ${tag(380, 588, 'C · uses stored fat', { fill: C.teal, size: 17 })}
  `, { cls: 'sc sc-revealAllKetosis', label: 'All three answers are true: brain fuel, less hunger and using stored fat' }),

  // ---------- Q9 ----------
  autophagosome: () => svg(VB, `
    ${recycleLoop(210, 196, 140, C.sage, 'spin-slow')}
    <g>${paperRect(168, 160, 84, 96, 14, C.teal, { dx: 3, dy: 5, grain: .2 })}${paperRect(160, 148, 100, 18, 6, C.tealD, { dx: 2, dy: 3, grain: 0 })}${recycleLoop(210, 210, 24, C.tealXL)}</g>
    <g class="stage-a">${damaged(60, 70, 1.4, 10)}</g>
    <g class="stage-c">${blocks(360, 320, 6, 1.4)}</g>
  `, { cls: 'sc sc-autophagosome', label: 'A worn-out part goes into a recycling bin and comes out as building blocks' }),

  fatToEnergy: () => svg(VB, `
    ${butterBlock(110, 180, 1.4)}
    ${tag(110, 268, 'fat', { fill: C.ochreD, size: 18 })}
    <g class="fa">${fatty(220, 170, 1.2, 'fa1')}${fatty(220, 222, 1.2, 'fa2')}</g>
    <g class="mito-big">${mito(330, 196, 120, -8)}</g>
    <g class="sparks">${[[300, 120], [380, 140], [356, 268]].map(([x, y], i) => `<path class="spk s${i}" d="M${x} ${y}l6 -14l6 14l14 6l-14 6l-6 14l-6 -14l-14 -6z" fill="${C.ochre}"/>`).join('')}</g>
  `, { cls: 'sc sc-fatToEnergy', label: 'Fat from a block of butter turns into energy' }),

  hungryCell: () => svg(VB, `
    <g class="hunter">${cell(190, 196, 120, { seed: 5, nucleus: false, face: `
      <circle cx="160" cy="160" r="8" fill="${C.ink}"/><circle cx="220" cy="160" r="8" fill="${C.ink}"/>
      <g class="chomp"><ellipse cx="190" cy="214" rx="30" ry="22" fill="${C.ink}"/><ellipse cx="190" cy="224" rx="16" ry="9" fill="${C.blushD}"/></g>
` })}</g>
    <g class="cutlery"><path d="M346 120v150M336 120v40q10 10 20 0v-40" stroke="${C.ink}" stroke-opacity=".55" stroke-width="6" fill="none" stroke-linecap="round"/></g>
  `, { cls: 'sc sc-hungryCell', label: 'A hungry cell with a napkin, ready to eat' }),

  // ---------- Q10 ----------
  glucoseCells: () => svg(VB, `
    ${cell(210, 210, 120, { seed: 3, nucleus: true })}
    <g class="knock">${glucose(80, 70, 2.2, 'kn k0')}${glucose(340, 70, 2.2, 'kn k1')}${glucose(210, 40, 2.2, 'kn k2')}</g>
  `, { cls: 'sc sc-glucoseCells', label: 'Big sugar molecules bounce off a cell that will not take them in' }),

  // ---------- Q11: analogies, no cells ----------
  nutrientShortage: () => svg(VB, `
    ${shelves(110, 50, 200, 290, 3, smallJar(160, 136, C.ochreL))}
  `, { cls: 'sc sc-nutrientShortage', label: 'An almost empty pantry with one jar left' }),

  proteinFlood: () => svg(VB, `
    <g class="shake">${paperRect(150, 110, 120, 220, 30, C.sageD, { dx: 5, dy: 8, grain: .2 })}
      ${paperRect(162, 70, 96, 50, 14, C.ink, { dx: 2, dy: 4, grain: 0 })}
      ${paperRect(166, 190, 88, 70, 12, C.ivory, { shadow: false, grain: .1 })}
      ${T(210, 234, 'PROTEIN', 19, C.ink)}</g>
    <g class="rain">${protein(60, 90, 1.2, 'pr r0')}${protein(300, 70, 1.2, 'pr r1')}</g>
  `, { cls: 'sc sc-proteinFlood', label: 'A big protein shake' }),

  napPlates: () => svg(VB, `
    <g>${paperRect(40, 240, 250, 70, 26, C.tealL, { dx: 4, dy: 7, grain: .2 })}${paperEllipse(90, 234, 46, 22, C.ivory, { dx: 2, dy: 4, grain: .14 })}</g>
    <g class="zz">${T(130, 190, 'z', 30, C.teal).replace('<text', '<text class="z z0"')}${T(156, 156, 'z', 38, C.teal).replace('<text', '<text class="z z1"')}${T(188, 114, 'Z', 48, C.teal).replace('<text', '<text class="z z2"')}</g>
    ${Array.from({ length: 6 }, (_, i) => plate(340, 304 - i * 17, 50)).join('')}
  `, { cls: 'sc sc-napPlates', label: 'A pillow on a sofa next to a tall stack of empty plates' }),

  insulinSurround: () => svg(VB, `
    ${gauge(210, 260, 160, 'insulin', 62, 'gauge-hi')}
  `, { cls: 'sc sc-insulinSurround', label: 'An insulin gauge turned up high' }),

  revealScarcity: () => svg(RV, `
    ${shelves(70, 140, 220, 330, 3, smallJar(130, 240, C.ochreL))}
    ${tag(180, 520, 'less food coming in', { fill: C.ochreD, size: 18 })}
    <path d="M330 300H400m-16 -16l16 16l-16 16" stroke="${C.ink}" stroke-opacity=".45" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${paperCircle(560, 300, 160, C.ivory, { dx: 5, dy: 9, grain: .16 })}
    ${recycleLoop(560, 300, 110, C.teal, 'spin-fast')}
    ${tag(560, 520, 'recycling turns up', { fill: C.teal, size: 18 })}
  `, { cls: 'sc sc-revealScarcity', label: 'With less food coming in, the recycling loop speeds up' }),
};
