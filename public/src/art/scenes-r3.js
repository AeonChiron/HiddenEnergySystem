// Round 3 · Inside the cell. One mini-scene per answer plus the reveals.
// Panel art viewBox is 420 x 380, reveals 760 x 620. Disease scenes stay
// serious; humour lives only in the wrong-answer scenes.
import { C, paper, paperCircle, paperRect, paperEllipse, blob, blobXY, glucose, fatty, droplet, insulin, protein, tag, svg } from './kit.js';
import { cell, brain, heart, mito, lysosome, damaged, blocks, vessel } from './bio.js';
import { sleeper, mouse } from './people.js';

const VB = '0 0 420 380';
const RV = '0 0 760 620';
const f = (n) => Math.round(n * 10) / 10;
const T = (x, y, s, w, fill = C.ink, anchor = 'middle', size = 18) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${w}" fill="${fill}" font-family="Bricolage, sans-serif">${s}</text>`;
const arrow = (x1, y, x2, cls = '') => `<path class="${cls}" d="M${x1} ${y}H${x2}m-12 -10l12 10l-12 10" stroke="${C.ink}" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

// The recycling wrap: a membrane closing around a worn-out part.
const wrap = (x, y, r, s = 1) => `<g class="phago">
  <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.teal}" stroke-width="${7 * s}" stroke-dasharray="${f(r * 5.2)} ${f(r * 1.2)}" class="phago-ring"/>
  ${damaged(x, y, .9 * s, 10, 'dmg')}</g>`;

// An irregular cell (for the cancer scenes): uneven edge, dark crowded nucleus.
const oddCell = (x, y, r, seed, cls = '') => `<g class="${cls}">
  ${paper(blob(x, y, r + 4, .2, 9, seed), C.orangeD, { dx: 2, dy: 4, grain: .2 })}
  ${paper(blob(x, y, r, .2, 9, seed), C.blush, { shadow: false, grain: .12 })}
  ${paper(blob(x + 2, y - 2, r * .52, .16, 7, seed + 3), C.orangeD, { shadow: false, grain: .1 })}</g>`;

// Mouse lifespan timelines. rows: [label, length 0..1]
function timelines(rows, x0, y0, w, gap, s = 1) {
  return rows.map(([label, len, fill], i) => {
    const y = y0 + i * gap;
    const L = f(w * len);
    return `<g>
      ${T(x0, y - 26 * s, label, 750, C.ink, 'start', 20 * s)}
      <rect x="${x0}" y="${y - 9 * s}" width="${w}" height="${18 * s}" rx="${9 * s}" fill="${C.ivoryD}" opacity=".6"/>
      <rect class="bar b${i}" x="${x0}" y="${y - 9 * s}" width="${L}" height="${18 * s}" rx="${9 * s}" fill="${fill}"/>
      <g class="end e${i}">${mouse({ x: x0 + L - 14 * s, y: y - 10 * s, s: .5 * s })}</g>
    </g>`;
  }).join('');
}

export const scenes = {
  // ---------- Q9 · what is autophagy ----------
  cellDivide: () => svg(VB, `
    <g class="split-l">${cell(150, 200, 92, { seed: 4 })}</g>
    <g class="split-r">${cell(270, 200, 92, { seed: 9 })}</g>
    <path class="pinch" d="M210 104C200 150 200 250 210 296" stroke="${C.sageD}" stroke-width="4" fill="none" stroke-dasharray="3 10" stroke-linecap="round"/>
  `, { cls: 'sc sc-cellDivide', label: 'One cell splits into two new cells' }),

  autophagosome: () => svg(VB, `
    ${cell(210, 196, 156, { seed: 14, nucleus: false, inner: `
      ${paper(blob(128, 140, 40, .06, 8, 3), C.tealL, { dx: 2, dy: 3, grain: .12 })}<circle cx="134" cy="134" r="12" fill="${C.teal}"/>
      ${mito(120, 262, 56, 30, 'float f2')}
      ${wrap(266, 168, 46)}
      <g class="lyso-in">${lysosome(330, 250, 17)}</g>
      ${blocks(214, 282, 5, 1, 'reuse')}` })}
  `, { cls: 'sc sc-autophagosome', label: 'Inside a cell, a membrane wraps a worn-out part and a lysosome moves in' }),

  fatToEnergy: () => svg(VB, `
    <g class="reserve">${droplet(62, 160, 30, 'r0')}${droplet(54, 236, 22, 'r1')}${droplet(98, 206, 18, 'r2')}</g>
    <g class="fa">${fatty(176, 168, 1, 'fa1')}${fatty(176, 236, 1, 'fa2')}</g>
    <g class="mito-big">${mito(310, 200, 150, -8)}</g>
    <g class="sparks">${[[262, 96], [372, 112], [392, 270], [250, 296]].map(([x, y], i) => `<path class="spk s${i}" d="M${x} ${y}l6 -14l6 14l14 6l-14 6l-6 14l-6 -14l-14 -6z" fill="${C.ochre}"/>`).join('')}</g>
  `, { cls: 'sc sc-fatToEnergy', label: 'Fat travels into a mitochondrion and becomes energy' }),

  hungryCell: () => svg(VB, `
    <g class="hunter">${cell(170, 200, 112, { seed: 5, nucleus: false, face: `
      <circle cx="140" cy="160" r="7" fill="${C.ink}"/><circle cx="196" cy="160" r="7" fill="${C.ink}"/>
      <path d="M128 140l22 6M208 140l-22 6" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>
      <g class="chomp"><path d="M126 214C150 250 200 250 224 214Z" fill="${C.ink}"/><path d="M140 216l6 10l6 -10l6 10l6 -10l6 10l6 -10l6 10l6 -10l6 10l6 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/></g>` })}</g>
    <g class="prey">${cell(346, 230, 40, { seed: 2, nucleus: false, face: `<circle cx="336" cy="224" r="3.5" fill="${C.ink}"/><circle cx="354" cy="224" r="3.5" fill="${C.ink}"/><ellipse cx="345" cy="244" rx="5" ry="6" fill="${C.ink}"/>` })}
      <path d="M380 190l8 -10M390 204l12 -4M378 176l2 -12" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/></g>
  `, { cls: 'sc sc-hungryCell', label: 'A hungry cell with a big mouth chases a smaller cell' }),

  revealAutophagy: () => svg(RV, `
    ${paper(blobXY(380, 300, 360, 230, .04, 12, 8), C.sage, { dx: 5, dy: 9, grain: .2 })}
    ${paper(blobXY(380, 300, 344, 214, .04, 12, 8), C.sageXL, { shadow: false, grain: .1 })}
    <g class="seq st1">${damaged(110, 290, 1.5, 10)}${tag(110, 430, '1 · worn-out part', { fill: C.ink, size: 17 })}</g>
    ${arrow(170, 290, 214, 'seq st2')}
    <g class="seq st2"><circle cx="290" cy="290" r="64" fill="${C.sageL}" opacity=".5"/><circle cx="290" cy="290" r="64" fill="none" stroke="${C.teal}" stroke-width="9"/>${damaged(290, 290, 1.3, 10)}${tag(290, 430, '2 · wrapped up', { fill: C.teal, size: 17 })}</g>
    ${arrow(370, 290, 414, 'seq st3')}
    <g class="seq st3"><circle cx="490" cy="290" r="64" fill="${C.ochreL}" opacity=".45"/><circle cx="490" cy="290" r="64" fill="none" stroke="${C.teal}" stroke-width="9"/>
      ${lysosome(530, 250, 22)}<g opacity=".6">${damaged(482, 300, .9, 40)}</g>${tag(490, 430, '3 · broken down', { fill: C.ochreD, size: 17 })}</g>
    ${arrow(570, 290, 614, 'seq st4')}
    <g class="seq st4">${blocks(660, 290, 6, 2.2)}${tag(660, 430, '4 · reused', { fill: C.sageD, size: 17 })}</g>
  `, { cls: 'sc sc-revealAutophagy', label: 'Autophagy in four steps: a worn-out part is wrapped, broken down and its building blocks reused' }),

  // ---------- Q10 · diseases linked to recycling problems ----------
  brainPlaques: () => svg(VB, `
    ${brain(210, 196, 1.45, { fill: '#e2c3b4' })}
    <g class="plaques">${[[150, 150], [236, 132], [282, 200], [178, 236], [120, 208], [250, 258]].map(([x, y], i) => `<g class="plq q${i}">${paper(blob(x, y, 15 + (i % 3) * 4, .22, 8, i + 2), '#a99b8c', { dx: 1.5, dy: 2.5, grain: .25 })}</g>`).join('')}</g>
  `, { cls: 'sc sc-brainPlaques', label: 'Clumps of debris build up in the brain' }),

  heartStress: () => svg(VB, `
    <g class="beat">${heart(170, 190, 1.45)}</g>
    <path d="M232 230L300 270" stroke="${C.ink}" stroke-opacity=".35" stroke-width="3" stroke-dasharray="4 8" stroke-linecap="round"/>
    ${paperCircle(330, 290, 74, C.ivory, { dx: 3, dy: 6, grain: .18 })}
    <circle cx="330" cy="290" r="74" fill="none" stroke="${C.ink}" stroke-opacity=".35" stroke-width="4"/>
    <g>${[0, 1, 2].map((i) => `<path d="M${270} ${262 + i * 28}C300 ${252 + i * 28} 360 ${272 + i * 28} 392 ${262 + i * 28}" stroke="${C.orangeL}" stroke-width="16" fill="none" stroke-linecap="round" opacity=".7"/>`).join('')}</g>
    <g class="plaques">${[[306, 270], [350, 300], [322, 318]].map(([x, y], i) => `<g class="plq q${i}">${damaged(x, y, .6, i * 40)}</g>`).join('')}</g>
  `, { cls: 'sc sc-heartStress', label: 'Damaged parts pile up inside heart muscle cells' }),

  abnormalCells: () => svg(VB, `
    ${[[70, 90], [150, 80], [230, 92], [310, 84], [360, 160], [60, 170], [110, 250], [60, 320], [300, 300], [370, 320], [380, 240]].map(([x, y], i) => cell(x, y, 30, { seed: i + 3 })).join('')}
    <g class="grow g0">${oddCell(200, 200, 44, 4)}</g>
    <g class="grow g1">${oddCell(264, 230, 32, 7)}</g>
    <g class="grow g2">${oddCell(196, 290, 30, 9)}</g>
    <g class="grow g3">${oddCell(160, 170, 24, 12)}</g>
  `, { cls: 'sc sc-abnormalCells', label: 'Irregular cells multiply among normal cells' }),

  glucoseCells: () => svg(VB, `
    ${vessel(-10, 430, 70, 70)}
    ${[50, 120, 190, 260, 330, 390].map((x, i) => glucose(x, 70 + (i % 2 ? 12 : -12), 1, `flow d${i % 6}`)).join('')}
    ${cell(120, 260, 72, { seed: 3, inner: `${damaged(140, 290, .55, 20)}${damaged(96, 230, .45, -30)}` })}
    ${cell(310, 268, 66, { seed: 8, inner: `${damaged(330, 296, .55, 50)}` })}
    <g class="knock">${glucose(120, 156, 1.1, 'kn k0')}${glucose(300, 162, 1.1, 'kn k1')}</g>
  `, { cls: 'sc sc-glucoseCells', label: 'Sugar crowds the blood while cells struggle to take it in' }),

  revealDiseases: () => svg(RV, `
    <g class="links">${[[140, 150], [620, 150], [380, 500]].map(([x, y]) => `<path class="link" d="M380 250L${x} ${y}" stroke="${C.ink}" stroke-opacity=".3" stroke-width="4" stroke-dasharray="6 12" stroke-linecap="round"/>`).join('')}</g>
    ${cell(380, 250, 104, { seed: 17, nucleus: false, inner: `
      <circle cx="380" cy="250" r="54" fill="none" stroke="${C.teal}" stroke-width="8" stroke-dasharray="40 34" opacity=".75"/>
      ${damaged(360, 236, .9, 10)}${damaged(404, 264, .7, 60)}${damaged(372, 282, .55, -20)}` })}
    ${tag(380, 384, 'recycling slows down', { fill: C.teal, size: 17 })}
    ${brain(140, 130, .62, { fill: '#e2c3b4' })}${tag(140, 210, "A · Alzheimer's disease", { fill: C.ink, size: 16 })}
    <g>${oddCell(600, 140, 34, 4)}${oddCell(646, 160, 24, 7)}${cell(630, 108, 18, { seed: 2, nucleus: false })}</g>${tag(620, 210, 'B · Cancer', { fill: C.ink, size: 16 })}
    <g>${cell(380, 510, 40, { seed: 6 })}${glucose(340, 470, .9)}${glucose(424, 474, .9)}${glucose(428, 530, .9)}</g>${tag(380, 584, 'C · Type 2 diabetes', { fill: C.ink, size: 16 })}
  `, { cls: 'sc sc-revealDiseases', label: "Slowed cellular recycling links Alzheimer's disease, cancer and type 2 diabetes" }),

  // ---------- Q11 · what turns recycling up ----------
  nutrientShortage: () => svg(VB, `
    <g class="plate">${paperEllipse(150, 250, 120, 44, C.ivory, { dx: 3, dy: 7, grain: .16 })}
      <ellipse cx="150" cy="248" rx="80" ry="27" fill="none" stroke="${C.ivoryD}" stroke-width="4"/>
      <circle cx="140" cy="252" r="3" fill="${C.ochreD}" opacity=".6"/><circle cx="168" cy="244" r="2.4" fill="${C.ochreD}" opacity=".6"/></g>
    <path d="M300 170v130M290 170v34q10 10 20 0v-34M300 170v0" stroke="${C.ink}" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M346 170c16 6 16 50 0 60v70" stroke="${C.ink}" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${glucose(80, 110, .9, 'drift')}${glucose(220, 90, .9, 'drift d2')}
  `, { cls: 'sc sc-nutrientShortage', label: 'An empty plate with only a few molecules drifting by' }),

  proteinFlood: () => svg(VB, `
    ${cell(210, 290, 110, { seed: 11 })}
    <g class="rain">${[[60, 40], [150, 10], [250, 50], [330, 20], [110, 110], [280, 120]].map(([x, y], i) => protein(x, y, 1, `pr r${i}`)).join('')}</g>
  `, { cls: 'sc sc-proteinFlood', label: 'Protein molecules pour down onto a cell' }),

  napPlates: () => svg(VB, `
    <path d="M10 330H410" stroke="${C.ivoryD}" stroke-width="4" stroke-linecap="round"/>
    ${sleeper({ x: 150, y: 322, s: 1.1 })}
    <g class="stack">${Array.from({ length: 8 }, (_, i) => `<g>${paperEllipse(366, 318 - i * 15, 40, 11, i % 2 ? C.ivory : '#fbf7ee', { dx: 0, dy: 3, grain: .12 })}<ellipse cx="366" cy="${318 - i * 15}" rx="40" ry="11" fill="none" stroke="${C.ivoryD}" stroke-width="2"/></g>`).join('')}</g>
    <g class="zz">${T(96, 200, 'z', 800, C.teal, 'middle', 28).replace('<text', '<text class="z z0"')}${T(118, 170, 'z', 800, C.teal, 'middle', 34).replace('<text', '<text class="z z1"')}${T(144, 134, 'Z', 800, C.teal, 'middle', 42).replace('<text', '<text class="z z2"')}</g>
  `, { cls: 'sc sc-napPlates', label: 'Someone naps next to a tall stack of empty plates' }),

  insulinSurround: () => svg(VB, `
    ${cell(210, 196, 84, { seed: 6 })}
    <g class="orbit">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return insulin(f(210 + Math.cos(a) * 138), f(196 + Math.sin(a) * 138), 1.5); }).join('')}</g>
  `, { cls: 'sc sc-insulinSurround', label: 'A cell completely surrounded by insulin' }),

  revealScarcity: () => svg(RV, `
    ${paperEllipse(150, 400, 120, 42, C.ivory, { dx: 3, dy: 7, grain: .16 })}<ellipse cx="150" cy="398" rx="80" ry="26" fill="none" stroke="${C.ivoryD}" stroke-width="4"/>
    ${tag(150, 480, 'fewer nutrients coming in', { fill: C.ochreD, size: 17 })}
    ${arrow(236, 400, 284)}
    ${cell(510, 300, 220, { seed: 23, nucleus: false, inner: `
      ${paper(blob(470, 150, 50, .06, 8, 4), C.tealL, { dx: 2, dy: 3, grain: .12 })}<circle cx="478" cy="144" r="15" fill="${C.teal}"/>
      ${mito(380, 250, 80, 20)}${lysosome(620, 430, 18)}${lysosome(400, 400, 15)}
      ${wrap(560, 210, 44)}${wrap(430, 330, 40)}${wrap(600, 330, 36)}
      ${blocks(500, 430, 6, 1.3, 'reuse')}` })}
    ${tag(510, 560, 'recycling turns up', { fill: C.teal, size: 17 })}
  `, { cls: 'sc sc-revealScarcity', label: 'With fewer nutrients coming in, the cell turns up its recycling' }),

  // ---------- Q12 · the mouse study ----------
  mouseFlex: () => svg(VB, `
    ${mouse({ x: 240, y: 320, s: 2.1, arms: `<g class="lift">
      <path d="M-30 -14L-52 -34" stroke="#a39a8f" stroke-width="7" stroke-linecap="round"/>
      <path d="M-70 -36H-36" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
      <rect x="-76" y="-46" width="9" height="20" rx="3" fill="${C.teal}"/><rect x="-40" y="-46" width="9" height="20" rx="3" fill="${C.teal}"/></g>` })}
    <path class="blink" d="M90 130l-10 -12M110 116l-2 -16M130 122l8 -12" stroke="${C.ochre}" stroke-width="4" stroke-linecap="round"/>
  `, { cls: 'sc sc-mouseFlex', label: 'A mouse curls a tiny dumbbell' }),

  timelinesEqual: () => svg(VB, `
    ${timelines([['usual mice', .66, C.sageD], ['more recycling', .66, C.teal]], 50, 150, 290, 125)}
  `, { cls: 'sc sc-timelinesEqual', label: 'Two mouse timelines of the same length' }),

  timelineLonger: () => svg(VB, `
    ${timelines([['usual mice', .56, C.sageD], ['more recycling', .8, C.teal]], 50, 150, 290, 125)}
  `, { cls: 'sc sc-timelineLonger', label: 'Two mouse timelines, one longer than the other' }),

  mouseMaze: () => svg(VB, `
    ${paperRect(50, 50, 320, 280, 20, C.ivory, { dx: 4, dy: 7, grain: .18 })}
    <path d="M70 70H350V310H70ZM70 130H250M310 70V190M130 190H310M130 190V250M190 250H350M250 250V310" stroke="${C.teal}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="route" d="M100 100H330V160H100V220H160V280H330" stroke="${C.ochre}" stroke-width="5" fill="none" stroke-dasharray="2 12" stroke-linecap="round" stroke-linejoin="round"/>
    <g class="runner">${mouse({ x: 318, y: 302, s: .7, flip: true })}
      <g><path d="M320 262l18 -7l18 7l-18 7z" fill="${C.ink}"/><rect x="331" y="264" width="14" height="6" fill="${C.ink}"/><path d="M354 263v12" stroke="${C.ochre}" stroke-width="3" stroke-linecap="round"/></g></g>
  `, { cls: 'sc sc-mouseMaze', label: 'A mouse in a graduation cap solves a maze' }),

  revealLifespan: () => svg(RV, `
    ${tag(380, 60, 'Animal study · mice', { fill: C.ochreD, size: 19 })}
    ${timelines([['usual mice', .56, C.sageD], ['autophagy increased', .8, C.teal]], 90, 220, 520, 170, 1.4)}
    <path d="M90 560H610" stroke="${C.ink}" stroke-opacity=".3" stroke-width="3"/>
    ${T(90, 594, 'birth', 700, C.ink, 'start', 17)}${T(610, 594, 'lifespan', 700, C.ink, 'end', 17)}
  `, { cls: 'sc sc-revealLifespan', label: 'In a mouse study, mice with increased autophagy lived longer' }),
};
