/**
 * featured-showcase.js — Homepage Featured Events Spotlight.
 * Handles responsive banner staging (desktop 16:8 vs mobile 4:5),
 * swipe transitions, progress bar ticker, thumbnail strip, and touch interactions.
 * Also supports Showcase Demo Mode for testing before banners are uploaded.
 */

import { apiFetchFeaturedEvents, apiGetCachedFeaturedEvents } from './api.js';

const DEPT_MAP = {
  cse:   { code: 'CSE',  name: 'Computer Science & Engineering',         bg: '#2b6a4d', fg: '#efe8da' },
  cscy:  { code: 'CSCY', name: 'Computer Science and Cyber Security',     bg: '#141414', fg: '#efe8da' },
  ai:    { code: 'ADS',  name: 'Artificial Intelligence & Data Science', bg: '#c23b22', fg: '#efe8da' },
  csd:   { code: 'CSD',  name: 'Computer Science & Design',              bg: '#e3a72f', fg: '#141414' },
  csbs:  { code: 'CSBS', name: 'Computer Science & Business Systems',    bg: '#182338', fg: '#efe8da' },
  eee:   { code: 'EEE',  name: 'Electrical & Electronics Engineering',   bg: '#efe8da', fg: '#141414' },
  ece:   { code: 'ECE',  name: 'Electronics & Communication Engineering',bg: '#c23b22', fg: '#efe8da' },
  aei:   { code: 'AEI',  name: 'Applied Electronics & Instrumentation',  bg: '#2b6a4d', fg: '#efe8da' },
  civil: { code: 'CE',   name: 'Civil Engineering',                      bg: '#e3a72f', fg: '#141414' },
  mech:  { code: 'ME',   name: 'Mechanical Engineering',                 bg: '#182338', fg: '#efe8da' },
  central: { code: 'CENTRAL', name: 'Special Attraction', bg: '#101a2d', fg: '#e3a72f' },
};

export const DEMO_FEATURED = [
  { id: 'hack-night',      slug: 'cse',   deptSlug: 'cse',   code: 'CSE',  dept: 'Computer Science & Engineering',         title: 'Hack Night',       type: 'Competition', date: '8 Oct', time: '6:00 PM',  venue: 'Main Auditorium',  bg: '#2b6a4d', fg: '#efe8da' },
  { id: 'capture-flag',    slug: 'cscy',  deptSlug: 'cscy',  code: 'CSCY', dept: 'Computer Science and Cyber Security',     title: 'Capture the Flag', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'CS Lab 1',          bg: '#141414', fg: '#efe8da' },
  { id: 'model-arena',     slug: 'ai',    deptSlug: 'ai',    code: 'ADS',  dept: 'Artificial Intelligence & Data Science', title: 'Model Arena',      type: 'Competition', date: '7 Oct', time: '10:30 AM', venue: 'AI Lab',            bg: '#c23b22', fg: '#efe8da' },
  { id: 'design-sprint',   slug: 'csd',   deptSlug: 'csd',   code: 'CSD',  dept: 'Computer Science & Design',              title: 'Design Sprint',    type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Design Studio',     bg: '#e3a72f', fg: '#141414' },
  { id: 'startup-pitch',   slug: 'csbs',  deptSlug: 'csbs',  code: 'CSBS', dept: 'Computer Science & Business Systems',    title: 'Startup Pitch',    type: 'Competition', date: '7 Oct', time: '11:00 AM', venue: 'Seminar Hall',      bg: '#182338', fg: '#efe8da' },
  { id: 'line-follower',   slug: 'eee',   deptSlug: 'eee',   code: 'EEE',  dept: 'Electrical & Electronics Engineering',   title: 'Line Follower',    type: 'Competition', date: '7 Oct', time: '2:30 PM',  venue: 'Workshop Ground',   bg: '#efe8da', fg: '#141414' },
  { id: 'antenna-build',   slug: 'ece',   deptSlug: 'ece',   code: 'ECE',  dept: 'Electronics & Communication Engineering',title: 'Antenna Build',    type: 'Competition', date: '7 Oct', time: '2:30 PM',  venue: 'Electronics Lab',   bg: '#c23b22', fg: '#efe8da' },
  { id: 'signal-chase',    slug: 'aei',   deptSlug: 'aei',   code: 'AEI',  dept: 'Applied Electronics & Instrumentation',  title: 'Signal Chase',     type: 'Competition', date: '7 Oct', time: '2:30 PM',  venue: 'Electronics Lab',   bg: '#2b6a4d', fg: '#efe8da' },
  { id: 'bridge-builders', slug: 'civil', deptSlug: 'civil', code: 'CE',   dept: 'Civil Engineering',                      title: 'Bridge Builders',  type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Civil Workshop',    bg: '#e3a72f', fg: '#141414' },
  { id: 'robo-race',       slug: 'mech',  deptSlug: 'mech',  code: 'ME',   dept: 'Mechanical Engineering',                 title: 'Robo Race',        type: 'Competition', date: '7 Oct', time: '11:00 AM', venue: 'Workshop Ground',   bg: '#182338', fg: '#efe8da' },
];

function fesc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fart(slug) {
  const card = document.querySelector(`.card[href*="/departments/${slug}.html"] .poster svg`) ||
               document.querySelector(`.card[href*="${slug}"] svg`);
  return card ? card.outerHTML : '';
}

function fmedia(f) {
  const b = f.banners || {};
  const d = DEPT_MAP[f.deptSlug || f.slug] || { code: f.code || 'T26', name: f.dept || 'Tantra 26', bg: f.bg || '#182338', fg: f.fg || '#efe8da' };
  const deskImg = b.featured_desktop || f.banner || b.event_desktop || f.img || '';
  const mobImg  = b.featured_mobile  || b.event_mobile || deskImg;

  if (deskImg) {
    return `
      <div class="media">
        <picture>
          ${mobImg ? `<source media="(max-width: 700px)" srcset="${fesc(mobImg)}">` : ''}
          <img src="${fesc(deskImg)}" alt="${fesc(f.title)}" loading="lazy">
        </picture>
      </div>
    `;
  }

  // Generated poster using department vector art and palette
  return `
    <div class="media">
      <div class="fpost" style="--c:${f.bg || d.bg};--t:${f.fg || d.fg}">
        <span class="gh">${f.code || d.code}</span>
        ${fart(f.deptSlug || f.slug)}
      </div>
    </div>
  `;
}

export async function initFeaturedShowcase() {
  const featSec = document.getElementById('feat');
  const fst     = document.getElementById('fstage');
  const fth     = document.getElementById('fthumbs');
  const fbar    = document.getElementById('fbar');
  const fcnt    = document.getElementById('fcnt');
  const fprev   = document.getElementById('fprev');
  const fnext   = document.getElementById('fnext');

  if (!featSec || !fst || !fth || !fbar || !fcnt) return;

  const isDemo = localStorage.getItem('tantra26:featured:demo_mode') === 'true';

  function getLocalEvents() {
    if (isDemo) return DEMO_FEATURED;
    let list = apiGetCachedFeaturedEvents();
    if (!list || list.length === 0) {
      try {
        const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
        const central = adminEvents['central'] || [];
        if (central.length > 0) list = central;
      } catch {}
    }
    if (!list || list.length === 0) {
      list = DEMO_FEATURED;
    }
    return list;
  }

  let animTimer = null;
  let rafId = null;
  let fcur = -1;
  let fprog = 0;
  let fhover = false;
  let fvis = false;
  const FDUR = 6500;
  let flast = performance.now();
  let fslides = [];
  let fthumbs = [];
  let n = 0;
  let currentEvents = [];

  function fgo(i, anim) {
    if (n === 0) return;
    i = (i + n) % n;
    if (i === fcur) return;
    fslides.forEach((s, k) => {
      s.classList.toggle('off', k === fcur);
      s.classList.toggle('on', k === i);
    });
    fthumbs.forEach((t, k) => {
      t.classList.toggle('on', k === i);
    });
    fst.classList.toggle('anim', !!anim);
    if (anim) {
      void fst.offsetWidth; // re-trigger animation
      if (animTimer) clearTimeout(animTimer);
      animTimer = setTimeout(() => {
        fst.classList.remove('anim');
        fslides.forEach((s, k) => {
          if (k !== i) s.classList.remove('off');
        });
      }, 950);
    }
    const t = fthumbs[i];
    if (t) {
      fth.scrollTo({
        left: t.offsetLeft - fth.clientWidth / 2 + t.offsetWidth / 2,
        behavior: 'smooth',
      });
    }
    fcur = i;
    fprog = 0;
    fcnt.textContent = (i < 9 ? '0' : '') + (i + 1) + ' / ' + (n < 10 ? '0' : '') + n;
  }

  const freduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function floop(now) {
    const dt = now - flast;
    flast = now;
    if (fvis && !fhover && !document.hidden && !freduce && n > 1) {
      fprog += dt;
      if (fprog >= FDUR) {
        fgo(fcur + 1, true);
      }
    }
    if (fbar) {
      fbar.style.transform = `scaleX(${Math.min(fprog / FDUR, 1)})`;
    }
    rafId = requestAnimationFrame(floop);
  }

  function renderSlides(events) {
    if (!events || events.length === 0) {
      featSec.hidden = true;
      return;
    }

    currentEvents = events;
    featSec.hidden = false;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (animTimer) {
      clearTimeout(animTimer);
      animTimer = null;
    }

    fst.querySelectorAll('.slide').forEach(s => s.remove());
    fth.innerHTML = '';

    events.forEach((f, i) => {
      const d = DEPT_MAP[f.deptSlug || f.slug] || { code: f.code || 'T26', name: f.dept || 'Tantra 26' };
      const dateStr = f.date || '7-8 Oct';
      const timeStr = f.time || '';
      const venueStr = f.venue || 'Campus';
      const dept = (f.deptSlug || f.slug || '').toLowerCase();
      let prizePool = f.prize_pool || (Array.isArray(f.prizes) && f.prizes.length > 0 ? (f.prizes[0]?.reward || f.prizes[0]?.amount) : '');
      if (typeof prizePool === 'string') prizePool = prizePool.replace(/^₹\s*/, '');
      const isDisplayOnly = Boolean(f.display_only || f.displayOnly);
      const targetUrl = isDemo
        ? `/departments/${dept}.html#events`
        : `/event.html?d=${encodeURIComponent(dept)}&e=${encodeURIComponent(f.id)}`;

      // Slide
      const sl = document.createElement('article');
      sl.className = 'slide' + (isDisplayOnly ? ' slide-display-only' : '');
      sl.innerHTML = `
        ${fmedia(f)}
        <div class="finfo">
          <div class="fchips">
            ${isDisplayOnly
              ? `<span class="fchip" style="background:var(--gold);color:#101a2d;font-weight:700">${fesc(f.type || 'Special Attraction')}</span>`
              : `
                <span class="fchip">Featured</span>
                <span class="fchip c2">${fesc(f.type || 'Event')}</span>
                ${prizePool ? `<span class="fchip prize">Prize: ₹${fesc(prizePool)}</span>` : ''}
              `}
          </div>
          <h3>${fesc(f.title)}</h3>
          <p class="fdept">${fesc(isDisplayOnly ? (f.venue || 'Campus Central') : (d.name || d.code))}</p>
          <p class="fmeta">${fesc(dateStr)}${timeStr ? ` &middot; ${fesc(timeStr)}` : ''}${venueStr && !isDisplayOnly ? ` &middot; ${fesc(venueStr)}` : ''}</p>
          ${isDisplayOnly
            ? ''
            : `<a class="btn" href="${targetUrl}">Register <b>&rarr;</b></a>`}
        </div>
      `;
      fst.insertBefore(sl, fcnt);

      // Thumbnail
      const th = document.createElement('button');
      th.className = 'th';
      th.setAttribute('aria-label', `Go to ${f.title}`);
      th.innerHTML = `
        <div class="tp">${fmedia(f)}</div>
        <div class="tl">
          ${fesc(f.title)}
          <small>${fesc(isDisplayOnly ? 'Attraction' : d.code)} &middot; ${fesc(dateStr)}</small>
        </div>
      `;
      th.onclick = () => fgo(i, true);
      fth.appendChild(th);
    });

    fslides = [].slice.call(fst.querySelectorAll('.slide'));
    fthumbs = [].slice.call(fth.children);
    n = events.length;
    fcur = -1;
    fprog = 0;
    flast = performance.now();

    fgo(0, false);
    rafId = requestAnimationFrame(floop);
  }

  // Bind UI control listeners once
  if (fprev) fprev.onclick = () => fgo(fcur - 1, true);
  if (fnext) fnext.onclick = () => fgo(fcur + 1, true);

  fst.addEventListener('pointerenter', () => { fhover = true; });
  fst.addEventListener('pointerleave', () => { fhover = false; });
  fst.addEventListener('touchstart', () => { fhover = true; }, { passive: true });
  fst.addEventListener('touchend', () => { fhover = false; }, { passive: true });

  const io = new IntersectionObserver(es => {
    const was = fvis;
    fvis = es[0].isIntersecting;
    if (fvis && !was && fcur === 0 && fprog < 50) {
      fst.classList.add('anim');
      if (fslides[0]) {
        fslides[0].style.animation = 'none';
        void fslides[0].offsetWidth;
        fslides[0].style.animation = '';
      }
    }
  }, { threshold: 0.35 });
  io.observe(fst);

  // 1. Instant 0ms initial render from cache or demo items
  const initial = getLocalEvents();
  renderSlides(initial);

  // 2. Background live cloud sync (non-blocking)
  if (!isDemo) {
    apiFetchFeaturedEvents({ forceRefresh: true }).then(liveEvents => {
      if (liveEvents && liveEvents.length > 0) {
        const keyFn = (e) => {
          const b = e.banners || {};
          const imgSig = (b.featured_desktop || b.event_desktop || e.banner || '').length;
          return (e.id || '') + ':' + (e.title || '') + ':' + imgSig;
        };
        const curKeys = currentEvents.map(keyFn).join('|');
        const liveKeys = liveEvents.map(keyFn).join('|');
        if (curKeys !== liveKeys) {
          renderSlides(liveEvents);
        }
      }
    }).catch(err => {
      console.warn('apiFetchFeaturedEvents background sync:', err);
    });

    // 3. React to live update broadcasts from admin
    window.addEventListener('tantra26:featured:updated', async () => {
      try {
        const fresh = await apiFetchFeaturedEvents({ forceRefresh: true });
        if (fresh && fresh.length > 0) {
          renderSlides(fresh);
        }
      } catch {}
    });
  }
}
