// Seed's Midjourney illustrations (Nov 2026). Each scene is one finished picture.
// Motion stays gentle so the pictures keep their quality: a slow camera drift,
// and on intros and reveals a faint ripple, as if the paper were breathing.
const MOVES = ['in', 'left', 'out', 'right', 'up'];

const IDS = [
  'lobby', 'round1', 'round2', 'round3',
  'sugarIntoCells', 'sugarBarrier', 'stomachFull', 'revealInsulin',
  'pancreasStops', 'sugarPileUp', 'donutShield', 'revealResistance',
  'fatToKetones', 'emptyBattery', 'butterScale', 'revealKetosis',
  'ketoneBrain', 'hungerMeter', 'fatReserves', 'revealAllKetosis',
  'cellDivide', 'autophagosome', 'hungryCell', 'revealAutophagy',
  'brainPlaques', 'abnormalCells', 'glucoseCells', 'revealDiseases',
  'proteinFlood', 'nutrientShortage', 'napPlates', 'revealScarcity',
  'timelineLonger', 'timelinesEqual', 'mouseMaze', 'revealLifespan',
];

export const imgSrc = (id) => (globalThis.HE_IMG && globalThis.HE_IMG[`art/${id}`]) || `/img/art/${id}.webp`;

// Pictures whose subject was cut out cleanly (Nov 25): the subject sits on its
// own layer in front of the background, so a camera move gives real depth.
// The single-file preview has no layers and keeps the flat picture.
const DEPTH = new Set(["abnormalCells", "autophagosome", "brainPlaques", "butterScale", "cellDivide", "donutShield", "emptyBattery", "fatReserves", "fatToKetones", "glucoseCells", "hungerMeter", "ketoneBrain", "napPlates", "nutrientShortage", "proteinFlood", "revealAllKetosis", "revealDiseases", "revealInsulin", "revealKetosis", "revealLifespan", "revealResistance", "revealScarcity", "round1", "round2", "stomachFull", "sugarBarrier", "sugarIntoCells", "sugarPileUp", "timelinesEqual"]);

function pic(id, i) {
  const big = id.startsWith('reveal') || id.startsWith('round') || id === 'lobby';
  const move = MOVES[i % MOVES.length];
  if (DEPTH.has(id) && !globalThis.HE_IMG) {
    // If a layer fails to load, fall back to the flat picture.
    const flat = `this.closest('.pic').classList.remove('depth');this.closest('.pic').querySelector('.fg')?.remove();this.onerror=null;this.src='${imgSrc(id)}'`;
    return `<div class="pic depth pic-${move}${big ? ' pic-big' : ''}" data-scene="${id}"><img class="bg" src="/img/art/depth/${id}-bg.webp" alt="" draggable="false" decoding="async" onerror="${flat}"><img class="fg" src="/img/art/depth/${id}-fg.webp" alt="" draggable="false" decoding="async" onerror="this.previousElementSibling.onerror()"></div>`;
  }
  return `<div class="pic pic-${move}${big ? ' pic-big' : ''}" data-scene="${id}"><img src="${imgSrc(id)}" alt="" draggable="false" decoding="async"></div>`;
}

export const scenes = Object.fromEntries(IDS.map((id, i) => [id, () => pic(id, i)]));

// Shared SVG filter for the ripple, added once to the page's art defs.
export const rippleDefs = `
  <filter id="he-ripple" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="3" result="n">
      <animate attributeName="baseFrequency" dur="16s" values="0.006 0.012;0.009 0.016;0.006 0.012" repeatCount="indefinite"/>
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
