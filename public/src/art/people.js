// People with natural proportions (about 7 heads tall), flat shapes, paper
// clothes. Arms are two straight segments so poses stay clear, never rubbery.
import { C, paper, roundRect } from './kit.js';

const rad = (d) => (d * Math.PI) / 180;
const pt = (x, y, len, deg) => [x + Math.sin(rad(deg)) * len, y + Math.cos(rad(deg)) * len];
const f = (n) => Math.round(n * 10) / 10;

// Standing figure. (x, y) is the point between the feet. Height ~ 250 * s.
// arm: [upper angle, forearm angle] in degrees from hanging straight down,
// positive swings away from the body. face: calm | smile | smug | worried | eat | sleep
export function person(o = {}) {
  const {
    x = 0, y = 0, s = 1,
    skin = C.skin1, hair = C.ink, shirt = C.teal, pants = C.ink, shoes = C.ink,
    armL = [10, 10], armR = [10, 10], face = 'calm', hairStyle = 'short', cls = '',
    hold = '', // svg placed at the right hand, in local units
    holdL = '',
  } = o;
  const H = 250;
  const headR = 17, headY = -H + headR + 2;
  const shoulderY = -H + 46, hipY = -H + 132;
  const sw = 32; // half shoulder width
  const hw = 24; // half hip width

  const handR = pt(sw - 4, shoulderY + 8, 50, armR[0]);
  const handR2 = pt(handR[0], handR[1], 46, armR[0] + armR[1]);
  const handL = pt(-(sw - 4), shoulderY + 8, 50, -armL[0]);
  const handL2 = pt(handL[0], handL[1], 46, -(armL[0] + armL[1]));

  const torso = `M${-sw} ${shoulderY + 6}Q${-sw} ${shoulderY - 4} ${-sw + 12} ${shoulderY - 6}H${sw - 12}Q${sw} ${shoulderY - 4} ${sw} ${shoulderY + 6}L${hw + 4} ${hipY}H${-hw - 4}Z`;
  const legs = `M${-hw} ${hipY - 4}H${hw}L${hw - 2} -8H5L1 ${hipY + 30}L-5 -8H${-hw + 2}Z`;

  const arm = (sx, sy, a, b, side) => `
    <path d="M${f(sx)} ${f(sy)}L${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" stroke="${shirt}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0"/>
    <path d="M${f(sx)} ${f(sy)}L${f(a[0])} ${f(a[1])}" stroke="${shirt}" stroke-width="16" stroke-linecap="round" fill="none"/>
    <path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" stroke="${skin}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <circle cx="${f(b[0])}" cy="${f(b[1])}" r="7.5" fill="${skin}"/>`;

  const faces = {
    calm: `<circle cx="-6" cy="${headY - 1}" r="1.9" fill="${C.ink}"/><circle cx="6" cy="${headY - 1}" r="1.9" fill="${C.ink}"/><path d="M-4 ${headY + 8}q4 3 8 0" stroke="${C.ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    smile: `<path d="M-8 ${headY - 1}q2.2-2.6 4.4 0M3.6 ${headY - 1}q2.2-2.6 4.4 0" stroke="${C.ink}" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M-6 ${headY + 6}q6 6 12 0" stroke="${C.ink}" stroke-width="2" fill="#fff" stroke-linecap="round"/>`,
    smug: `<path d="M-9 ${headY - 2}h5M4 ${headY - 2}h5" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round"/><path d="M-4 ${headY + 7}q5 3 9-2" stroke="${C.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    worried: `<circle cx="-6" cy="${headY}" r="2" fill="${C.ink}"/><circle cx="6" cy="${headY}" r="2" fill="${C.ink}"/><path d="M-10 ${headY - 6}l6-2M10 ${headY - 6}l-6-2" stroke="${C.ink}" stroke-width="1.6" stroke-linecap="round"/><path d="M-4 ${headY + 9}q4-3 8 0" stroke="${C.ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    eat: `<circle cx="-6" cy="${headY - 2}" r="1.9" fill="${C.ink}"/><circle cx="6" cy="${headY - 2}" r="1.9" fill="${C.ink}"/><ellipse cx="0" cy="${headY + 8}" rx="4.5" ry="3.5" fill="${C.ink}"/>`,
    sleep: `<path d="M-9 ${headY}q3 2.5 6 0M3 ${headY}q3 2.5 6 0" stroke="${C.ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="0" cy="${headY + 8}" r="2.2" fill="${C.ink}"/>`,
  };

  const hairs = {
    short: `<path d="M${-headR - 1} ${headY + 2}C${-headR - 2} ${headY - 20} ${headR + 2} ${headY - 24} ${headR + 1} ${headY - 1}C${headR - 4} ${headY - 9} ${-4} ${headY - 12} ${-headR - 1} ${headY + 2}Z" fill="${hair}"/>`,
    bun: `<circle cx="0" cy="${headY - headR - 4}" r="8" fill="${hair}"/><path d="M${-headR - 1} ${headY + 4}C${-headR - 3} ${headY - 22} ${headR + 3} ${headY - 22} ${headR + 1} ${headY + 4}C${headR - 2} ${headY - 8} ${-headR + 2} ${headY - 8} ${-headR - 1} ${headY + 4}Z" fill="${hair}"/>`,
    long: `<path d="M${-headR - 2} ${headY + 22}C${-headR - 6} ${headY - 24} ${headR + 6} ${headY - 24} ${headR + 2} ${headY + 22}L${headR - 3} ${headY + 22}C${headR - 2} ${headY - 6} ${-headR + 2} ${headY - 8} ${-headR + 3} ${headY + 22}Z" fill="${hair}"/>`,
    curly: Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i / 8) * Math.PI; return `<circle cx="${f(Math.cos(a) * (headR + 1))}" cy="${f(headY - 2 + Math.sin(a) * (headR + 1))}" r="7" fill="${hair}"/>`; }).join(''),
  };

  return `<g class="person ${cls}" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="2" rx="40" ry="6" fill="${C.shadow}"/>
    ${paper(legs, pants, { shadow: false, grain: .12 })}
    <path d="M-${hw - 2} -9h${hw - 6}v-4h-${hw - 6}Z" fill="${shoes}"/>
    <path d="M-${hw + 2} -1Q-${hw + 2} -12 -${hw - 6} -12H-4V-1Z" fill="${shoes}"/>
    <path d="M${hw + 2} -1Q${hw + 2} -12 ${hw - 6} -12H4V-1Z" fill="${shoes}"/>
    ${arm(-(sw - 4), shoulderY + 8, handL, handL2, 'L')}
    ${holdL ? `<g transform="translate(${f(handL2[0])} ${f(handL2[1])})">${holdL}</g>` : ''}
    ${paper(torso, shirt, { shadow: false, grain: .14 })}
    <rect x="-6" y="${headY + headR - 4}" width="12" height="12" fill="${skin}"/>
    <path d="M-10 ${shoulderY - 6}q10 9 20 0" fill="${skin}"/>
    ${hairStyle === 'long' ? hairs.long : ''}
    <circle cx="0" cy="${headY}" r="${headR}" fill="${skin}"/>
    <circle cx="${-headR + 1}" cy="${headY + 2}" r="3.5" fill="${skin}"/><circle cx="${headR - 1}" cy="${headY + 2}" r="3.5" fill="${skin}"/>
    ${hairStyle !== 'long' ? hairs[hairStyle] || hairs.short : `<path d="M${-headR - 1} ${headY + 1}C${-headR} ${headY - 21} ${headR} ${headY - 21} ${headR + 1} ${headY + 1}C${headR - 6} ${headY - 10} ${-headR + 6} ${headY - 10} ${-headR - 1} ${headY + 1}Z" fill="${hair}"/>`}
    <g class="face">${faces[face] || faces.calm}</g>
    ${arm(sw - 4, shoulderY + 8, handR, handR2, 'R')}
    ${hold ? `<g transform="translate(${f(handR2[0])} ${f(handR2[1])})"><g class="held">${hold}</g></g>` : ''}
  </g>`;
}

// A person lying on their back, asleep (for the nap scene).
export function sleeper(o = {}) {
  const { x = 0, y = 0, s = 1, skin = C.skin2, hair = C.ink, shirt = C.orange, pants = C.teal } = o;
  return `<g class="sleeper" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="8" rx="130" ry="9" fill="${C.shadow}"/>
    ${paper(roundRect(-60, -26, 110, 34, 16), shirt, { shadow: false, grain: .14 })}
    <path class="belly" d="M-40 -24q40 -40 80 0z" fill="${shirt}"/>
    ${paper(roundRect(40, -22, 92, 26, 12), pants, { shadow: false, grain: .12 })}
    <rect x="124" y="-30" width="14" height="30" rx="5" fill="${C.ink}"/>
    <circle cx="-82" cy="-14" r="19" fill="${skin}"/>
    <path d="M-100 -10c-4-20 14-34 30-26c-10 2-22 10-30 26z" fill="${hair}"/>
    <path d="M-88 -18q3 2.5 6 0M-80 -20q3 2.5 6 0" stroke="${C.ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M-34 -14l40 -6" stroke="${skin}" stroke-width="12" stroke-linecap="round"/>
  </g>`;
}

// Cartoon mouse, drawn with care: lab-mouse proportions, not a mascot.
export function mouse(o = {}) {
  const { x = 0, y = 0, s = 1, flip = false, body = '#a39a8f', ear = C.blush, cls = '', arms = '' } = o;
  return `<g class="mouse ${cls}" transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <ellipse cx="0" cy="4" rx="44" ry="6" fill="${C.shadow}"/>
    <path class="tail" d="M36 -8c30 4 46 -10 40 -26" stroke="${C.blushD}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    ${paper('M-36 -6C-40 -40 -6 -54 22 -44C44 -36 46 -10 36 -4C20 2 -26 4 -36 -6Z', body, { grain: .14, dx: 2, dy: 3 })}
    <path d="M-30 -30C-46 -34 -60 -26 -64 -16C-60 -10 -46 -8 -36 -12Z" fill="${body}"/>
    <circle cx="-26" cy="-44" r="13" fill="${body}"/><circle cx="-26" cy="-44" r="8" fill="${ear}"/>
    <circle cx="-48" cy="-22" r="2.6" fill="${C.ink}"/>
    <circle cx="-64" cy="-16" r="3.2" fill="${C.blushD}"/>
    <path d="M-60 -14l-14 -4M-60 -12l-14 3" stroke="${C.ink}" stroke-width="1" opacity=".5"/>
    <path d="M-18 -2v5M10 -2v5" stroke="${C.blushD}" stroke-width="4" stroke-linecap="round"/>
    ${arms}
  </g>`;
}
