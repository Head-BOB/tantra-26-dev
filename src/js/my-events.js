/**
 * my-events.js — Tantra 26 "My Events" Client Logic
 * Loads user registrations from localStorage (key 'tantra26:registrations'),
 * manages the live countdown to the next event or fest launch, renders interactive tickets,
 * provides calendar (.ics) downloads, and allows registration cancellation.
 */

import { getEventMetadata } from '../data/all-events.js';
import { generatePassId } from './access-code.js';
import { pruneDeletedRegistrations, sanitizePersonalRegistrations } from './api.js';

const KEY = 'tantra26:registrations';
// Fest start: 7 October 2026, 9:00 AM IST (UTC+05:30)
const EVENT_START = new Date('2026-10-07T09:00:00+05:30').getTime();
const YEAR = 2026;
const IST = '+05:30';

export const DEPTS = {
  cse:   ['Computer Science & Engineering', '#2b6a4d', '#efe8da', 'CSE'],
  cscy:  ['Cyber Security', '#141414', '#efe8da', 'CSCY'],
  ai:    ['Artificial Intelligence & Data Science', '#c23b22', '#efe8da', 'ADS'],
  csd:   ['Computer Science & Design', '#e3a72f', '#141414', 'CSD'],
  csbs:  ['Computer Science & Business Systems', '#182338', '#efe8da', 'CSBS'],
  eee:   ['Electrical & Electronics Engineering', '#efe8da', '#141414', 'EEE'],
  ece:   ['Electronics & Communication Engineering', '#c23b22', '#efe8da', 'ECE'],
  aei:   ['Applied Electronics & Instrumentation', '#2b6a4d', '#efe8da', 'AEI'],
  civil: ['Civil Engineering', '#e3a72f', '#141414', 'CE'],
  mech:  ['Mechanical Engineering', '#243a5e', '#efe8da', 'ME'],
};

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const $ = (x) => document.querySelector(x);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

export function eventDurationMs(r) {
  if (r && r.duration) {
    const d = parseInt(r.duration, 10);
    if (!isNaN(d) && d >= 10) return d * 60000;
  }
  const id = (r.eventId || r.event_id || '').toLowerCase();
  const title = (r.event || r.title || '').toLowerCase();
  const type = (r.etype || r.type || '').toLowerCase();
  if (id.includes('hack') || title.includes('hack') || type.includes('hack')) return 6 * 3600000;
  if (type.includes('workshop')) return 2.5 * 3600000;
  return 2 * 3600000;
}

function startOf(r) {
  if (r.date && r.time) {
    const d = /(\d{1,2})\s*([A-Za-z]{3})/i.exec(r.date || '');
    const t = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(r.time || '');
    if (d && t && MON[d[2].toLowerCase()]) {
      const h = (+t[1] % 12) + (/pm/i.test(t[3]) ? 12 : 0);
      const pad = (n) => (n < 10 ? '0' : '') + n;
      const month = pad(MON[d[2].toLowerCase()]);
      const day = pad(+d[1]);
      return new Date(`${YEAR}-${month}-${day}T${pad(h)}:${t[2]}:00${IST}`).getTime();
    }
  }
  return EVENT_START;
}

function dhm(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : (h ? `${h}h ${m}m` : `${m}m`);
}

function normalizeRecord(r) {
  const slug = (r.slug || r.dept_slug || 'cse').toLowerCase();
  const d = DEPTS[slug] || ['Department', '#e3a72f', '#141414', slug.toUpperCase()];
  const rawId = r.eventId || r.event_id || '';
  const rawTitle = r.event || r.event_title || r.title || '';
  const meta = getEventMetadata(rawId, rawTitle, slug);

  // Time & date sanitation: if time has ISO stamp or missing, resolve from meta
  const hasCleanDate = r.date && !r.date.includes('T') && r.date !== 'Campus';
  const hasCleanTime = r.time && !r.time.includes('T') && !r.time.includes('Z') && /(AM|PM)/i.test(r.time);

  const date = (meta && meta.date) ? meta.date : (hasCleanDate ? r.date : '7 Oct');
  const time = (meta && meta.time) ? meta.time : (hasCleanTime ? r.time : '10:00 AM');
  const venue = (meta && meta.venue) ? meta.venue : ((r.venue && r.venue !== 'Campus') ? r.venue : (r.venue || 'Campus'));
  const eventName = (meta && meta.title) ? meta.title : (rawTitle || 'Tantra 26 Event');
  const etype = (meta && meta.type) ? meta.type : (r.etype || r.type || 'Event');
  const fee = (meta && meta.fee) ? meta.fee : (r.fee || 'Free');
  const team = r.team || r.team_members || (meta && meta.team > 1 ? `Team of ${meta.team}` : '');
  const duration = Math.max(10, parseInt(r.duration || (meta && meta.duration) || 120, 10));

  return {
    ...r,
    slug,
    dept: r.dept || (meta ? meta.dept : d[0]),
    eventId: rawId || (meta ? meta.id : 'event'),
    event: eventName,
    etype,
    date,
    time,
    duration,
    venue,
    team,
    fee,
    name: r.name || 'Participant',
    email: r.email || '',
    phone: r.phone || '',
    college: r.college || 'Vimal Jyothi Engineering College',
    regId: r.regId || r.reg_id || generatePassId(slug),
    regTime: r.regTime || (r.time && r.time.includes('T') ? r.time : new Date().toISOString()),
  };
}

export function loadRegistrations() {
  if (/[?&]demo\b/.test(location.search)) {
    const mk = (slug, id, ev, type, date, time, venue, team, fee) => ({
      slug,
      dept: DEPTS[slug] ? DEPTS[slug][0] : slug.toUpperCase(),
      eventId: id,
      event: ev,
      etype: type,
      date,
      time,
      venue,
      team,
      fee,
      name: 'Asha Nair',
      email: 'asha@example.com',
      regId: 'T26-' + slug.toUpperCase() + '-' + id.slice(0, 4).toUpperCase(),
      regTime: new Date().toISOString(),
    });
    return [
      mk('cse', 'code-rush', 'Code Rush', 'Competition', '7 Oct', '10:00 AM', 'CS Lab 1', '', '₹50'),
      mk('ai', 'prompt-wars', 'Prompt Wars', 'Competition', '7 Oct', '3:00 PM', 'Seminar Hall', '', '₹50'),
      mk('mech', 'lathe-master', 'Lathe Master', 'Competition', '7 Oct', '11:00 AM', 'Automobile Lab', '', '₹100'),
      mk('eee', 'circuit-scramble', 'Circuit Scramble', 'Competition', '7 Oct', '1:30 PM', 'Machines Lab', 'Asha, Rahul', '₹100'),
      mk('csbs', 'startup-pitch', 'Startup Pitch', 'Competition', '7 Oct', '2:00 PM', 'Auditorium', 'Asha, Meera', '₹150'),
    ];
  }
  try {
    sanitizePersonalRegistrations();
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeRecord);
  } catch {
    return [];
  }
}

export function saveRegistrations(a) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {}
}

export function initMyEvents() {
  const isDemo = /[?&]demo\b/.test(location.search);
  if (isDemo) {
    const b = document.createElement('div');
    b.className = 'demo';
    b.textContent = 'Demo data · not saved';
    document.body.appendChild(b);
  }

  let regs = loadRegistrations().map((r) => {
    r._s = startOf(r);
    r._e = r._s ? r._s + eventDurationMs(r) : null;
    return r;
  });

  regs.sort((a, b) => (a._s == null) - (b._s == null) || a._s - b._s);

  // Auto-prune registrations for events deleted from database or admin
  pruneDeletedRegistrations().then((pruned) => {
    if (pruned) {
      regs = loadRegistrations().map((r) => {
        r._s = startOf(r);
        r._e = r._s ? r._s + eventDurationMs(r) : null;
        return r;
      });
      regs.sort((a, b) => (a._s == null) - (b._s == null) || a._s - b._s);
      updateHero();
      draw();
    }
  }).catch(() => {});

  // Hero greeting + chips
  function stat() {
    const now = Date.now();
    return {
      up: regs.filter((r) => r._e == null || now < r._e).length,
      done: regs.filter((r) => r._e != null && now >= r._e).length,
    };
  }

  function renderChips() {
    const s = stat();
    const chipsEl = $('#chips');
    if (!chipsEl) return;
    chipsEl.innerHTML =
      `<span class="chip">${regs.length} registered</span>` +
      `<span class="chip">${s.up} upcoming</span>` +
      (s.done ? `<span class="chip">${s.done} done</span>` : '');
  }

  function updateHero() {
    const greetEl = $('#greet');
    if (!greetEl) return;
    const storedName = (() => {
      try { return localStorage.getItem('tantra26:last_user_name') || ''; } catch { return ''; }
    })();
    const participantName = regs.length ? String(regs[0].name || '').trim() : storedName;
    if (regs.length) {
      greetEl.textContent = `Hey ${participantName || 'there'}, you're locked in for ${regs.length} event${regs.length > 1 ? 's' : ''}. Here's your schedule.`;
    } else if (participantName) {
      greetEl.textContent = `Hey ${participantName}, you haven't registered for any events yet. Browse events below to get your tickets.`;
    } else {
      greetEl.textContent = "You haven't registered for any events yet. Your tickets and countdown will appear here once you register.";
    }
    renderChips();
  }

  // Top navigation "← Tantra 26" goes back to previous page if navigated from site
  const backLink = document.querySelector('.top a[href="/"]');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      const hasLocalReferrer = document.referrer && document.referrer.includes(window.location.host);
      if (hasLocalReferrer || window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
    });
  }

  // Render department links at the bottom
  const othersEl = $('#others');
  if (othersEl) {
    othersEl.innerHTML = Object.keys(DEPTS).map((k) => {
      const d = DEPTS[k];
      return `<a href="/departments/${k}.html" style="--bg:${d[1]};--fg:${d[2]}">${esc(d[0])}</a>`;
    }).join('');
  }

  // Intersection Observer for card reveals
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  // Filters: All / Upcoming / Past
  let filt = 'All';
  const fl = $('#fl');
  if (fl) {
    fl.innerHTML = '';
    ['All', 'Upcoming', 'Past'].forEach((t) => {
      const b = document.createElement('button');
      b.className = 'fb' + (t === 'All' ? ' on' : '');
      b.textContent = t;
      b.onclick = () => {
        filt = t;
        [...fl.children].forEach((x) => x.classList.toggle('on', x === b));
        draw();
      };
      fl.appendChild(b);
    });
  }

  function state(r, now) {
    if (r._s == null) return 'tbd';
    if (now < r._s) return 'up';
    if (now < r._e) return 'live';
    return 'done';
  }

  function label(r, now) {
    const s = state(r, now);
    if (s === 'tbd') return 'Registered';
    if (s === 'up') return 'In ' + dhm(r._s - now);
    if (s === 'live') return 'Live now';
    return 'Done';
  }

  function draw() {
    const list = $('#list');
    const empty = $('#empty');
    if (!list) return;
    const now = Date.now();
    list.innerHTML = '';

    if (empty) empty.hidden = regs.length > 0;
    if (fl) fl.style.display = regs.length ? '' : 'none';

    const visible = regs.filter((r) => {
      const s = state(r, now);
      return filt === 'All' || (filt === 'Past' ? s === 'done' : s !== 'done');
    });

    visible.forEach((r, i) => {
      const d = DEPTS[r.slug] || [r.dept || 'Department', '#e3a72f', '#141414', (r.slug || 'T26').toUpperCase()];
      const s = state(r, now);
      const article = document.createElement('article');
      article.className = 'tk' + (s === 'done' ? ' past' : '');
      article.style.cssText = `--a:${d[1]};--af:${d[2]};transition-delay:${(i % 2) * 0.08}s`;
      article.dataset.id = r.regId;

      article.innerHTML =
        `<div class="tko"><div class="tkin">` +
        `<div class="stub">` +
          `<span class="code">${esc(d[3])}</span>` +
          `<b class="st${s === 'live' ? ' live' : ''}" data-st>${esc(label(r, now))}</b>` +
        `</div>` +
        `<div class="body">` +
          `<p class="dp">${esc(d[0])}${r.etype ? ' &middot; ' + esc(r.etype) : ''}</p>` +
          `<h3>${esc(r.event)}</h3>` +
          `<dl>` +
            `<dt>Participant</dt><dd>${esc(r.name || 'Participant')}</dd>` +
            `<dt>When</dt><dd>${r.date ? esc(r.date) + ' &middot; ' + esc(r.time) : '7 Oct &middot; 10:00 AM'}</dd>` +
            `<dt>Where</dt><dd>${esc(r.venue || 'Campus')}</dd>` +
            (r.college ? `<dt>College</dt><dd>${esc(r.college)}</dd>` : '') +
            (r.team ? `<dt>Team</dt><dd>${esc(r.team)}</dd>` : '') +
          `</dl>` +
          `<div class="foot">` +
            `<span class="rid">${esc(r.regId)}</span>` +
            `<div class="acts">` +
              `<a href="/event.html?d=${encodeURIComponent(r.slug)}&e=${encodeURIComponent(r.eventId)}" class="ab" style="text-decoration:none;display:inline-flex;align-items:center;background:var(--gold);color:var(--ink)">View Event &rarr;</a>` +
              (r._s ? `<button type="button" class="ab" data-act="ics">Add to calendar</button>` : '') +
            `</div>` +
          `</div>` +
        `</div>` +
        `</div></div>`;

      list.appendChild(article);
      io.observe(article);
    });

    updateHero();
  }

  // Calendar (.ics) event delegation
  const listEl = $('#list');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const card = b.closest('.tk');
      const id = card ? card.dataset.id : '';
      const r = regs.find((x) => x.regId === id);
      if (!r) return;

      if (b.dataset.act === 'ics') {
        const toUTC = (t) => new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, '');
        const ics = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Tantra 26//EN',
          'BEGIN:VEVENT',
          'UID:' + r.regId + '@tantra26',
          'DTSTAMP:' + toUTC(Date.now()),
          'DTSTART:' + toUTC(r._s || EVENT_START),
          'DTEND:' + toUTC(r._e || ((r._s || EVENT_START) + eventDurationMs(r))),
          'SUMMARY:' + r.event + ' (Tantra 26)',
          'LOCATION:' + (r.venue || 'Vimal Jyothi Engineering College'),
          'DESCRIPTION:' + (DEPTS[r.slug] ? DEPTS[r.slug][0] : '') + ' · Participant: ' + (r.name || '') + ' · Reg ID: ' + r.regId,
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n');

        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (r.event.replace(/\W+/g, '-').toLowerCase() || 'event') + '-tantra26.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);
      }
    });
  }

  // Next up & Countdown timer
  let target = null;
  let targetType = 'fest';
  const units = {};
  const slabsEl = $('#slabs');
  const SLABS_HTML = slabsEl ? slabsEl.innerHTML : '';

  function bindUnits() {
    Object.keys(units).forEach((k) => delete units[k]);
    [...document.querySelectorAll('#slabs [data-u]')].forEach((n) => {
      units[n.dataset.u] = n;
    });
  }
  bindUnits();

  function setU(k, v) {
    const text = (v < 10 ? '0' : '') + v;
    const n = units[k];
    if (n && n.textContent !== text) {
      n.textContent = text;
      n.classList.remove('tick');
      void n.offsetWidth; // trigger reflow
      n.classList.add('tick');
    }
  }

  function updateNext() {
    const now = Date.now();
    const up = regs.filter((r) => r._s != null && now < r._e);
    up.sort((a, b) => a._s - b._s);

    const r = up[0];
    const card = $('#ncard');
    const eyebrow = $('#next-eyebrow');
    const heading = $('#next-h');

    if (!(r && now >= r._s) && !units.d && slabsEl) {
      slabsEl.innerHTML = SLABS_HTML;
      bindUnits();
    }

    if (r && now >= r._s) {
      targetType = 'live';
      target = null;
      if (eyebrow) eyebrow.textContent = 'Right now';
      if (heading) heading.textContent = `${r.event} is live now`;
      if (slabsEl) slabsEl.innerHTML = '<div class="livebig">Live now</div>';
    } else if (r) {
      targetType = 'event';
      target = r._s;
      if (eyebrow) eyebrow.textContent = 'Next up';
      if (heading) heading.textContent = `${r.event} starts in`;
    } else {
      targetType = 'fest';
      target = EVENT_START;
      if (eyebrow) eyebrow.textContent = regs.length ? 'All done' : 'Fest countdown';
      if (heading) heading.textContent = Date.now() < EVENT_START ? 'Fest starts in' : 'Tantra 26 is live';
    }

    if (card) {
      if (r) {
        const d = DEPTS[r.slug] || [r.dept || ''];
        card.innerHTML =
          `<span class="tag">${now >= r._s ? 'Live now' : 'Next up'}</span>` +
          `<h2>${esc(r.event)}</h2>` +
          `<p class="d">${esc(d[0])}${r.etype ? ' &middot; ' + esc(r.etype) : ''}</p>` +
          `<dl>` +
            `<dt>Participant</dt><dd>${esc(r.name || 'Participant')}</dd>` +
            `<dt>When</dt><dd>${esc(r.date)} &middot; ${esc(r.time)}</dd>` +
            `<dt>Where</dt><dd>${esc(r.venue || 'Campus')}</dd>` +
            (r.college ? `<dt>College</dt><dd>${esc(r.college)}</dd>` : '') +
            `<dt>Reg ID</dt><dd>${esc(r.regId)}</dd>` +
          `</dl>`;
      } else {
        card.innerHTML =
          `<span class="tag">${regs.length ? 'No more events' : 'Fest start'}</span>` +
          `<h2>${regs.length ? "You've done them all" : '7 October 2026'}</h2>` +
          `<p class="d">${regs.length ? 'Register for more from the departments below.' : '9:00 AM IST &middot; Vimal Jyothi Engineering College'}</p>`;
      }
    }
  }

  function tick() {
    const now = Date.now();
    if (target != null && units.d) {
      const s = Math.max(0, Math.floor((target - now) / 1000));
      setU('d', Math.floor(s / 86400));
      setU('h', Math.floor((s % 86400) / 3600));
      setU('m', Math.floor((s % 3600) / 60));
      setU('s', s % 60);
      if (target <= now && targetType === 'event') {
        updateNext();
      }
    }

    [...document.querySelectorAll('.tk')].forEach((c) => {
      const r = regs.find((x) => x.regId === c.dataset.id);
      if (!r) return;
      const st = c.querySelector('[data-st]');
      const s = state(r, now);
      if (st) {
        st.textContent = label(r, now);
        st.classList.toggle('live', s === 'live');
      }
      c.classList.toggle('past', s === 'done');
    });
  }

  updateHero();
  draw();
  updateNext();
  tick();
  setInterval(tick, 1000);
}
