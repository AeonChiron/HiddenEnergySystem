// Illustration registry: scene id -> SVG/HTML string.
import { scenes as r2 } from './scenes-r2.js';
import { scenes as r3 } from './scenes-r3.js';
import { scenes as v2 } from './scenes-v2.js';
import { scenes as pics, rippleDefs } from './scenes-img.js';
import { logoMark, bigCell, bodyWorld, round1Art, trophy, personIcon } from './world.js';
import { defs } from './kit.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SCENES = {
  ...r2,
  ...r3,
  lobby: () => bigCell(),
  round1: () => round1Art(),
  round2: () => bodyWorld(),
  round3: () => bigCell(),
  ...v2, // second pass after Seed's review; overrides earlier scenes
  ...pics, // Seed's Midjourney pictures; override the drawn scenes
  trophy: () => trophy(),
  person: () => personIcon(),
  logo: () => logoMark(),
};

export function registerScenes(map) { Object.assign(SCENES, map); }
export const artDefs = () => defs().replace('</defs>', `${rippleDefs}</defs>`);
export const hasScene = (id) => !!SCENES[id];

export function art(id) {
  if (SCENES[id]) return SCENES[id]();
  return `<svg class="art art-placeholder" viewBox="0 0 420 380" role="img" aria-label="${esc(id)}">
    <rect x="6" y="6" width="408" height="368" rx="28" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="14 12" opacity=".35"/>
    <text x="210" y="196" text-anchor="middle" font-size="24" fill="currentColor" opacity=".5">${esc(id)}</text>
  </svg>`;
}

export function foodArt(food) {
  const src = (globalThis.HE_IMG && globalThis.HE_IMG[food]) || `/img/food/${food}.webp`;
  return `<img class="food-photo" src="${src}" alt="" draggable="false">`;
}
