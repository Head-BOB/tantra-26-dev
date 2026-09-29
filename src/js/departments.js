import { initLaunchCountdownAudio } from './clock-sound.js';

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
  let isManualDragging = false;

  let lastDepW = 0, lastDepH = 0;
  function measure(force = false) {
    const nw = window.innerWidth || 1200;
    const nh = window.innerHeight || 800;
    if (!force && lastDepW > 0 && Math.abs(nw - lastDepW) === 0 && Math.abs(nh - lastDepH) < 160) return;
    lastDepW = nw;
    lastDepH = nh;
    const vh = nh;
    pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    maxT = Math.max(0, rtrack.scrollWidth + 2 * pad - rail.clientWidth);
    dep.style.height = `${vh + Math.max(maxT * 1.05, vh * 0.8)}px`;
    top0 = dep.getBoundingClientRect().top + (window.pageYOffset || 0);
    range = Math.max(1, dep.offsetHeight - vh);
  }

  function scrollYForX(x) {
    const p2 = maxT > 0 ? clamp(x / maxT) : 0;
    return top0 + (LEAD + SPAN * p2) * range;
  }

  function xForScrollY(sc) {
    const p = clamp((sc - top0) / range);
    const p2 = clamp((p - LEAD) / SPAN);
    return p2 * maxT;
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
    const targetY = scrollYForX(cardT(i));
    scrollTo({ top: targetY, behavior: 'smooth' });
  }

  pv.onclick = () => go(idx() - 1);
  nx.onclick = () => go(idx() + 1);

  function tick() {
    if (!isManualDragging) {
      const sc = window.pageYOffset || 0;
      const targetX = xForScrollY(sc);
      curX += (targetX - curX) * 0.16;
      if (Math.abs(targetX - curX) < 0.3) curX = targetX;
      rtrack.style.transform = `translate3d(${-curX}px,0,0)`;
      const i = idx();
      [...dots.children].forEach((d, k) => { d.className = k === i ? 'on' : ''; });
      pv.disabled = curX < 8;
      nx.disabled = curX > maxT - 8;
    }
    requestAnimationFrame(tick);
  }

  measure(true);
  addEventListener('resize', () => measure(false));
  addEventListener('orientationchange', () => {
    lastDepW = 0;
    setTimeout(() => measure(true), 250);
  });
  addEventListener('load', () => measure(true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure(true));
  requestAnimationFrame(tick);

  // ---------- Touch & Pointer Dragging ----------
  // Horizontal swipe: scrolls cards left/right freely at any speed to choose department,
  // keeping the vertical page locked in place, and synchronizing vertical scroll
  // so when vertical scrolling resumes, it continues seamlessly from that card to the end!
  let touchStartX = 0;
  let touchStartY = 0;
  let touchLastX = 0;
  let isHorizSwipe = null;
  let moved = false;

  rail.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchLastX = touchStartX;
    isHorizSwipe = null;
    moved = false;
  }, { passive: true });

  rail.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchLastX;
    const totalDx = currentX - touchStartX;
    const totalDy = currentY - touchStartY;

    if (isHorizSwipe === null) {
      if (Math.abs(totalDx) > 7 && Math.abs(totalDx) > Math.abs(totalDy)) {
        isHorizSwipe = true;
        isManualDragging = true;
        rail.classList.add('drag');
      } else if (Math.abs(totalDy) > 7) {
        isHorizSwipe = false;
        isManualDragging = false;
      }
    }

    if (isHorizSwipe === true) {
      // Free manual horizontal swipe to choose department!
      if (e.cancelable) e.preventDefault();
      moved = true;
      touchLastX = currentX;

      // Update card position directly under finger with smooth response
      curX = clamp(curX - dx * 1.25, 0, maxT);
      rtrack.style.transform = `translate3d(${-curX}px,0,0)`;

      const i = idx();
      [...dots.children].forEach((d, k) => { d.className = k === i ? 'on' : ''; });
      pv.disabled = curX < 8;
      nx.disabled = curX > maxT - 8;

      // Synchronize window vertical scroll position to this exact card
      window.scrollTo(0, scrollYForX(curX));
    }
  }, { passive: false });

  function endTouch() {
    if (isManualDragging) {
      isManualDragging = false;
      rail.classList.remove('drag');
      window.scrollTo(0, scrollYForX(curX));
    }
    isHorizSwipe = null;
  }

  rail.addEventListener('touchend', endTouch, { passive: true });
  rail.addEventListener('touchcancel', endTouch, { passive: true });

  // Desktop mouse drag
  let ptrDown = false, ptrLastX = 0;
  rail.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    ptrDown = true; moved = false; ptrLastX = e.clientX;
  });
  addEventListener('pointermove', (e) => {
    if (!ptrDown) return;
    const dx = e.clientX - ptrLastX;
    if (!moved && Math.abs(dx) < 6) return;
    moved = true;
    ptrLastX = e.clientX;
    isManualDragging = true;
    rail.classList.add('drag');
    curX = clamp(curX - dx, 0, maxT);
    rtrack.style.transform = `translate3d(${-curX}px,0,0)`;
    const i = idx();
    [...dots.children].forEach((d, k) => { d.className = k === i ? 'on' : ''; });
    pv.disabled = curX < 8;
    nx.disabled = curX > maxT - 8;
    window.scrollTo(0, scrollYForX(curX));
  });
  function endPtr() {
    if (ptrDown) {
      ptrDown = false;
      isManualDragging = false;
      rail.classList.remove('drag');
      window.scrollTo(0, scrollYForX(curX));
    }
  }
  addEventListener('pointerup', endPtr);
  addEventListener('pointercancel', endPtr);
  rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);

  // ---- Countdown timer ----
  // EVENT_START: 7 October 2026, 9:00 AM IST (UTC+05:30)
  // To change: update the ISO string below.
  const EVENT_START = new Date('2026-10-07T09:00:00+05:30').getTime();
  const cdEls = {};
  [...document.querySelectorAll('#cd [data-u]')].forEach((n) => { cdEls[n.dataset.u] = n; });
  const clockSound = initLaunchCountdownAudio();

  function setU(k, v) {
    const text = (v < 10 ? '0' : '') + v;
    const n = cdEls[k];
    if (n.textContent !== text) {
      n.textContent = text;
      n.classList.remove('tick');
      void n.offsetWidth; // reflow to restart animation
      n.classList.add('tick');
      if (k === 's') {
        clockSound.onSecondTick();
      }
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
  setInterval(cdTick, 40);

  // ---- Intersection-based scroll reveals ----
  const io2 = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io2.unobserve(e.target); } }),
    { threshold: 0.15 }
  );
  [...document.querySelectorAll('.reveal, .slabs')].forEach((n) => io2.observe(n));

  // ---- Back to top & Navigate to Departments ----
  $('#top').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  const gd = $('#go-depts');
  if (gd) {
    gd.onclick = (e) => {
      e.preventDefault();
      const depts = $('#depts');
      if (depts) {
        depts.scrollIntoView({ behavior: 'smooth' });
      }
    };
  }
}
