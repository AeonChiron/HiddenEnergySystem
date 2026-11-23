// Round 2 · The Energy Crisis. One mini-scene per answer plus the reveals.
// Panel art viewBox is 420 x 380. Animated parts carry classes that art.css
// drives only while the panel is playing (or the zone is live).
import { C, paper, paperCircle, paperRect, paperEllipse, blob, blobXY, roundRect, glucose, fatty, droplet, ketone, insulin, protein, tag, svg } from './kit.js';
import { cell, vessel, stomach, pancreas, liver, brain, mito, lysosome, damaged, blocks } from './bio.js';
import { person } from './people.js';

const VB = '0 0 420 380';
const f = (n) => Math.round(n * 10) / 10;
const gl = (pts, cls = '', s = 1) => pts.map(([x, y], i) => glucose(x, y, s, `${cls} d${i % 6}`)).join('');

// Energy store bar inside a cell.
const store = (x, y, cls) => `<g class="store ${cls}"><rect x="${x}" y="${y}" width="16" height="44" rx="5" fill="${C.ivory}" stroke="${C.ink}" stroke-opacity=".35" stroke-width="2"/><rect class="store-fill" x="${x + 3}" y="${y + 3}" width="10" height="38" rx="3" fill="${C.ochre}"/></g>`;

export const scenes = {
  // ---------- Q5 · insulin ----------
  sugarIntoCells: () => svg(VB, `
    ${vessel(-10, 430, 92, 76)}
    ${gl([[40, 86], [110, 100], [190, 80], [270, 102], [350, 84]], 'flow')}
    ${cell(110, 280, 64, { seed: 2, inner: store(150, 262, 'fill-up') })}
    ${cell(310, 285, 60, { seed: 6, inner: store(348, 266, 'fill-up late') })}
    ${insulin(96, 214, 1.1, 'key k1')}${insulin(296, 222, 1.1, 'key k2')}
    ${glucose(110, 140, 1, 'drop-in a1')}${glucose(310, 146, 1, 'drop-in a2')}${glucose(140, 140, 1, 'drop-in a3')}
  `, { cls: 'sc sc-sugarIntoCells', label: 'Sugar moves from the blood into cells' }),

  sugarBarrier: () => svg(VB, `
    ${paper('M20 70C70 50 110 90 90 140S20 190 40 240S120 300 90 340', 'none', { shadow: false, grain: 0 })}
    <path d="M30 60C90 40 130 100 100 150S20 200 50 250S130 310 100 350" stroke="${C.blush}" stroke-width="44" fill="none" stroke-linecap="round"/>
    <path d="M30 60C90 40 130 100 100 150S20 200 50 250S130 310 100 350" stroke="${C.blushD}" stroke-width="3" fill="none" stroke-dasharray="2 12" stroke-linecap="round" opacity=".6"/>
    <g class="wall">${paper('M196 40L240 52V320L196 336Z', C.teal, { dx: 4, dy: 6, grain: .22 })}
      ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M200 ${80 + i * 42}H236" stroke="${C.tealD}" stroke-width="3" opacity=".6"/>`).join('')}</g>
    <g class="vessel-v">${paper('M320 0H392V380H320Z', C.orange, { dx: 0, dy: 0, grain: .22 })}<rect x="332" y="0" width="48" height="380" fill="${C.orangeXL}"/></g>
    ${glucose(150, 110, 1, 'bounce b1')}${glucose(150, 200, 1, 'bounce b2')}${glucose(150, 290, 1, 'bounce b3')}
    ${tag(356, 352, 'blood', { fill: C.orangeD, size: 14 })}
  `, { cls: 'sc sc-sugarBarrier', label: 'A wall blocks sugar from reaching the blood' }),

  sugarToFatGut: () => svg(VB, `
    ${stomach(205, 196, 1.45)}
    <g class="morph m1">${glucose(186, 168, 1.1, 'as-sugar')}${droplet(186, 168, 14, 'as-fat')}</g>
    <g class="morph m2">${glucose(236, 200, 1.1, 'as-sugar')}${droplet(236, 200, 14, 'as-fat')}</g>
    <g class="morph m3">${glucose(200, 236, 1.1, 'as-sugar')}${droplet(200, 236, 14, 'as-fat')}</g>
    <g class="morph m4">${glucose(262, 160, 1.1, 'as-sugar')}${droplet(262, 160, 14, 'as-fat')}</g>
    ${gl([[60, 60], [100, 40]], 'fall')}
  `, { cls: 'sc sc-sugarToFatGut', label: 'Sugar cubes turn into fat droplets inside the gut' }),

  stomachFull: () => svg(VB, `
    ${stomach(190, 214, 1.4, { face: `<g class="smug"><path d="M-6 -6h12M24 -8h12" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/><path d="M4 14q12 10 26 -2" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round"/></g>` })}
    <g class="sign">
      <path d="M318 196V330" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>
      ${paperRect(236, 70, 170, 128, 14, C.ivory, { dx: 4, dy: 7, grain: .2 })}
      <text x="321" y="150" text-anchor="middle" font-size="62" font-weight="800" fill="${C.orange}" font-family="Bricolage, sans-serif" letter-spacing="2">FULL</text>
      <text x="321" y="180" text-anchor="middle" font-size="17" font-weight="700" fill="${C.ink}" font-family="Bricolage, sans-serif">for the day</text>
    </g>
  `, { cls: 'sc sc-stomachFull', label: 'A stomach holds up a big FULL sign' }),

  revealInsulin: () => svg('0 0 760 620', `
    ${vessel(-20, 780, 120, 96)}
    ${gl([[60, 112], [160, 130], [260, 104], [380, 130], [500, 110], [620, 128], [720, 108]], 'flow')}
    ${tag(380, 40, 'blood sugar after a meal', { fill: C.orangeD, size: 18 })}
    ${cell(150, 420, 110, { seed: 2, inner: store(220, 380, 'fill-up') })}
    ${cell(400, 440, 100, { seed: 7, inner: store(462, 404, 'fill-up late') })}
    ${cell(630, 420, 104, { seed: 9, inner: store(694, 384, 'fill-up later') })}
    ${insulin(140, 300, 1.6, 'key k1')}${insulin(392, 330, 1.6, 'key k2')}${insulin(620, 306, 1.6, 'key k3')}
    ${glucose(150, 190, 1.3, 'drop-in a1')}${glucose(400, 200, 1.3, 'drop-in a2')}${glucose(630, 190, 1.3, 'drop-in a3')}
    ${tag(150, 590, 'used for energy', { fill: C.teal, size: 18 })}${tag(520, 590, 'stored for later', { fill: C.teal, size: 18 })}
  `, { cls: 'sc sc-revealInsulin', label: 'Insulin lets sugar leave the blood and enter cells, where energy stores fill' }),

  // ---------- Q6 · insulin resistance ----------
  sugarVanish: () => svg(VB, `
    ${vessel(-10, 430, 92, 76)}
    ${gl([[50, 90], [130, 96], [210, 84], [290, 98], [370, 88]], 'vanish')}
    ${cell(110, 280, 64, { seed: 3 })}${cell(310, 285, 60, { seed: 8 })}
    <g class="zip">${[0, 1, 2].map((i) => `<path d="M${90 + i * 100} 140v60" stroke="${C.ochre}" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 10"/>`).join('')}</g>
  `, { cls: 'sc sc-sugarVanish', label: 'Sugar disappears from the blood into cells very quickly' }),

  sugarPileUp: () => svg(VB, `
    ${vessel(-10, 430, 110, 150)}
    <g class="pile">${Array.from({ length: 16 }, (_, i) => glucose(30 + (i % 8) * 52, 150 - Math.floor(i / 8) * 30 + (i % 2) * 6, 1, `p${i % 4}`)).join('')}</g>
    ${cell(110, 300, 50, { seed: 3, fill: C.ivory })}${cell(310, 305, 46, { seed: 8, fill: C.ivory })}
    ${insulin(100, 250, 1, 'key-bounce')}${insulin(300, 256, 1, 'key-bounce late')}
  `, { cls: 'sc sc-sugarPileUp', label: 'Sugar builds up in the blood because cells respond weakly' }),

  pancreasStops: () => svg(VB, `
    ${pancreas(210, 180, 1.4)}
    <g class="stream">${[0, 1, 2, 3].map((i) => insulin(110 + i * 64, 270 + (i % 2) * 18, 1.1, `ins i${i}`)).join('')}</g>
    <g class="closed">${paperRect(150, 300, 120, 50, 10, C.ink, { dx: 3, dy: 5, grain: 0 })}<text x="210" y="333" text-anchor="middle" font-size="24" font-weight="800" fill="#fff" font-family="Bricolage, sans-serif">CLOSED</text></g>
  `, { cls: 'sc sc-pancreasStops', label: 'The pancreas suddenly stops releasing insulin' }),

  donutShield: () => svg(VB, `
    <g class="donuts">${[[40, 330], [80, 330], [120, 330], [60, 300], [100, 300], [80, 270]].map(([x, y], i) => donut(x, y, i)).join('')}</g>
    ${person({ x: 230, y: 360, s: 1.12, shirt: C.orange, pants: C.teal, skin: C.skin2, hairStyle: 'curly', face: 'smug', armR: [60, 70], armL: [20, 10], hold: donut(0, -6, 9, .9) })}
    <g class="shield">${paper('M300 70C340 86 380 80 400 70C404 160 380 230 340 260C300 230 286 160 300 70Z', C.tealL, { dx: 4, dy: 6, grain: .2 })}
      <path d="M314 96C338 104 362 102 384 96" stroke="${C.tealXL}" stroke-width="6" stroke-linecap="round" fill="none"/></g>
    <g class="bounce-off">${glucose(380, 300, 1, 'bo1')}${glucose(395, 330, 1, 'bo2')}</g>
  `, { cls: 'sc sc-donutShield', label: 'A person eats a mountain of donuts behind a shield' }),

  revealResistance: () => svg('0 0 760 620', `
    ${pancreas(170, 160, 1.4)}
    ${tag(170, 60, 'pancreas works harder', { fill: C.ochreD, size: 18 })}
    <g class="pump">${[0, 1, 2, 3, 4, 5].map((i) => insulin(110 + (i % 3) * 50, 240 + Math.floor(i / 3) * 36, 1.3, `ins i${i}`)).join('')}</g>
    ${vessel(330, 780, 200, 140)}
    <g class="pile">${Array.from({ length: 18 }, (_, i) => glucose(360 + (i % 9) * 46, 236 - Math.floor(i / 9) * 32 + (i % 2) * 5, 1.1, `p${i % 4}`)).join('')}</g>
    ${tag(560, 110, 'sugar builds up', { fill: C.orangeD, size: 18 })}
    ${cell(470, 470, 92, { seed: 3, fill: C.ivory })}${cell(670, 480, 80, { seed: 8, fill: C.ivory })}
    ${insulin(460, 368, 1.4, 'key-bounce')}${insulin(664, 390, 1.4, 'key-bounce late')}
    ${tag(570, 600, 'cells respond less', { fill: C.teal, size: 18 })}
  `, { cls: 'sc sc-revealResistance', label: 'The pancreas releases more insulin while cells respond less and sugar accumulates' }),

  // ---------- Q7 · ketosis ----------
  emptyBattery: () => svg(VB, `
    ${person({ x: 140, y: 360, s: 1.15, shirt: C.sage, pants: C.ink, skin: C.skin1, hairStyle: 'bun', face: 'worried', armR: [12, 8], armL: [12, 8] })}
    <g class="battery">${paperRect(250, 120, 130, 70, 12, C.ivory, { dx: 3, dy: 5, grain: .18 })}
      <rect x="380" y="140" width="12" height="30" rx="4" fill="${C.ink}"/>
      <rect x="250" y="120" width="130" height="70" rx="12" fill="none" stroke="${C.ink}" stroke-width="5"/>
      <rect class="cell-bar" x="262" y="132" width="22" height="46" rx="4" fill="${C.orange}"/>
    </g>
    <text class="blink" x="315" y="230" text-anchor="middle" font-size="22" font-weight="800" fill="${C.orange}" font-family="Bricolage, sans-serif">0%</text>
  `, { cls: 'sc sc-emptyBattery', label: 'A person with an empty battery' }),

  proteinGenerator: () => svg(VB, `
    ${protein(30, 110, 1, 'march m1')}${protein(30, 200, 1, 'march m2')}${protein(30, 290, 1, 'march m3')}
    <g class="gen">${paperRect(250, 110, 140, 180, 18, C.teal, { dx: 4, dy: 7, grain: .22 })}
      <circle cx="320" cy="180" r="38" fill="${C.tealD}"/><g class="spin" style="transform-origin:320px 180px">${[0, 60, 120].map((a) => `<rect x="316" y="146" width="8" height="68" rx="4" fill="${C.tealXL}" transform="rotate(${a} 320 180)"/>`).join('')}</g>
      <rect x="276" y="236" width="88" height="34" rx="8" fill="${C.tealD}"/><rect class="meter" x="282" y="242" width="40" height="22" rx="5" fill="${C.ochre}"/></g>
  `, { cls: 'sc sc-proteinGenerator', label: 'Protein molecules travel toward an energy generator' }),

  fatToKetones: () => svg(VB, `
    ${droplet(60, 110, 26, 'src')}${droplet(48, 190, 20, 'src')}
    <g class="fa">${fatty(130, 110, 1, 'fa1')}${fatty(130, 170, 1, 'fa2')}</g>
    ${liver(250, 200, .95)}
    ${tag(250, 300, 'liver', { fill: C.orangeD, size: 15 })}
    <g class="ko">${ketone(360, 130, 1.2, 'k1')}${ketone(380, 200, 1.2, 'k2')}${ketone(356, 260, 1.2, 'k3')}</g>
  `, { cls: 'sc sc-fatToKetones', label: 'Fat-derived molecules reach the liver and leave as ketones' }),

  butterScale: () => svg(VB, `
    ${person({ x: 120, y: 360, s: 1.12, shirt: C.ochre, pants: C.teal, skin: C.skin3, hairStyle: 'short', face: 'eat', armR: [150, 40], armL: [14, 8], hold: butter(-10, -10) })}
    <g class="scale">${paperRect(240, 250, 150, 100, 18, C.ivory, { dx: 3, dy: 6, grain: .18 })}
      <rect x="262" y="270" width="106" height="44" rx="8" fill="${C.ink}"/>
      <text class="num" x="315" y="302" text-anchor="middle" font-size="26" font-weight="800" fill="${C.ochreL}" font-family="Bricolage, sans-serif"><tspan class="n1">82</tspan><tspan class="n2" x="315">74</tspan><tspan class="n3" x="315">61</tspan></text>
      <path class="arrow" d="M316 200v36m-14 -14l14 14l14 -14" stroke="${C.orange}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
  `, { cls: 'sc sc-butterScale', label: 'Someone eats butter while the numbers on a scale drop fast' }),

  revealKetosis: () => svg('0 0 760 620', `
    <g class="gauge">${paperRect(30, 40, 300, 120, 20, C.ivory, { dx: 3, dy: 6, grain: .18 })}
      <text x="60" y="84" font-size="20" font-weight="800" fill="${C.ink}" font-family="Bricolage, sans-serif">Fuel mix</text>
      <rect x="60" y="100" width="240" height="30" rx="15" fill="${C.ivoryD}"/>
      <rect class="fuel-sugar" x="60" y="100" width="240" height="30" rx="15" fill="${C.ochre}"/>
      <rect class="fuel-fat" x="60" y="100" width="0" height="30" rx="15" fill="${C.tealL}"/>
      ${glucose(78, 150, .8)}<text x="94" y="155" font-size="14" font-weight="700" fill="${C.ink}" font-family="Bricolage, sans-serif">sugar</text>
      ${ketone(186, 150, .8)}<text x="200" y="155" font-size="14" font-weight="700" fill="${C.ink}" font-family="Bricolage, sans-serif">fat and ketones</text></g>
    ${droplet(90, 330, 34, 'src')}${droplet(70, 430, 26, 'src')}${droplet(140, 400, 22, 'src')}
    <g class="fa">${fatty(220, 330, 1.2, 'fa1')}${fatty(220, 420, 1.2, 'fa2')}</g>
    ${liver(390, 390, 1.1)}${tag(390, 500, 'liver', { fill: C.orangeD, size: 18 })}
    ${brain(640, 220, .95)}${tag(640, 320, 'brain', { fill: C.blushD, size: 18 })}
    <path d="M470 340C540 320 580 300 610 290" stroke="${C.tealL}" stroke-width="5" fill="none" stroke-dasharray="4 12" stroke-linecap="round"/>
    <g class="ko">${ketone(500, 330, 1.3, 'k1')}${ketone(540, 312, 1.3, 'k2')}${ketone(580, 296, 1.3, 'k3')}</g>
  `, { cls: 'sc sc-revealKetosis', label: 'The fuel mix shifts toward fat: fat goes to the liver, ketones go to the brain' }),

  // ---------- Q8 · why ketosis matters ----------
  cellRecycle: () => svg(VB, `
    ${cell(210, 196, 150, { seed: 12, nucleus: false, inner: `
      ${mito(130, 130, 60, 20)}${lysosome(300, 270, 16)}
      <g class="phago"><circle cx="270" cy="150" r="44" fill="none" stroke="${C.teal}" stroke-width="7" stroke-dasharray="230 60" class="phago-ring"/>${damaged(270, 150, .9, 10, 'dmg')}</g>
      ${blocks(150, 270, 5, 1, 'reuse')}` })}
  `, { cls: 'sc sc-cellRecycle', label: 'A cell breaks down and recycles damaged components' }),

  ketoneBrain: () => svg(VB, `
    ${brain(250, 180, 1.2, { cls: 'glow-brain' })}
    <g class="ko">${ketone(40, 120, 1.2, 'k1')}${ketone(60, 220, 1.2, 'k2')}${ketone(30, 300, 1.2, 'k3')}</g>
    <g class="sparks">${[[200, 60], [330, 90], [360, 230], [150, 290]].map(([x, y], i) => `<path class="spk s${i}" d="M${x} ${y}l6 -14l6 14l14 6l-14 6l-6 14l-6 -14l-14 -6z" fill="${C.ochre}"/>`).join('')}</g>
  `, { cls: 'sc sc-ketoneBrain', label: 'Ketones enter the brain and power its activity' }),

  hungerMeter: () => svg(VB, `
    ${person({ x: 110, y: 360, s: 1.1, shirt: C.tealL, pants: C.ink, skin: C.skin2, hairStyle: 'long', hair: C.orangeD, face: 'calm', armR: [10, 6], armL: [10, 6] })}
    ${paperRect(220, 70, 170, 240, 20, C.ivory, { dx: 4, dy: 7, grain: .18 })}
    <text x="305" y="110" text-anchor="middle" font-size="22" font-weight="800" fill="${C.ink}" font-family="Bricolage, sans-serif">Hunger</text>
    <rect x="285" y="126" width="40" height="160" rx="20" fill="${C.ivoryD}"/>
    <rect class="hunger" x="285" y="126" width="40" height="160" rx="20" fill="${C.orange}"/>
  `, { cls: 'sc sc-hungerMeter', label: 'A hunger meter gradually goes down' }),

  fatReserves: () => svg(VB, `
    <g class="reserve">${[[60, 140], [100, 110], [80, 190], [130, 160], [120, 230], [70, 260]].map(([x, y], i) => droplet(x, y, 22, `r${i}`)).join('')}</g>
    <g class="fa">${fatty(200, 150, 1, 'fa1')}${fatty(200, 230, 1, 'fa2')}</g>
    ${paperRect(270, 80, 120, 230, 20, C.ivory, { dx: 4, dy: 7, grain: .18 })}
    <text x="330" y="118" text-anchor="middle" font-size="20" font-weight="800" fill="${C.ink}" font-family="Bricolage, sans-serif">Energy</text>
    <rect x="310" y="132" width="40" height="160" rx="20" fill="${C.ivoryD}"/>
    <rect class="energy" x="310" y="132" width="40" height="160" rx="20" fill="${C.teal}"/>
  `, { cls: 'sc sc-fatReserves', label: 'Stored fat supplies an energy meter' }),

  revealAllKetosis: () => svg('0 0 760 620', `
    ${cell(380, 320, 250, { seed: 21, nucleus: true, inner: `
      ${mito(250, 220, 90, 20)}${mito(520, 430, 80, -30)}${lysosome(270, 430, 20)}${lysosome(540, 230, 16)}
      <g class="phago"><circle cx="470" cy="300" r="50" fill="none" stroke="${C.teal}" stroke-width="8" stroke-dasharray="260 60" class="phago-ring"/>${damaged(470, 300, 1, 10, 'dmg')}</g>
      ${blocks(300, 330, 5, 1.2, 'reuse')}` })}
    ${tag(380, 600, 'Next: inside a single cell', { fill: C.teal, size: 18 })}
  `, { cls: 'sc sc-revealAllKetosis', label: 'Zooming into a single living cell' }),
};

function donut(x, y, i = 0, s = 1) {
  const icing = [C.orangeL, C.blush, C.ochreL][i % 3];
  return `<g class="donut" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="22" ry="14" fill="${C.ochre}"/><ellipse cx="0" cy="-3" rx="19" ry="10" fill="${icing}"/><ellipse cx="0" cy="-2" rx="6" ry="3.5" fill="${C.ochreD}"/>${[[-10, -6], [8, -8], [12, 0], [-6, 2]].map(([a, b]) => `<rect x="${a}" y="${b}" width="4" height="1.8" rx=".9" fill="${C.teal}" transform="rotate(${a * 4} ${a} ${b})"/>`).join('')}</g>`;
}

function butter(x, y) {
  return `<g transform="translate(${x} ${y})"><path d="M-14 -8L14 -12L20 4L-8 8Z" fill="${C.ochreL}" stroke="${C.ochreD}" stroke-width="1.5"/><path d="M-14 -8L-8 8L-8 12L-14 -4Z" fill="${C.ochre}"/></g>`;
}
