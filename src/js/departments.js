/**
 * departments.js — Pinned horizontal card carousel + countdown + scroll-reveals.
 * Runs on the main landing page only.
 */

export function initDepartments() {
  const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const $ = (x) => document.querySelector(x);

  // ---- Pinned horizontal carousel ----
  const dep   = $('#depts');
  const rail  = $('#rail');
  const cards = [...rail.children];
  const dots  = $('#dots');
  const pv    = $('.prev');
  const nx    = $('.next');

  const rtrack = document.createElement('div');
  rtrack.className = 'rtrack';
  cards.forEach((c) => rtrack.appendChild(c));
  rail.appendChild(rtrack);

  const LEAD = 0.06, SPAN = 0.88;
  let maxT = 0, range = 1, top0 = 0, curX = 0, pad = 0;

  function measure() {
    const vh = innerHeight || 800;
    pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    maxT = Math.max(0, rtrack.scrollWidth + 2 * pad - rail.clientWidth);
    dep.style.height = `${vh + Math.max(maxT * 1.05, vh * 0.8)}px`;
    top0 = dep.getBoundingClientRect().top + (window.pageYOffset || 0);
    range = Math.max(1, dep.offsetHeight - vh);
  }

  cards.forEach((c, i) => {
    const d = document.createElement('i');
    d.onclick = () => go(i);
    dots.appendChild(d);
  });

  function cardT(i) {
    const c = cards[i];
    return Math.max(0, Math.min(maxT, c.offsetLeft + pad + c.offsetWidth / 2 - rail.clientWidth / 2));
  }
  function idx() {
    let b = 0, bd = 1e9;
    cards.forEach((c, i) => { const d = Math.abs(cardT(i) - curX); if (d < bd) { bd = d; b = i; } });
    return b;
  }
  function go(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    const p2 = maxT ? cardT(i) / maxT : 0;
    scrollTo({ top: top0 + (LEAD + SPAN * p2) * range, behavior: 'smooth' });
  }

  pv.onclick = () => go(idx() - 1);
  nx.onclick = () => go(idx() + 1);

  function tick() {
    const sc = window.pageYOffset || 0;
    const p = clamp((sc - top0) / range);
    const p2 = clamp((p - LEAD) / SPAN);
    curX += (p2 * maxT - curX) * 0.14;
    if (Math.abs(p2 * maxT - curX) < 0.3) curX = p2 * maxT;
    rtrack.style.transform = `translate3d(${-curX}px,0,0)`;
    const i = idx();
    [...dots.children].forEach((d, k) => { d.className = k === i ? 'on' : ''; });
    pv.disabled = curX < 8;
    nx.disabled = curX > maxT - 8;
    requestAnimationFrame(tick);
  }

  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  requestAnimationFrame(tick);

  // Drag / swipe: horizontal movement → page scroll
  let dn = false, lx = 0, moved = false;
  rail.addEventListener('pointerdown', (e) => { dn = true; moved = false; lx = e.clientX; });
  addEventListener('pointermove', (e) => {
    if (!dn) return;
    const dx = e.clientX - lx;
    if (!moved && Math.abs(dx) < 6) return;
    moved = true; rail.classList.add('drag'); lx = e.clientX;
    scrollBy(0, -dx * (SPAN * range / Math.max(1, maxT)));
  });
  addEventListener('pointerup', () => { dn = false; rail.classList.remove('drag'); });
  addEventListener('pointercancel', () => { dn = false; rail.classList.remove('drag'); });
  rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
  rail.addEventListener('dragstart', (e) => e.preventDefault());
  // Trackpad sideways scroll
  rail.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      scrollBy(0, e.deltaX * (SPAN * range / Math.max(1, maxT)));
    }
  }, { passive: false });

  // ---- Countdown timer ----
  // EVENT_START: 7 October 2026, 9:00 AM IST (UTC+05:30)
  // To change: update the ISO string below.
  const EVENT_START = new Date('2026-10-07T09:00:00+05:30').getTime();
  const cdEls = {};
  [...document.querySelectorAll('#cd [data-u]')].forEach((n) => { cdEls[n.dataset.u] = n; });

  function setU(k, v) {
    const text = (v < 10 ? '0' : '') + v;
    const n = cdEls[k];
    if (n.textContent !== text) {
      n.textContent = text;
      n.classList.remove('tick');
      void n.offsetWidth; // reflow to restart animation
      n.classList.add('tick');
    }
  }
  function cdTick() {
    const d = Math.max(0, EVENT_START - Date.now());
    const sec = Math.floor(d / 1000);
    setU('d', Math.floor(sec / 86400));
    setU('h', Math.floor(sec % 86400 / 3600));
    setU('m', Math.floor(sec % 3600 / 60));
    setU('s', sec % 60);
    if (d <= 0) {
      const L = ['Tantra', '26', 'is', 'live'];
      [...document.querySelectorAll('#cd .cd-u span')].forEach((n, i) => { n.textContent = L[i]; });
    }
  }
  cdTick();
  setInterval(cdTick, 250);

  // ---- Intersection-based scroll reveals ----
  const io2 = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io2.unobserve(e.target); } }),
    { threshold: 0.15 }
  );
  [...document.querySelectorAll('.reveal, .slabs')].forEach((n) => io2.observe(n));

  // ---- Back to top ----
  $('#top').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
}
