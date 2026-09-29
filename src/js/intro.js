/**
 * intro.js — Scroll-scrubbed intro animation for the landing page.
 * Drives: Ready scene → 3-2-1 countdown → rocket → final Tantra logo.
 *
 * Depends on: starfield.js (imported here)
 * Expects DOM elements matching original index.html structure.
 */

import { Field } from './starfield.js';

export function initIntro() {
  const E1 = 'cubic-bezier(.7,0,.2,1)';
  const OUT = 'cubic-bezier(.16,1,.3,1)';
  const $ = (x) => document.querySelector(x);

  // Logo letter elements
  const logoLetters = [...document.querySelectorAll('#tantra-svg .logo-let')];

  // Star fields
  const f1 = new Field($('#c1'), 110, false);
  const f2 = new Field($('#c2'), 260, true);

  // ---------- Easing helpers ----------
  const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const seg   = (t, s, d) => clamp((t - s) / d);
  const outX  = (v) => v >= 1 ? 1 : 1 - Math.pow(2, -10 * v);
  const io    = (v) => v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  const inQ   = (v) => Math.pow(v, 2.2);

  // Scene refs
  const s1    = $('#s1');
  const slabs = ['#n3', '#n2', '#n1'].map($);
  const rk    = $('#rk');
  const rocket = $('#rocket');
  const fin   = $('#fin');

  // Puff particles
  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'puff';
    const z = innerHeight * (0.03 + Math.random() * 0.05);
    p.style.cssText =
      `width:${z}px;height:${z}px;` +
      `left:${innerWidth / 2 - z / 2}px;` +
      `top:${innerHeight * 0.86 - z * 0.8}px`;
    rk.appendChild(p);
    puffs.push({
      e: p,
      d: Math.random() * 700,
      l: 1100 + Math.random() * 700,
      dx: (Math.random() < 0.5 ? -1 : 1) * innerWidth * (0.05 + Math.random() * 0.2),
      dy: (Math.random() - 0.2) * z,
    });
  }

  const hint = $('#hint');
  let sc0 = 0;

  function render(t) {
    // Scene 1: "Ready?"
    s1.style.visibility = t < 2940 ? 'visible' : 'hidden';

    // 3-2-1 slabs
    slabs.forEach((e, i) => {
      const s0 = 2600 + i * 720;
      const nextS = s0 + 720 + 340;
      const isVis = t >= s0 - 30 && t < nextS;
      e.style.visibility = isVis ? 'visible' : 'hidden';
      if (isVis) {
        const prog = io(seg(t, s0, 320));
        e.style.transform = `translate3d(0,${105 * (1 - prog)}%,0)`;
        const v = outX(seg(t, s0 + 120, 380));
        const b = e.querySelector('b');
        if (b) { b.style.transform = `scale(${2.4 - 1.4 * v})`; b.style.opacity = v; }
      } else {
        e.style.transform = t < s0 ? 'translate3d(0,105%,0)' : 'translate3d(0,0,0)';
      }
    });

    // Rocket stage
    const rkVis = t >= 4730 && t < 8450;
    rk.style.visibility = rkVis ? 'visible' : 'hidden';
    if (rkVis) {
      const rkProg = io(seg(t, 4760, 340));
      rk.style.transform = `translate3d(0,${105 * (1 - rkProg)}%,0)`;
      const sh = seg(t, 5100, 1800);
      let x = 0, y = 0;
      if (sh > 0 && sh < 1) {
        const k = t * 0.09;
        x = Math.sin(k) * 3.5;
        y = Math.cos(k * 1.7) * 1.5;
      }
      const up = inQ(seg(t, 6900, 1400));
      const vh = window.innerHeight || 800;
      rocket.style.transform = `translate3d(${x}px,${y - up * 1.4 * vh}px,0)`;

      if (t >= 5050 && t <= 7800) {
        puffs.forEach((q) => {
          const u = clamp((t - 5100 - q.d) / q.l);
          const o = u <= 0 ? 0 : 0.8 * (1 - u);
          q.e.style.opacity = o;
          q.e.style.transform = `translate3d(${q.dx * u}px,${q.dy * u}px,0) scale(${0.4 + 2.2 * u})`;
        });
      } else {
        puffs.forEach((q) => { q.e.style.opacity = 0; });
      }
    } else {
      rk.style.transform = t < 4730 ? 'translate3d(0,105%,0)' : 'translate3d(0,0,0)';
      puffs.forEach((q) => { q.e.style.opacity = 0; });
    }

    // Final logo
    const finVis = t >= 7570;
    fin.style.visibility = finVis ? 'visible' : 'hidden';
    if (finVis) {
      const finProg = io(seg(t, 7600, 800));
      fin.style.transform = `translate3d(0,${105 * (1 - finProg)}%,0)`;
      logoLetters.forEach((e, j) => {
        const st2 = 8600 + j * 190;
        const p = outX(seg(t, st2, 600));
        e.style.opacity = p;
        e.setAttribute('transform', `translate(0, ${-45 * (1 - p)})`);
      });
    } else {
      fin.style.transform = 'translate3d(0,105%,0)';
      logoLetters.forEach((e) => {
        e.style.opacity = 0;
        e.setAttribute('transform', 'translate(0, -45)');
      });
    }

    const l26 = $('#logo26');
    l26.setAttribute('opacity', outX(seg(t, 10250, 700)));
    l26.setAttribute('transform', `translate(0,${14 * (1 - outX(seg(t, 10250, 700)))})`);
    hint.style.opacity = seg(t, 10900, 400) * (1 - clamp(sc0 / 60));

    // Star field speeds
    f1.target = t > 6900 ? 3200 : 26;
    if (t < 8400) { f2.speed = 3000; f2.target = 3000; } else { f2.target = 24; }
    if (t < 6900) f1.speed = Math.min(f1.speed, 60);
  }

  // ---------- Scroll driver ----------
  const T = 11400, PX = 0.6;
  const track = $('#track');
  let maxS = 0, cur = 0;

  function sizeTrack() {
    const vh = window.innerHeight;
    maxS = T * PX;
    track.style.height = `${vh + maxS + vh * 0.7}px`;
  }
  sizeTrack();
  window.addEventListener('resize', sizeTrack);
  window.addEventListener('orientationchange', () => setTimeout(sizeTrack, 250));

  // Clone Tantra SVG into footer logo
  const fl = $('#foot-logo');
  if (fl) {
    const cl = $('#tantra-svg').cloneNode(true);
    cl.removeAttribute('id'); cl.removeAttribute('style');
    [...cl.querySelectorAll('[id]')].forEach((n) => n.removeAttribute('id'));
    [...cl.querySelectorAll('.logo-let')].forEach((n) => { n.removeAttribute('transform'); n.style.opacity = 1; });
    const g = cl.lastElementChild;
    g.removeAttribute('opacity'); g.setAttribute('opacity', 1);
    fl.appendChild(cl);
  }

  function loop() {
    const sc = window.pageYOffset || document.documentElement.scrollTop || 0;
    const target = Math.min(sc / (maxS || 6360), 1) * T;
    cur += (target - cur) * 0.18;
    if (Math.abs(target - cur) < 0.5) cur = target;
    sc0 = Math.max(0, sc - maxS - (innerHeight || 800) * 0.7);
    const pp = Math.min(sc0 / (innerHeight || 800), 1);
    fin.style.opacity = 1 - pp * 0.75;
    $('#logo').style.transform = `scale(${1 - pp * 0.12})`;
    render(cur);
    requestAnimationFrame(loop);
  }

  scrollTo(0, 0);
  render(0);
  requestAnimationFrame(loop);
}
