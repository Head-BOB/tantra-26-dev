/**
 * featured-showcase.js — Homepage Featured Events Spotlight.
 * Handles responsive banner staging (desktop 16:8 vs mobile 4:5),
 * swipe transitions, progress bar ticker, thumbnail strip, and touch interactions.
 * Also supports Showcase Demo Mode for testing before banners are uploaded.
 */

import { apiFetchFeaturedEvents } from './api.js';

const DEPT_MAP = {
  cse:   { code: 'CSE',  name: 'Computer Science & Engineering',         bg: '#2b6a4d', fg: '#efe8da' },
  cscy:  { code: 'CSCY', name: 'Cyber Security',                         bg: '#141414', fg: '#efe8da' },
  ai:    { code: 'ADS',  name: 'Artificial Intelligence & Data Science', bg: '#c23b22', fg: '#efe8da' },
  csd:   { code: 'CSD',  name: 'Computer Science & Design',              bg: '#e3a72f', fg: '#141414' },
  csbs:  { code: 'CSBS', name: 'Computer Science & Business Systems',    bg: '#182338', fg: '#efe8da' },
  eee:   { code: 'EEE',  name: 'Electrical & Electronics Engineering',   bg: '#efe8da', fg: '#141414' },
  ece:   { code: 'ECE',  name: 'Electronics & Communication Engineering',bg: '#c23b22', fg: '#efe8da' },
  aei:   { code: 'AEI',  name: 'Applied Electronics & Instrumentation',  bg: '#2b6a4d', fg: '#efe8da' },
  civil: { code: 'CE',   name: 'Civil Engineering',                      bg: '#e3a72f', fg: '#141414' },
  mech:  { code: 'ME',   name: 'Mechanical Engineering',                 bg: '#182338', fg: '#efe8da' },
};

export const DEMO_FEATURED = [
  { id: 'hack-night',      slug: 'cse',   deptSlug: 'cse',   code: 'CSE',  dept: 'Computer Science & Engineering',         title: 'Hack Night',       type: 'Competition', date: '8 Oct', time: '6:00 PM',  venue: 'Main Auditorium',  bg: '#2b6a4d', fg: '#efe8da' },
  { id: 'capture-flag',    slug: 'cscy',  deptSlug: 'cscy',  code: 'CSCY', dept: 'Cyber Security',                         title: 'Capture the Flag', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'CS Lab 1',          bg: '#141414', fg: '#efe8da' },
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
  const deskImg = b.featured_desktop || f.img || '';
  const mobImg  = b.featured_mobile  || deskImg;

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
  let featuredEvents = [];

  if (isDemo) {
    featuredEvents = DEMO_FEATURED;
  } else {
    // 1. Fetch live featured events
    featuredEvents = await apiFetchFeaturedEvents();

    // If none from API cache, check local organiser/admin stores
    if (!featuredEvents || featuredEvents.length === 0) {
      try {
        const localEvents = JSON.parse(localStorage.getItem('tantra26:events') || '{}');
        const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
        const allMerged = [];

        // Check admin events
        Object.keys(adminEvents).forEach(slug => {
          (adminEvents[slug] || []).forEach(e => {
            if (e.is_featured) allMerged.push({ ...e, deptSlug: slug });
          });
        });

        // Check organiser events
        Object.values(localEvents).forEach(e => {
          if (e && e.is_featured && !allMerged.some(x => x.id === e.id)) {
            allMerged.push(e);
          }
        });

        if (allMerged.length > 0) {
          allMerged.sort((a, b) => (a.featured_order || 1) - (b.featured_order || 1));
          featuredEvents = allMerged;
        }
      } catch {}
    }
  }

  // Ensure unique distinct order
  if (featuredEvents && featuredEvents.length > 0) {
    featuredEvents.sort((a, b) => (a.featured_order || 1) - (b.featured_order || 1));
    const seenSlots = new Set();
    let curSlot = 1;
    featuredEvents.forEach(e => {
      let o = parseInt(e.featured_order, 10) || curSlot;
      if (seenSlots.has(o)) {
        while (seenSlots.has(curSlot)) curSlot++;
        o = curSlot;
      }
      e.featured_order = o;
      seenSlots.add(o);
    });
    featuredEvents.sort((a, b) => (a.featured_order || 1) - (b.featured_order || 1));
  }

  // If still zero featured events, keep section hidden
  if (!featuredEvents || featuredEvents.length === 0) {
    featSec.hidden = true;
    return;
  }

  // Display showcase section
  featSec.hidden = false;

  // Clear existing dynamic slides
  fst.querySelectorAll('.slide').forEach(s => s.remove());
  fth.innerHTML = '';

  let fcur = -1;
  let fprog = 0;
  let fhover = false;
  let fvis = false;
  const FDUR = 6500;
  let flast = performance.now();
  let rafId = null;

  // Populate slides and thumbnails
  featuredEvents.forEach((f, i) => {
    const d = DEPT_MAP[f.deptSlug || f.slug] || { code: f.code || 'T26', name: f.dept || 'Tantra 26' };
    const dateStr = f.date || '7-8 Oct';
    const timeStr = f.time || '';
    const venueStr = f.venue || 'Campus';
    const dept = (f.deptSlug || f.slug || '').toLowerCase();
    let prizePool = f.prize_pool || (Array.isArray(f.prizes) && f.prizes.length > 0 ? (f.prizes[0]?.reward || f.prizes[0]?.amount) : '');
    if (typeof prizePool === 'string') prizePool = prizePool.replace(/^₹\s*/, '');
    const targetUrl = isDemo
      ? `/departments/${dept}.html#events`
      : `/event.html?d=${encodeURIComponent(dept)}&e=${encodeURIComponent(f.id)}`;

    // Slide
    const sl = document.createElement('article');
    sl.className = 'slide';
    sl.innerHTML = `
      ${fmedia(f)}
      <div class="finfo">
        <div class="fchips">
          <span class="fchip">Featured</span>
          <span class="fchip c2">${fesc(f.type || 'Event')}</span>
          ${prizePool ? `<span class="fchip prize">Prize: ₹${fesc(prizePool)}</span>` : ''}
        </div>
        <h3>${fesc(f.title)}</h3>
        <p class="fdept">${fesc(d.name || d.code)}</p>
        <p class="fmeta">${fesc(dateStr)}${timeStr ? ` &middot; ${fesc(timeStr)}` : ''}${venueStr ? ` &middot; ${fesc(venueStr)}` : ''}</p>
        <a class="btn" href="${targetUrl}">Register <b>&rarr;</b></a>
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
        <small>${fesc(d.code)} &middot; ${fesc(dateStr)}</small>
      </div>
    `;
    th.onclick = () => fgo(i, true);
    fth.appendChild(th);
  });

  const fslides = [].slice.call(fst.querySelectorAll('.slide'));
  const fthumbs = [].slice.call(fth.children);
  const n = featuredEvents.length;

  function fgo(i, anim) {
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

  // Initial state
  fgo(0, false);

  if (fprev) fprev.onclick = () => fgo(fcur - 1, true);
  if (fnext) fnext.onclick = () => fgo(fcur + 1, true);

  // Pause on hover or touch
  fst.addEventListener('pointerenter', () => { fhover = true; });
  fst.addEventListener('pointerleave', () => { fhover = false; });
  fst.addEventListener('touchstart', () => { fhover = true; }, { passive: true });
  fst.addEventListener('touchend', () => { fhover = false; }, { passive: true });

  // IntersectionObserver for autoplay
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

  rafId = requestAnimationFrame(floop);
}
