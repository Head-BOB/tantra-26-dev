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
      const nw = cv.clientWidth || innerWidth;
      const nh = cv.clientHeight || innerHeight;
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
      st.push({
        x: Math.random(), y: Math.random() * (H || 800),
        z, s: 0.6 + z * 1.9, p: Math.random() * 6.28, r: 1 + Math.random() * 3,
        col: Math.random() < 0.16 ? '#e3a72f' : (Math.random() < 0.3 ? '#b9c4de' : '#efe8da'),
        big: z > 0.82 && Math.random() < 0.7,
      });
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1e3); last = now; t += dt;
      me.speed += (me.target - me.speed) * Math.min(1, dt * 2.2);
      c.clearRect(0, 0, W, H);
      const sp = me.speed, warp = sp > 260;

      for (let i = 0; i < st.length; i++) {
        const q = st[i];
        q.y += sp * q.z * dt;
        if (q.y > H + 60) { q.y = -20; q.x = Math.random(); }
        const px = q.x * W - mouse.x * q.z * 36;
        const py = q.y - mouse.y * q.z * 22;
        c.fillStyle = c.strokeStyle = q.col;
        if (warp) {
          c.globalAlpha = 0.4 + q.z * 0.6;
          c.lineWidth = q.s;
          c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - sp * q.z * 0.045); c.stroke();
        } else {
          c.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * q.r + q.p));
          if (q.big) {
            const L = 5 + q.z * 7 * (0.6 + 0.4 * Math.sin(t * q.r + q.p));
            c.lineWidth = 1.2;
            c.beginPath();
            c.moveTo(px - L, py); c.lineTo(px + L, py);
            c.moveTo(px, py - L); c.lineTo(px, py + L);
            c.stroke();
            c.fillRect(px - 1.5, py - 1.5, 3, 3);
          } else {
            c.fillRect(px - q.s / 2, py - q.s / 2, q.s, q.s);
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
