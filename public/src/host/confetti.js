// Paper confetti burst for the winner. Canvas, no dependencies.
const COLORS = ['#1d5e5f', '#c45a2c', '#d39b2e', '#94ae96', '#5f9c98', '#e9b9a3', '#f6efdf'];

export function confetti(canvas, { duration = 5000, count = 220 } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  resize();
  const W = () => canvas.width, H = () => canvas.height;
  const parts = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? -20 : W() + 20,
      y: H() * (0.55 + Math.random() * 0.3),
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 10) * dpr,
      vy: -(14 + Math.random() * 12) * dpr,
      w: (8 + Math.random() * 8) * dpr,
      h: (12 + Math.random() * 10) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      flip: Math.random() * Math.PI,
      vf: 0.08 + Math.random() * 0.12,
      c: COLORS[i % COLORS.length],
    };
  });
  const t0 = performance.now();
  canvas.style.display = 'block';
  const frame = (now) => {
    const t = now - t0;
    ctx.clearRect(0, 0, W(), H());
    for (const p of parts) {
      p.vy += 0.38 * dpr;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.flip += p.vf;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, Math.min(1, (duration - t) / 800));
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W(), H()); canvas.style.display = 'none'; }
  };
  requestAnimationFrame(frame);
}
