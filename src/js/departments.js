import { initLaunchCountdownAudio } from './clock-sound.js';

export function initDepartments() {
  const $ = (x) => document.querySelector(x);

  const rail = $('#rail');
  if (!rail) return;
  const dots = $('#dots');
  const pv = $('.prev');
  const nx = $('.next');

  // Wrap cards in rtrack if not already wrapped
  let rtrack = rail.querySelector('.rtrack');
  if (!rtrack) {
    rtrack = document.createElement('div');
    rtrack.className = 'rtrack';
    const initialCards = [...rail.children].filter((el) => el.classList.contains('card'));
    initialCards.forEach((c) => rtrack.appendChild(c));
    rail.appendChild(rtrack);
  }

  const getCards = () => [...rail.querySelectorAll('.card')];
  const cards = getCards();

  function getMaxScroll() {
    return Math.max(0, rail.scrollWidth - rail.clientWidth);
  }

  // Calculate the target scrollLeft to align a card with the left padding
  function getCardScrollTarget(card) {
    if (!card) return 0;
    const rRect = rail.getBoundingClientRect();
    const cRect = card.getBoundingClientRect();
    const padLeft = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    const diff = cRect.left - rRect.left - padLeft;
    return Math.round(rail.scrollLeft + diff);
  }

  function getActiveIndex() {
    const cardList = getCards();
    if (!cardList.length) return 0;
    const maxScroll = getMaxScroll();
    if (rail.scrollLeft <= 10) return 0;
    if (rail.scrollLeft >= maxScroll - 10) return cardList.length - 1;

    const rRect = rail.getBoundingClientRect();
    const padLeft = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    let bestIdx = 0;
    let minDiff = Infinity;

    cardList.forEach((c, idx) => {
      const cRect = c.getBoundingClientRect();
      const diff = Math.abs((cRect.left - rRect.left) - padLeft);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = idx;
      }
    });

    return bestIdx;
  }

  // Target scrollLeft to step one card to the left
  function getPrevScrollLeft() {
    const cardList = getCards();
    if (!cardList.length) return 0;
    const maxScroll = getMaxScroll();
    if (rail.scrollLeft <= 10) return 0;

    for (let i = cardList.length - 1; i >= 0; i--) {
      const target = i === 0 ? 0 : Math.min(maxScroll, Math.max(0, getCardScrollTarget(cardList[i])));
      if (target < rail.scrollLeft - 20) {
        return target;
      }
    }

    const active = getActiveIndex();
    const prevIdx = Math.max(0, active - 1);
    if (prevIdx === 0) return 0;
    return Math.min(maxScroll, Math.max(0, getCardScrollTarget(cardList[prevIdx])));
  }

  // Target scrollLeft to step one card to the right
  function getNextScrollLeft() {
    const cardList = getCards();
    if (!cardList.length) return 0;
    const maxScroll = getMaxScroll();
    if (rail.scrollLeft >= maxScroll - 10) return maxScroll;

    for (let i = 0; i < cardList.length; i++) {
      const target = i === cardList.length - 1 ? maxScroll : Math.min(maxScroll, Math.max(0, getCardScrollTarget(cardList[i])));
      if (target > rail.scrollLeft + 20) {
        return target;
      }
    }

    return maxScroll;
  }

  let isProgrammatic = false;
  let resetSnapTimeout = null;

  function scrollToPosition(targetLeft) {
    const maxScroll = getMaxScroll();
    targetLeft = Math.max(0, Math.min(maxScroll, Math.round(targetLeft)));
    isProgrammatic = true;
    rail.style.scrollSnapType = 'none';
    rail.scrollTo({ left: targetLeft, behavior: 'smooth' });

    clearTimeout(resetSnapTimeout);
    resetSnapTimeout = setTimeout(() => {
      rail.style.scrollSnapType = '';
      isProgrammatic = false;
      updateState();
    }, 450);
  }

  rail.addEventListener('scrollend', () => {
    if (isProgrammatic) {
      clearTimeout(resetSnapTimeout);
      rail.style.scrollSnapType = '';
      isProgrammatic = false;
      updateState();
    }
  });

  // Generate pagination dots
  dots.innerHTML = '';
  cards.forEach((c, i) => {
    const d = document.createElement('i');
    d.setAttribute('aria-label', `Department ${i + 1}`);
    d.onclick = () => {
      const maxScroll = getMaxScroll();
      const target = i === 0 ? 0 : (i === cards.length - 1 ? maxScroll : Math.min(maxScroll, Math.max(0, getCardScrollTarget(cards[i]))));
      scrollToPosition(target);
    };
    dots.appendChild(d);
  });

  // Update dots and arrow buttons based on current scroll position
  function updateState() {
    const maxScroll = getMaxScroll();
    const isAtStart = rail.scrollLeft <= 10;
    const isAtEnd = rail.scrollLeft >= maxScroll - 10;

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
      scrollToPosition(getPrevScrollLeft());
    };
  }

  if (nx) {
    nx.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      scrollToPosition(getNextScrollLeft());
    };
  }

  // Desktop mouse click-and-drag
  let isDown = false;
  let startX = 0;
  let startY = 0;
  let scrollLeftStart = 0;
  let hasDragged = false;
  const DRAG_THRESHOLD = 15;

  rail.addEventListener('mousedown', (e) => {
    isDown = true;
    hasDragged = false;
    startX = e.pageX;
    startY = e.pageY;
    scrollLeftStart = rail.scrollLeft;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const dx = e.pageX - startX;
    const dy = e.pageY - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      hasDragged = true;
      rail.classList.add('drag');
    }
    if (hasDragged) {
      const maxScroll = getMaxScroll();
      const newLeft = scrollLeftStart - dx;
      rail.scrollLeft = Math.min(maxScroll, Math.max(0, newLeft));
    }
  });

  function stopDrag() {
    if (isDown) {
      isDown = false;
      rail.classList.remove('drag');
      if (hasDragged) {
        const active = getActiveIndex();
        const maxScroll = getMaxScroll();
        const target = active === 0 ? 0 : (active === cards.length - 1 ? maxScroll : Math.min(maxScroll, Math.max(0, getCardScrollTarget(cards[active]))));
        scrollToPosition(target);
        setTimeout(() => { hasDragged = false; }, 60);
      }
    }
  }

  window.addEventListener('mouseup', stopDrag);

  // Prevent card navigation ONLY if user actually dragged
  rail.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged = false;
    }
  }, true);

  // Ensure clicking anywhere on each department card navigates reliably
  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (hasDragged) {
        e.preventDefault();
        return;
      }
      const href = card.getAttribute('href');
      if (href) {
        window.location.href = href;
      }
    });
  });

  // Support direct jump to #departments from other pages
  if (location.hash === '#departments' || location.hash === '#depts') {
    setTimeout(() => {
      const targetSec = document.getElementById('departments') || document.getElementById('depts');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      }
    }, 200);
  }

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
