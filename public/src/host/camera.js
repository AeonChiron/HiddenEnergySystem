import { clock } from './clock.js';
// Camera over one continuous whiteboard. World units are design pixels at a
// 1920x1080 reference; the stage scales to whatever screen the host has.
//   cam.set({x, y, z})               jump
// PACE: Seed asked for camera moves about 75% faster (Nov 23).
export const PACE = 1 / 1.75;
//   await cam.whoosh({x, y, z}, ms)  fast horizontal move with a small zoom dip
//   await cam.fly({x, y, z}, ms)     smooth zoom-out / travel / zoom-in arc

// The stage is 1920x1080 (a projector), or 1080x1920 on a tall screen such as
// a phone held upright (opts.design).
let DESIGN_W = 1920;
let DESIGN_H = 1080;
// Phones: no blur smear on fast moves (a blur over the whole board is heavy).
const LITE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const DOT = 64; // the faint dot grid on the canvas, in world px

export const ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  inOutExpo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  outBack: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
  // Fast out, long landing: an expo in-out on warped time spends about two
  // thirds of the move settling, the way a real camera move lands.
  launch: (t) => ease.inOutExpo(t ** 0.62),
};

export class Camera {
  constructor(viewport, world, opts = {}) {
    this.viewport = viewport;
    this.world = world;
    this.pos = { x: 0, y: 0, z: 1 };
    this.speed = opts.speed || 1;
    this.onMove = opts.onMove || null;
    this.onFit = opts.onFit || null;
    this.anim = null;
    this.fit = 1;
    this.parts = []; // zones to cull: { el, x, y, w, h }
    if (opts.design) { DESIGN_W = opts.design.w; DESIGN_H = opts.design.h; }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(viewport);
    this.resize();
  }

  resize() {
    const r = this.viewport.getBoundingClientRect();
    this.vw = r.width || DESIGN_W;
    this.vh = r.height || DESIGN_H;
    this.fit = Math.min(this.vw / DESIGN_W, this.vh / DESIGN_H);
    // Show exactly the 16:9 stage. On a 4:3 projector the bands above and
    // below stay blank instead of showing the next scene early.
    const w = DESIGN_W * this.fit, h = DESIGN_H * this.fit;
    const box = { left: (this.vw - w) / 2, top: (this.vh - h) / 2, w, h };
    this.viewport.style.clipPath = box.left > 0.5 || box.top > 0.5 ? `inset(${box.top.toFixed(1)}px ${box.left.toFixed(1)}px)` : '';
    this.onFit && this.onFit(this.fit, box);
    this.apply();
  }

  apply() {
    const { x, y, z } = this.pos;
    const s = z * this.fit;
    const tx = this.vw / 2 - x * s, ty = this.vh / 2 - y * s;
    this.world.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(5)})`;
    // The dot grid is the viewport's own background, moved with the camera,
    // instead of a giant layer inside the world (phones crash drawing that).
    const d = DOT * s, vs = this.viewport.style;
    vs.backgroundSize = `${d.toFixed(2)}px ${d.toFixed(2)}px`;
    vs.backgroundPosition = `${(tx % d).toFixed(2)}px ${(ty % d).toFixed(2)}px`;
    this.cull(tx, ty, s);
    this.onMove && this.onMove(this.pos);
  }

  // Scenes far off screen are not drawn at all (visibility hidden): a phone
  // then only paints the one or two scenes the camera can see.
  setParts(parts) { this.parts = parts; this.apply(); }
  cull(tx, ty, s) {
    if (!this.parts.length) return;
    const pad = 400;
    const L = (-tx) / s - pad, T = (-ty) / s - pad, R = (this.vw - tx) / s + pad, B = (this.vh - ty) / s + pad;
    for (const p of this.parts) {
      const show = p.x < R && p.x + p.w > L && p.y < B && p.y + p.h > T;
      if (show !== p.shown) { p.shown = show; p.el.style.visibility = show ? '' : 'hidden'; }
    }
  }

  set(p) {
    this.stop();
    this.pos = { ...this.pos, ...p };
    this.apply();
  }

  stop() {
    if (this.anim) { cancelAnimationFrame(this.anim.raf); this.anim.resolve(); this.anim = null; }
  }

  // Frame a world rect {x, y, w, h} (top-left based) with a margin.
  frame(rect, margin = 0.06) {
    const z = Math.min(DESIGN_W * (1 - margin * 2) / rect.w, DESIGN_H * (1 - margin * 2) / rect.h);
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, z };
  }

  tween(fn, ms) {
    this.stop();
    const dur = Math.max(1, (ms * PACE) / this.speed);
    return new Promise((resolve) => {
      const t0 = clock.now();
      const step = () => {
        if (clock.paused) { this.anim.raf = requestAnimationFrame(step); return; }
        const t = Math.min(1, (clock.now() - t0) / dur);
        this.pos = fn(t);
        this.apply();
        if (t < 1) this.anim.raf = requestAnimationFrame(step);
        else { this.anim = null; resolve(); }
      };
      this.anim = { raf: requestAnimationFrame(step), resolve };
    });
  }

  // Straight move, eased hard at both ends, with a gentle zoom dip mid-way so
  // the move reads as a camera whoosh rather than a slide.
  whoosh(to, ms = 620, dip = 0.86) {
    const a = { ...this.pos };
    const b = { ...a, ...to };
    // Smear only on a fast move: a light blur that peaks while the camera is
    // fastest and is gone before it lands (never on reduced motion).
    const travel = Math.hypot(b.x - a.x, b.y - a.y) * a.z * this.fit;
    const smear = travel > 500 && !LITE && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (smear) this.world.classList.add('smear');
    const done = this.tween((t) => {
      const e = ease.launch(t);
      const bump = Math.sin(Math.PI * Math.min(1, e * 1.15));
      const z = lerpLog(a.z, b.z, e) * (1 - (1 - dip) * bump);
      if (smear) {
        const v = Math.max(0, 1 - Math.abs(e - 0.45) / 0.4); // peaks mid-move
        this.world.style.filter = v > 0.05 && t < 0.9 ? `blur(${(2.6 * v * v).toFixed(2)}px)` : '';
      }
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z };
    }, ms);
    return done.then(() => { this.world.style.filter = ''; this.world.classList.remove('smear'); });
  }

  // Smooth pan + zoom (van Wijk & Nuij). Long trips zoom out on the way.
  fly(to, ms, rho = 1.35) {
    const a = { ...this.pos };
    const b = { ...a, ...to };
    const w0 = DESIGN_W / a.z, w1 = DESIGN_W / b.z;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d2 = dx * dx + dy * dy, d1 = Math.sqrt(d2);
    const r2 = rho * rho;
    let path;
    if (d1 < 1e-6) {
      const S = Math.log(w1 / w0) / rho;
      path = { S: Math.abs(S) || 1e-6, at: (s) => ({ x: a.x, y: a.y, w: w0 * Math.exp(rho * s * Math.sign(S || 1)) }) };
    } else {
      const b0 = (w1 * w1 - w0 * w0 + r2 * r2 * d2) / (2 * w0 * r2 * d1);
      const b1 = (w1 * w1 - w0 * w0 - r2 * r2 * d2) / (2 * w1 * r2 * d1);
      const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
      const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      const S = (r1 - r0) / rho;
      path = {
        S,
        at: (s) => {
          const coshr0 = Math.cosh(r0);
          const u = (w0 / (r2 * d1)) * (coshr0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
          return { x: a.x + u * dx, y: a.y + u * dy, w: (w0 * coshr0) / Math.cosh(rho * s + r0) };
        },
      };
    }
    const dur = ms ?? Math.min(3600, Math.max(1100, path.S * 900));
    return this.tween((t) => {
      if (t >= 1) return b;
      const p = path.at(ease.launch(t) * path.S);
      return { x: p.x, y: p.y, z: DESIGN_W / p.w };
    }, dur);
  }

  ease(to, ms = 1100, fn = ease.inOutCubic) {
    const a = { ...this.pos };
    const b = { ...a, ...to };
    return this.tween((t) => {
      const e = fn(t);
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: lerpLog(a.z, b.z, e) };
    }, ms);
  }
}

function lerpLog(a, b, t) {
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
}
