/**
 * starfield.js — Canvas-based parallax star field.
 * Same algorithm as the original, now a reusable class.
 *
 * Usage:
 *   import { Field } from './starfield.js';
 *   const f = new Field(canvasEl, 110, false);
 *   f.target = 3200; // speed up
 */

let mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX / innerWidth - 0.5;
  mouse.y = e.clientY / innerHeight - 0.5;
});

export class Field {
  constructor(cv, n, shoot) {
    const c = cv.getContext('2d');
    let W = 0, H = 0, D = 1;
    const st = [], shots = [];
    let last = performance.now(), t = 0;
    this.speed = 26;
    this.target = 26;
    const me = this;

    function size() {
      const nw = window.innerWidth || cv.clientWidth || 1200;
      const nh = window.innerHeight || cv.clientHeight || 800;
      // Don't wipe canvas on small mobile address-bar toggles
      if (W > 0 && Math.abs(nw - W) === 0 && Math.abs(nh - H) < 140) return;
      D = Math.min(window.devicePixelRatio || 1, 2);
      W = nw; H = nh;
      cv.width = W * D; cv.height = H * D;
      c.setTransform(D, 0, 0, D, 0, 0);
    }
    size();
    window.addEventListener('resize', size);
    window.addEventListener('orientationchange', () => setTimeout(size, 250));

    for (let i = 0; i < n; i++) {
      const z = Math.pow(Math.random(), 1.6) * 0.9 + 0.1;
      const fast = Math.random() < 0.32;
      st.push({
        x: Math.random(), y: Math.random() * (H || window.innerHeight || 800),
        z, s: 1.4 + z * 1.8, p: Math.random() * 6.28,
        r: fast ? (3.5 + Math.random() * 4.5) : (1.6 + Math.random() * 2.6),
        col: Math.random() < 0.16 ? '#e3a72f' : (Math.random() < 0.3 ? '#b9c4de' : '#efe8da'),
        big: z > 0.8 && Math.random() < 0.65,
      });
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1e3); last = now; t += dt;
      if (W === 0 || H === 0) size();
      me.speed += (me.target - me.speed) * Math.min(1, dt * 2.2);
      c.clearRect(0, 0, W, H);
      const sp = me.speed;

      // Continuous warp factor: 0 when cruising (sp <= 50), 1 when at warp (sp >= 250)
      const warpBlend = Math.min(1, Math.max(0, (sp - 50) / 200));

      for (let i = 0; i < st.length; i++) {
        const q = st[i];
        q.y += sp * q.z * dt;
        if (q.y > H + 60) { q.y = -20; q.x = Math.random(); }
        const px = q.x * W - mouse.x * q.z * 36;
        const py = q.y - mouse.y * q.z * 22;
        c.fillStyle = c.strokeStyle = q.col;

        // 1. Draw warp streaks (smoothly shrinks in length & fades with warpBlend)
        if (warpBlend > 0) {
          const streakLen = Math.max(0, (sp - 30) * q.z * 0.045);
          c.globalAlpha = (0.35 + q.z * 0.65) * warpBlend;
          c.lineWidth = q.s;
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px, py - streakLen);
          c.stroke();
        }

        // 2. Draw crisp dot stars (clearly visible, blinking/twinkling, no crosshairs)
        if (warpBlend < 1) {
          const s1 = Math.sin(t * q.r + q.p);
          const s2 = Math.sin(t * (q.r * 1.7) + q.p * 2.1);
          const raw = 0.5 + 0.35 * s1 + 0.15 * s2;
          const blink = Math.pow(Math.max(0, raw), 2);
          const dotFade = 1 - warpBlend;
          c.globalAlpha = (0.35 + 0.65 * blink) * dotFade;

          if (q.big) {
            const sz = 3.2 + q.z * 1.4;
            c.fillRect(px - sz / 2, py - sz / 2, sz, sz);
          } else {
            const sz = Math.max(1.5, q.s);
            c.fillRect(px - sz / 2, py - sz / 2, sz, sz);
          }
        }
      }

      if (shoot && sp < 120) {
        if (Math.random() < dt * 0.35) shots.push({ x: Math.random() * W * 1.1, y: Math.random() * H * 0.4, l: 0 });
        for (let k = shots.length - 1; k >= 0; k--) {
          const h = shots[k]; h.l += dt * 1.6;
          const a = Math.sin(Math.min(h.l, 1) * Math.PI);
          const hx = h.x - h.l * W * 0.55, hy = h.y + h.l * W * 0.3;
          c.globalAlpha = a; c.strokeStyle = '#efe8da'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + W * 0.09, hy - W * 0.05); c.stroke();
          if (h.l > 1) shots.splice(k, 1);
        }
      }
      c.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
}
