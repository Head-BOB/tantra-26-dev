import { initLaunchCountdownAudio } from './clock-sound.js';

export function initDepartments() {
  const $ = (x) => document.querySelector(x);

  const rail = $('#rail');
  const cards = [...rail.children];
  const dots = $('#dots');
  const pv = $('.prev');
  const nx = $('.next');

  // Wrap cards in rtrack if not already wrapped
  let rtrack = rail.querySelector('.rtrack');
  if (!rtrack) {
    rtrack = document.createElement('div');
    rtrack.className = 'rtrack';
    cards.forEach((c) => rtrack.appendChild(c));
    rail.appendChild(rtrack);
  }

  // Generate pagination dots
  dots.innerHTML = '';
  cards.forEach((c, i) => {
    const d = document.createElement('i');
    d.setAttribute('aria-label', `Department ${i + 1}`);
    d.onclick = () => scrollToCard(i);
    dots.appendChild(d);
  });

  function getMaxScroll() {
    return Math.max(0, rail.scrollWidth - rail.clientWidth);
  }

  function getCardScrollLeft(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    const maxScroll = getMaxScroll();
    if (i === 0) return 0;
    if (i === cards.length - 1) return maxScroll;
    const c = cards[i];
    return Math.min(maxScroll, Math.max(0, c.offsetLeft));
  }

  function getActiveIndex() {
    const maxScroll = getMaxScroll();
    if (rail.scrollLeft <= 12) return 0;
    if (rail.scrollLeft >= maxScroll - 16) return cards.length - 1;

    const currentScroll = rail.scrollLeft;
    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < cards.length; i++) {
      const diff = Math.abs(cards[i].offsetLeft - currentScroll);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  let targetIdx = 0;

  function scrollToCard(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    targetIdx = i;
    const targetLeft = getCardScrollLeft(i);
    rail.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }

  // Update dots and arrow buttons based on current scroll position
  function updateState() {
    const maxScroll = getMaxScroll();
    const isAtStart = rail.scrollLeft <= 8;
    const isAtEnd = rail.scrollLeft >= maxScroll - 12;

    const active = isAtEnd ? cards.length - 1 : (isAtStart ? 0 : getActiveIndex());
    [...dots.children].forEach((d, k) => {
      d.className = k === active ? 'on' : '';
    });

    if (pv) {
      pv.disabled = isAtStart;
      pv.classList.toggle('hidden', isAtStart);
    }
    if (nx) {
      nx.disabled = isAtEnd;
      nx.classList.toggle('hidden', isAtEnd);
    }
  }

  rail.addEventListener('scroll', () => {
    updateState();
  }, { passive: true });
  window.addEventListener('resize', updateState, { passive: true });

  // Initial state check
  updateState();
  requestAnimationFrame(updateState);
  setTimeout(updateState, 200);

  if (pv) {
    pv.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const active = getActiveIndex();
      const base = (targetIdx < active && rail.scrollLeft > getCardScrollLeft(targetIdx) + 8) ? targetIdx : active;
      scrollToCard(Math.max(0, base - 1));
    };
  }

  if (nx) {
    nx.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const maxScroll = getMaxScroll();
      if (rail.scrollLeft >= maxScroll - 12) return;
      const active = getActiveIndex();
      const base = (targetIdx > active && rail.scrollLeft < getCardScrollLeft(targetIdx) - 8) ? targetIdx : active;
      scrollToCard(Math.min(cards.length - 1, base + 1));
    };
  }

  // Desktop mouse click-and-drag
  let isDown = false;
  let startX = 0;
  let scrollLeftStart = 0;
  let hasDragged = false;

  rail.addEventListener('mousedown', (e) => {
    isDown = true;
    hasDragged = false;
    startX = e.pageX;
    scrollLeftStart = rail.scrollLeft;
    rail.classList.add('drag');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 5) {
      hasDragged = true;
    }
    const maxScroll = getMaxScroll();
    const newLeft = scrollLeftStart - dx;
    rail.scrollLeft = Math.min(maxScroll, Math.max(0, newLeft));
  });

  function stopDrag() {
    if (isDown) {
      isDown = false;
      rail.classList.remove('drag');
      if (hasDragged) {
        scrollToCard(getActiveIndex());
      }
    }
  }

  window.addEventListener('mouseup', stopDrag);

  // Prevent card navigation if the user was dragging
  rail.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged = false;
    }
  }, true);

  // Initial state
  updateState();

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
