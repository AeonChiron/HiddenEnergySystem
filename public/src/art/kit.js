// Art toolkit: palette, paper layers and the molecule code.
// Style: refined flat shapes first, paper layering for depth, a little grain
// inside chosen surfaces. Everything returns SVG strings.

export const C = {
  ink: '#13282b',        // text and fine line work
  teal: '#1d5e5f',       // deep teal
  tealD: '#123f40',
  tealL: '#5f9c98',
  tealXL: '#cfe3df',
  sage: '#94ae96',       // muted sage
  sageD: '#5f7d66',
  sageL: '#c9d8c6',
  sageXL: '#e7efe3',
  orange: '#c45a2c',     // burnt orange
  orangeD: '#8f3b1a',
  orangeL: '#e59a72',
  orangeXL: '#f6d9c6',
  ochre: '#d39b2e',      // ochre accents
  ochreD: '#9c6c14',
  ochreL: '#ecc878',
  ivory: '#f6efdf',      // warm ivory paper
  ivoryD: '#e6dac0',
  paper: '#fffdf8',
  blush: '#e9b9a3',      // skin / tissue tints within the warm range
  blushD: '#c98b72',
  skin1: '#e6b694', skin2: '#b97e5a', skin3: '#7a4c33',
  shadow: 'rgba(19,40,43,.16)',
  white: '#ffffff',
};

let uid = 0;
export const id = (p = 'a') => `${p}${++uid}`;

// Shared <defs>: grain pattern, soft paper shadow. Mounted once per page.
export function defs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <filter id="grainF" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05"/>
    </filter>
    <pattern id="grain" width="160" height="160" patternUnits="userSpaceOnUse">
      <rect width="160" height="160" filter="url(#grainF)" fill="#000"/>
    </pattern>
    <pattern id="fibre" width="220" height="220" patternUnits="userSpaceOnUse">
      <rect width="220" height="220" fill="none"/>
      <path d="M10 30c30-6 50 4 80-2M120 70c25 4 40-6 70 0M30 140c20-5 45 5 70 0M140 180c20 3 35-4 60 1M60 200c15-3 25 2 40 0" stroke="#8a7a5a" stroke-width="1" stroke-linecap="round" fill="none" opacity=".35"/>
    </pattern>
  </defs>
</svg>`;
}

// One paper layer: soft offset shadow, the fill, then grain inside the shape.
export function paper(d, fill, o = {}) {
  const { shadow = true, grain = .16, dx = 3, dy = 5, stroke = null, sw = 0, cls = '', extra = '' } = o;
  return `<g class="pp ${cls}" ${extra}>
    ${shadow ? `<path d="${d}" fill="${C.shadow}" transform="translate(${dx} ${dy})"/>` : ''}
    <path d="${d}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>
    ${grain ? `<path d="${d}" fill="url(#grain)" opacity="${grain}" style="mix-blend-mode:multiply"/>` : ''}
  </g>`;
}

export function paperCircle(cx, cy, r, fill, o = {}) {
  return paper(circlePath(cx, cy, r), fill, o);
}
export function paperEllipse(cx, cy, rx, ry, fill, o = {}) {
  return paper(ellipsePath(cx, cy, rx, ry), fill, o);
}
export function paperRect(x, y, w, h, r, fill, o = {}) {
  return paper(roundRect(x, y, w, h, r), fill, o);
}

export const circlePath = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
export const ellipsePath = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
export const roundRect = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

// Organic blob through n points around a centre (paper cut-out feel).
export function blob(cx, cy, r, wobble = .08, n = 9, seed = 1) {
  const pts = [];
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rnd() - .5) * 2 * wobble);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smooth(pts, true);
}
export function blobXY(cx, cy, rx, ry, wobble = .08, n = 9, seed = 1) {
  const pts = [];
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rnd() - .5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts, true);
}

// Catmull-Rom to Bezier.
export function smooth(pts, closed = false, t = 1) {
  const p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${f(p[1][0])} ${f(p[1][1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
const f = (n) => Math.round(n * 10) / 10;

// ---------- the molecule code (shape + colour, never colour alone) ----------
// Glucose: ochre hexagon.
export function glucose(x, y, s = 1, cls = '') {
  const r = 13 * s;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return `${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)}`;
  }).join(' ');
  return `<g class="mol glu ${cls}"><polygon points="${pts}" fill="${C.ochre}" stroke="${C.ochreD}" stroke-width="${2.2 * s}" stroke-linejoin="round"/><polygon points="${pts}" fill="none" stroke="${C.ochreL}" stroke-width="${1.2 * s}" transform="translate(${x} ${y}) scale(.55) translate(${-x} ${-y})"/></g>`;
}
// Fat-derived molecule: burnt-orange zigzag chain (fatty acid).
export function fatty(x, y, s = 1, cls = '') {
  const w = 9 * s, h = 7 * s;
  let d = `M${x - 3 * w} ${y}`;
  for (let i = 0; i < 6; i++) d += `L${f(x - 3 * w + (i + 1) * w)} ${f(y + (i % 2 ? 0 : -h))}`;
  return `<g class="mol fat ${cls}"><circle cx="${x - 3 * w}" cy="${y}" r="${5.5 * s}" fill="${C.orange}"/><path d="${d}" fill="none" stroke="${C.orange}" stroke-width="${4 * s}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
// Fat droplet (stored fat): ivory-orange drop with a highlight.
export function droplet(x, y, r = 16, cls = '') {
  return `<g class="drop ${cls}"><circle cx="${x}" cy="${y}" r="${r}" fill="${C.ochreL}" stroke="${C.ochreD}" stroke-width="2"/><ellipse cx="${x - r * .35}" cy="${y - r * .35}" rx="${r * .28}" ry="${r * .18}" fill="#fff6dc" transform="rotate(-30 ${x} ${y})"/></g>`;
}
// Ketone: small teal diamond.
export function ketone(x, y, s = 1, cls = '') {
  const r = 11 * s;
  return `<g class="mol ket ${cls}"><path d="M${x} ${y - r}L${x + r * .8} ${y}L${x} ${y + r}L${x - r * .8} ${y}Z" fill="${C.tealL}" stroke="${C.tealD}" stroke-width="${2 * s}" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="${2.4 * s}" fill="${C.tealXL}"/></g>`;
}
// Insulin: a small teal signal.
export function insulin(x, y, s = 1, cls = '') {
  // A soft signal drop: teal disc with a pale ring, no mechanical key shape.
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="mol ins ${cls}"><circle cx="0" cy="0" r="9" fill="${C.teal}"/><circle cx="0" cy="0" r="4.2" fill="${C.tealXL}"/></g></g>`;
}
// Amino acid / protein bead.
export function amino(x, y, s = 1, fill = C.sage, cls = '') {
  return `<circle class="mol amino ${cls}" cx="${x}" cy="${y}" r="${6 * s}" fill="${fill}" stroke="${C.sageD}" stroke-width="${1.8 * s}"/>`;
}
// Protein: a short chain of beads.
export function protein(x, y, s = 1, cls = '') {
  const beads = [[0, 0], [11, -6], [22, -1], [31, 7], [42, 4], [52, -4]];
  const fills = [C.sage, C.sageL, C.sage, C.sageD, C.sageL, C.sage];
  const path = beads.map(([a, b], i) => `${i ? 'L' : 'M'}${f(x + a * s)} ${f(y + b * s)}`).join('');
  return `<g class="mol prot ${cls}"><path d="${path}" stroke="${C.sageD}" stroke-width="${2.5 * s}" fill="none"/>${beads.map(([a, b], i) => amino(x + a * s, y + b * s, s, fills[i])).join('')}</g>`;
}

// ---------- shared labels ----------
export function tag(x, y, text, o = {}) {
  const { fill = C.ink, color = '#fff', size = 15, anchor = 'middle', cls = '' } = o;
  const w = text.length * size * .58 + 22;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return `<g class="tag ${cls}"><rect x="${f(x0)}" y="${y - size * .95}" width="${f(w)}" height="${size * 1.9}" rx="${size * .95}" fill="${fill}"/><text x="${f(x0 + w / 2)}" y="${y + size * .35}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${color}" font-family="Bricolage, sans-serif">${text}</text></g>`;
}

export function svg(vb, body, o = {}) {
  const { cls = '', label = '' } = o;
  return `<svg class="art ${cls}" viewBox="${vb}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

// Soft ivory paper ground that sits under an answer's art (instead of a box).
export function paperGround(seed = 1) {
  return svg('0 0 420 380', paper(blobXY(210, 200, 196, 166, .06, 11, seed), C.ivory, { dx: 4, dy: 8, grain: .2 }), { cls: 'ground' });
}
