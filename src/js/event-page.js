/**
 * event-page.js — Logic for Tantra 26 public event page (event.html).
 * Displays rich event hero, live countdown timer, organiser detailed description,
 * competition how-it-works & rules, coordinator contact, and the original
 * multi-step sliding registration modal with UPI QR code and confirmation ticket.
 */

import QRCode from 'qrcode';
import { getAllEvents, getEventMetadata } from '../data/all-events.js';
import { submitRegistration, apiFetchSingleEvent } from './api.js';
import { generatePassId } from './access-code.js';

export const DEPTS = {
  cse:   ['Computer Science & Engineering',           '#2b6a4d', '#efe8da', 'CSE'],
  cscy:  ['Cyber Security',                           '#141414', '#efe8da', 'CSCY'],
  ai:    ['Artificial Intelligence & Data Science',   '#c23b22', '#efe8da', 'AI'],
  csd:   ['Computer Science & Design',                '#e3a72f', '#141414', 'CSD'],
  csbs:  ['Computer Science & Business Systems',      '#182338', '#efe8da', 'CSBS'],
  eee:   ['Electrical & Electronics Engineering',     '#efe8da', '#141414', 'EEE'],
  ece:   ['Electronics & Communication Engineering',  '#c23b22', '#efe8da', 'ECE'],
  aei:   ['Applied Electronics & Instrumentation',    '#2b6a4d', '#efe8da', 'AEI'],
  civil: ['Civil Engineering',                        '#e3a72f', '#141414', 'CE'],
  mech:  ['Mechanical Engineering',                   '#182338', '#efe8da', 'ME'],
};

const YEAR = 2026;
const IST = '+05:30';
const EVENT_LEN_H = 2; // default event duration: 2 hours
const EV_KEY = 'tantra26:events';
const ADMIN_EV_KEY = 'tantra26:admin:events';
const DEL_EV_KEY = 'tantra26:admin:deleted_events';
const REG_KEY = 'tantra26:registrations';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function readLocalRegs() {
  try {
    return JSON.parse(localStorage.getItem(REG_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalRegs(a) {
  try {
    localStorage.setItem(REG_KEY, JSON.stringify(a));
  } catch {}
}

function demoEvent(kind) {
  const e = {
    slug: 'cse',
    id: 'code-rush',
    title: 'Code Rush',
    type: 'Competition',
    date: '7 Oct',
    time: '10:00 AM',
    venue: 'CS Lab 1',
    fee: '₹50',
    team: 1,
    desc: 'Timed competitive programming round. Solve as many problems as you can before the clock runs out.',
    banner: '',
    details: 'Code Rush is a fast, friendly programming contest for anyone who likes a good puzzle. You get a set of problems, a shared scoreboard and a running clock.\n\nIt does not matter which language you use. What matters is how many problems you solve correctly and how quickly.\n\nBring a laptop if you like. Lab computers are also available.',
    steps: [
      { t: 'Check in', x: 'Arrive at CS Lab 1 ten minutes early and show your registration ID at the desk.' },
      { t: 'Get your problems', x: 'At the start signal you receive the problem set and a login for the scoreboard.' },
      { t: 'Solve and submit', x: 'Write your solution in any language and submit it. Wrong answers add a small time penalty.' },
      { t: 'Watch the board', x: 'The live scoreboard shows ranks. The contest ends when the clock reaches zero.' },
    ],
    rules: [
      'This is an individual contest. Teams are not allowed.',
      'No internet searching or AI tools during the round.',
      'Phones must stay in your bag.',
      'The judges decision is final.',
      'Ties are broken by total time taken.',
    ],
    coord: { name: 'Asha Nair', phone: '+91 98765 43210', email: 'asha@example.com' },
  };
  if (kind === 'workshop') {
    e.id = 'git-deploy';
    e.title = 'Git & Deploy';
    e.type = 'Workshop';
    e.date = '8 Oct';
    e.time = '11:00 AM';
    e.venue = 'Seminar Hall';
    e.fee = 'Free';
    e.desc = 'Version control and putting a project live.';
    e.details = 'A hands on session on version control, pull requests and deploying a small project in under an hour.\n\nNo experience needed. Bring a laptop with Git installed.';
    e.steps = [];
    e.rules = [];
  }
  if (kind === 'expo') {
    e.id = 'robo-expo';
    e.slug = 'mech';
    e.title = 'Robo Expo';
    e.type = 'Expo';
    e.date = '9 Oct';
    e.time = '10:00 AM';
    e.venue = 'Workshop Ground';
    e.fee = 'Free';
    e.desc = 'Student built robots on display.';
    e.details = 'Walk through a gallery of robots built by students. Talk to the builders, see them run and vote for your favourite.';
    e.steps = [];
    e.rules = [];
  }
  return e;
}

function loadEvent(slug, id) {
  const m = /[?&]demo(=(\w+))?/.exec(location.search);
  if (m) return demoEvent(m[2]);
  if (!slug && !id) return null;

  // 1. Organiser edited record
  try {
    const s = JSON.parse(localStorage.getItem(EV_KEY) || '{}');
    if (s[slug + ':' + id]) return s[slug + ':' + id];
    for (const k in s) {
      if (s[k] && s[k].id === id && (!slug || s[k].slug === slug)) return s[k];
    }
  } catch {}

  // 2. Admin dashboard saved events
  try {
    const adminEvents = JSON.parse(localStorage.getItem(ADMIN_EV_KEY) || '{}');
    const delEvents = JSON.parse(localStorage.getItem(DEL_EV_KEY) || '{}');
    const list = adminEvents[slug] || [];
    const dels = delEvents[slug] || [];
    const found = list.find((x) => x.id === id && !dels.includes(id));
    if (found) {
      return {
        slug,
        id: found.id,
        title: found.title,
        type: found.type || 'Competition',
        date: found.date || '7 Oct',
        time: found.time || '10:00 AM',
        venue: found.venue || 'Campus',
        fee: found.fee || 'Free',
        team: found.team || 1,
        desc: found.desc || '',
        details: found.details || found.desc || '',
        banner: found.banner || '',
        steps: found.steps || [],
        rules: found.rules || [],
        coord: found.coord || { name: '', phone: '', email: '' },
      };
    }
  } catch {}

  // 3. Static catalog
  const meta = getEventMetadata(id, '', slug);
  if (meta) {
    return {
      slug: meta.slug || slug,
      id: meta.id,
      title: meta.title,
      type: meta.type || 'Competition',
      date: meta.date || '7 Oct',
      time: meta.time || '10:00 AM',
      venue: meta.venue || 'Campus',
      fee: meta.fee || 'Free',
      team: meta.team || 1,
      desc: meta.desc || '',
      details: meta.details || meta.desc || '',
      banner: meta.banner || '',
      steps: meta.steps || [],
      rules: meta.rules || [],
      coord: meta.coord || { name: '', phone: '', email: '' },
    };
  }

  return null;
}

// ─── Main Execution ──────────────────────────────────────────────
const qs = new URLSearchParams(location.search);
const rawSlug = (qs.get('d') || '').trim().toLowerCase();
const rawId = (qs.get('e') || '').trim();
let ev = loadEvent(rawSlug, rawId);

if (!ev && rawId) {
  apiFetchSingleEvent(rawSlug, rawId).then((cloudEv) => {
    if (cloudEv) {
      try {
        const s = JSON.parse(localStorage.getItem(EV_KEY) || '{}');
        s[(cloudEv.slug || rawSlug) + ':' + cloudEv.id] = cloudEv;
        localStorage.setItem(EV_KEY, JSON.stringify(s));
      } catch {}
      location.reload();
    }
  }).catch(() => {});
}

if (!ev) {
  $('#gate').hidden = false;
} else {
  ev.steps = ev.steps || [];
  ev.rules = ev.rules || [];
  ev.coord = ev.coord || {};
  const D = DEPTS[ev.slug] || ['Department', '#e3a72f', '#141414', (ev.slug || 'T26').toUpperCase()];

  $('#app').hidden = false;
  document.title = `${ev.title} · ${D[0]} · Tantra 26`;

  // Start time calculation (strictly counts down to the exact start of this event)
  const MON = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  function startOf() {
    const rawDate = String(ev.date || '7 Oct').trim();
    const rawTime = String(ev.time || '10:00 AM').trim();

    let day = 7;
    let month = 10;
    let year = YEAR;

    const dMatch1 = rawDate.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/);
    const dMatch2 = rawDate.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
    if (dMatch1 && MON[dMatch1[2].toLowerCase()]) {
      day = parseInt(dMatch1[1], 10);
      month = MON[dMatch1[2].toLowerCase()];
    } else if (dMatch2 && MON[dMatch2[1].toLowerCase()]) {
      day = parseInt(dMatch2[2], 10);
      month = MON[dMatch2[1].toLowerCase()];
    }

    let h = 10;
    let m = 0;
    const t12 = rawTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    const t24 = rawTime.match(/(\d{1,2}):(\d{2})/);
    if (t12) {
      let hours = parseInt(t12[1], 10) % 12;
      if (/pm/i.test(t12[3])) hours += 12;
      h = hours;
      m = t12[2] ? parseInt(t12[2], 10) : 0;
    } else if (t24) {
      h = parseInt(t24[1], 10);
      m = parseInt(t24[2], 10);
    }

    const p = (n) => String(n).padStart(2, '0');
    const ts = new Date(`${year}-${p(month)}-${p(day)}T${p(h)}:${p(m)}:00${IST}`).getTime();
    return isNaN(ts) ? new Date(`${YEAR}-10-07T10:00:00${IST}`).getTime() : ts;
  }
  const START = startOf();
  const END = START ? START + EVENT_LEN_H * 3600000 : null;

  // Hero styling
  const hero = $('#hero');
  hero.style.setProperty('--c', D[1]);
  hero.style.setProperty('--t', D[2]);
  document.documentElement.style.setProperty('--c', D[1]);
  document.documentElement.style.setProperty('--t', D[2]);

  if (ev.banner) {
    hero.classList.add('img');
    hero.style.backgroundImage = `url("${ev.banner.replace(/"/g, '')}")`;
  }
  $('#ghost').textContent = D[3];
  $('#chips').innerHTML = `<span class="chip g">${esc(ev.type)}</span><span class="chip">${esc(ev.fee || 'Free')}</span>`;
  $('#eye').textContent = `Tantra 26 · ${D[0]}`;

  function formatTitleSpan(text) {
    const symRe = /([µμΩωπΠλΛθΘαβγδΔσΣ∞≈≠≤≥±√∫°])/g;
    return esc(text).replace(symRe, '<span class="sym" style="text-transform:none;font-family:\'Inter\',system-ui,sans-serif;display:inline-block">$1</span>');
  }

  // Animated title splitting
  const words = ev.title.split(' ');
  const lines = words.reduce((acc, w) => {
    const last = acc[acc.length - 1];
    if (last && (last + ' ' + w).length <= 14) acc[acc.length - 1] = last + ' ' + w;
    else acc.push(w);
    return acc;
  }, []);
  $('#title').innerHTML = lines.map((l) => `<span class="ln"><span>${formatTitleSpan(l)}</span></span>`).join('');
  $('#lead').textContent = ev.desc || '';
  $('#facts').innerHTML = [
    ['When', `${ev.date} · ${ev.time}`],
    ['Where', ev.venue],
    ['Team', ev.team > 1 ? `Up to ${ev.team} members` : 'Individual'],
    ['Fee', ev.fee || 'Free'],
  ].map((r) => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('');

  const backUrl = '/#departments';
  $('#back').href = backUrl;
  $('#back2').href = backUrl;

  // Description / About section
  const tKind = ev.type.toLowerCase();
  $('#about-h').textContent = `About this ${tKind}`;
  $('#about-eye').textContent = ev.type === 'Competition' ? 'The challenge' : 'What to expect';
  const fullText = ev.details || ev.desc || '';
  const paras = fullText.split(/\n\s*\n/).filter(Boolean);
  $('#about-t').innerHTML = paras.map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

  // Competition-only sections: Guide & Rules
  if (ev.type === 'Competition' && ev.steps.length > 0) {
    $('#s-steps').hidden = false;
    $('#steps').innerHTML = ev.steps.map((s, i) =>
      `<div class="step reveal" style="transition-delay:${(i % 3) * 0.08}s">` +
      `<i>${i < 9 ? '0' : ''}${i + 1}</i><h3>${esc(s.t)}</h3><p>${esc(s.x)}</p></div>`
    ).join('');
  }

  if (ev.type === 'Competition' && ev.rules.length > 0) {
    $('#s-rules').hidden = false;
    $('#rules').innerHTML = ev.rules.map((r, i) =>
      `<li><b>${i + 1}</b><span>${esc(r)}</span></li>`
    ).join('');
  }

  // Event Coordinator section
  const c = ev.coord || {};
  if (c.name || c.phone) {
    $('#s-coord').hidden = false;
    $('#c-name').textContent = c.name || 'Event Coordinator';
    let actsHtml = '';
    if (c.phone) {
      actsHtml += `<a class="cb" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">Call ${esc(c.phone)}</a>`;
    }
    $('#c-acts').innerHTML = actsHtml;
  }

  // Scroll reveal observer
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((n) => io.observe(n));

  // Countdown timer logic
  let units = {};
  const CD = $('#cd');
  const CDHTML = CD.innerHTML;
  let mode = '';

  function bindUnits() {
    units = {};
    CD.querySelectorAll('[data-u]').forEach((n) => {
      units[n.dataset.u] = n;
    });
  }
  bindUnits();

  function setU(k, v) {
    const s = (v < 10 ? '0' : '') + v;
    const n = units[k];
    if (n && n.textContent !== s) {
      n.textContent = s;
      n.classList.remove('tick');
      void n.offsetWidth;
      n.classList.add('tick');
    }
  }

  function tick() {
    const n = Date.now();
    const m = START == null ? 'none' : n < START ? 'before' : n < END ? 'live' : 'done';
    if (m !== mode) {
      mode = m;
      if (m === 'live') {
        CD.innerHTML = '<div class="big" style="--bg:#c23b22;--fg:#efe8da">Live now</div>';
      } else if (m === 'done') {
        CD.innerHTML = '<div class="big" style="--bg:#182338;--fg:#efe8da">Event ended</div>';
      } else if (m === 'none') {
        CD.hidden = true;
      } else {
        CD.innerHTML = CDHTML;
        bindUnits();
      }
      bar();
    }
    if (m === 'before') {
      const s = Math.floor((START - n) / 1000);
      setU('d', Math.floor(s / 86400));
      setU('h', Math.floor((s % 86400) / 3600));
      setU('m', Math.floor((s % 3600) / 60));
      setU('s', s % 60);
    }
  }
  tick();
  setInterval(tick, 500);

  // Fetch fresh state from cloud database to reflect any updates made by organisers
  if (rawId) {
    apiFetchSingleEvent(rawSlug, rawId).then((cloudEv) => {
      if (!cloudEv) return;
      let needsCache = false;
      if (cloudEv.details && cloudEv.details !== ev.details) {
        ev.details = cloudEv.details;
        const fullText = ev.details || ev.desc || '';
        const paras = fullText.split(/\n\s*\n/).filter(Boolean);
        const aboutT = $('#about-t');
        if (aboutT) aboutT.innerHTML = paras.map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
        needsCache = true;
      }
      if (cloudEv.banner && cloudEv.banner !== ev.banner) {
        ev.banner = cloudEv.banner;
        const heroEl = $('#hero');
        if (heroEl) {
          heroEl.classList.add('img');
          heroEl.style.backgroundImage = `url("${ev.banner.replace(/"/g, '')}")`;
        }
        needsCache = true;
      }
      if (cloudEv.steps && Array.isArray(cloudEv.steps) && cloudEv.steps.length > 0) {
        ev.steps = cloudEv.steps;
        if (ev.type === 'Competition') {
          const sSteps = $('#s-steps');
          const stepsEl = $('#steps');
          if (sSteps) sSteps.hidden = false;
          if (stepsEl) {
            stepsEl.innerHTML = ev.steps.map((s, i) =>
              `<div class="step reveal in" style="transition-delay:${(i % 3) * 0.08}s">` +
              `<i>${i < 9 ? '0' : ''}${i + 1}</i><h3>${esc(s.t)}</h3><p>${esc(s.x)}</p></div>`
            ).join('');
          }
        }
        needsCache = true;
      }
      if (cloudEv.rules && Array.isArray(cloudEv.rules) && cloudEv.rules.length > 0) {
        ev.rules = cloudEv.rules;
        if (ev.type === 'Competition') {
          const sRules = $('#s-rules');
          const rulesEl = $('#rules');
          if (sRules) sRules.hidden = false;
          if (rulesEl) {
            rulesEl.innerHTML = ev.rules.map((r, i) =>
              `<li><b>${i + 1}</b><span>${esc(r)}</span></li>`
            ).join('');
          }
        }
        needsCache = true;
      }
      if (cloudEv.coord && (cloudEv.coord.name || cloudEv.coord.phone)) {
        ev.coord = cloudEv.coord;
        const sCoord = $('#s-coord');
        const cName = $('#c-name');
        const cActs = $('#c-acts');
        if (sCoord) sCoord.hidden = false;
        if (cName) cName.textContent = ev.coord.name || 'Event Coordinator';
        if (cActs && ev.coord.phone) {
          cActs.innerHTML = `<a class="cb" href="tel:${esc(ev.coord.phone.replace(/[^\d+]/g, ''))}">Call ${esc(ev.coord.phone)}</a>`;
        }
        needsCache = true;
      }
      if (needsCache) {
        try {
          const s = JSON.parse(localStorage.getItem(EV_KEY) || '{}');
          s[(ev.slug || rawSlug) + ':' + ev.id] = { ...ev, ...cloudEv };
          localStorage.setItem(EV_KEY, JSON.stringify(s));
        } catch {}
      }
    }).catch(() => {});
  }

  function isUserRegistered() {
    return readLocalRegs().some((r) => r.slug === ev.slug && (r.eventId === ev.id || r.event === ev.title));
  }

  function bar() {
    $('#bar-t').innerHTML = formatTitleSpan(ev.title);
    $('#bar-s').textContent = `${ev.date} · ${ev.time} · ${ev.fee || 'Free'}`;
    const a = $('#bar-act');
    if (mode === 'done') {
      a.innerHTML = '<button class="reg" disabled>Event ended</button>';
    } else if (isUserRegistered()) {
      a.innerHTML = '<a class="reg done" href="/my-events.html">Registered &#10003; View my events</a>';
    } else {
      a.innerHTML = '<button class="reg" id="regbtn">Register <b>&rarr;</b></button>';
      const b = $('#regbtn');
      if (b) b.onclick = () => openModal();
    }
  }

  // ══════════════════════════════════════════════════════════════
  // REGISTRATION & UPI PAYMENT MODAL (ORIGINAL SLIDING MULTI-STEP)
  // ══════════════════════════════════════════════════════════════
  const modal       = $('#modal');
  const slider      = $('#modal-slider');
  const detailsForm = $('#form');
  const payForm     = $('#pay-form');

  const EASTER_EGG_PEOPLE = [
    { name: 'Panamaram Pachu', email: 'kolamassarju@email.com' },
    { name: 'Rasak',           email: 'rasakrafu@email.com' },
    { name: 'Garvasis',        email: 'johnsgarvasis@email.com' },
    { name: 'Shibu',           email: 'shibukuttan@email.com' },
    { name: 'Njuni',           email: 'njunialen@email.com' },
  ];

  function applyEasterEggPlaceholder(form) {
    if (!form || !form.elements) return;
    const pick = EASTER_EGG_PEOPLE[Math.floor(Math.random() * EASTER_EGG_PEOPLE.length)];
    if (form.elements.name) form.elements.name.placeholder = `e.g. ${pick.name}`;
    if (form.elements.email) form.elements.email.placeholder = pick.email;
  }
  applyEasterEggPlaceholder(detailsForm);

  let curData     = null;
  const feeRaw    = String(ev.fee || '').trim();
  const isFreeEvent = /free|^₹?0$/i.test(feeRaw);
  let isProcessing = false;
  let conflictConfirmed = false;

  function setStep(stepNum) {
    const translatePct = ((stepNum - 1) * -33.333333).toFixed(4);
    if (slider) slider.style.transform = `translateX(${translatePct}%)`;

    const d1 = $('#step-dot-1'), d2 = $('#step-dot-2'), d3 = $('#step-dot-3');
    const l1 = $('#step-line-1'), l2 = $('#step-line-2');

    if (d1) d1.className = 'step-indicator' + (stepNum === 1 ? ' active' : ' done');
    if (l1) l1.className = 'step-line' + (stepNum >= 2 ? ' active' : '');
    if (d2) d2.className = 'step-indicator' + (stepNum === 2 ? ' active' : stepNum > 2 ? ' done' : '');
    if (l2) l2.className = 'step-line' + (stepNum === 3 ? ' active' : '');
    if (d3) d3.className = 'step-indicator' + (stepNum === 3 ? ' active' : '');
  }

  function parseEventTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const d = /(\d{1,2})\s*([A-Za-z]{3})/i.exec(dateStr);
    const t = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(timeStr);
    if (!d || !t) return null;
    const m = MON[d[2].toLowerCase()];
    if (!m) return null;
    const h = (+t[1] % 12) + (/pm/i.test(t[3]) ? 12 : 0);
    const pad = (n) => (n < 10 ? '0' : '') + n;
    return new Date(`2026-${pad(m)}-${pad(+d[1])}T${pad(h)}:${t[2]}:00+05:30`).getTime();
  }

  function getEventDurationHours(e) {
    const id = (e.id || e.eventId || '').toLowerCase();
    const type = (e.type || e.etype || '').toLowerCase();
    const title = (e.title || e.event || '').toLowerCase();
    if (id.includes('hack') || title.includes('hack') || type.includes('hack')) return 6;
    if (type.includes('workshop')) return 2.5;
    return 2;
  }

  function formatTime12(h, m) {
    const ampm = (h >= 12 && h < 24) || h === 12 ? 'PM' : 'AM';
    const h12 = (h % 12) === 0 ? 12 : (h % 12);
    const mStr = (m < 10 ? '0' : '') + m;
    return `${h12}:${mStr} ${ampm}`;
  }

  function getTimeRangeString(dateStr, timeStr, durationHours) {
    const start = parseEventTime(dateStr, timeStr);
    if (!start) return timeStr || '';
    const d = new Date(start);
    const startH = d.getHours();
    const startM = d.getMinutes();
    const endTotalM = startH * 60 + startM + Math.round(durationHours * 60);
    const endH = Math.floor(endTotalM / 60);
    const endM = endTotalM % 60;
    return `${formatTime12(startH, startM)} – ${formatTime12(endH, endM)}`;
  }

  function findScheduleConflicts(targetEvent, userEmail, userPhone) {
    const allRegs = readLocalRegs();
    if (!allRegs.length) return [];

    const cleanEmail = (userEmail || '').toLowerCase().trim();
    const cleanPhone = (userPhone || '').replace(/\D/g, '');

    const userRegs = allRegs.filter((r) => {
      if (cleanEmail && r.email && r.email.toLowerCase().trim() === cleanEmail) return true;
      if (cleanPhone && r.phone && r.phone.replace(/\D/g, '') === cleanPhone) return true;
      return false;
    });

    const candidateRegs = userRegs.length > 0 ? userRegs : allRegs;
    const targetStart = parseEventTime(targetEvent.date, targetEvent.time);
    if (!targetStart) return [];
    const targetDurHours = getEventDurationHours(targetEvent);
    const targetEnd = targetStart + targetDurHours * 3600000;

    const conflicts = [];
    candidateRegs.forEach((r) => {
      const regEventId = r.eventId || r.event_id;
      if (regEventId === targetEvent.id && r.slug === targetEvent.slug) return;

      const meta = getEventMetadata(regEventId, r.event || r.event_title, r.slug);
      const rDate = (r.date && !r.date.includes('T')) ? r.date : (meta ? meta.date : '7 Oct');
      const rTime = (r.time && /(AM|PM)/i.test(r.time)) ? r.time : (meta ? meta.time : '10:00 AM');
      const rStart = parseEventTime(rDate, rTime);
      if (!rStart) return;

      const rDurHours = getEventDurationHours(meta || r);
      const rEnd = rStart + rDurHours * 3600000;

      if (targetStart < rEnd && targetEnd > rStart) {
        conflicts.push({
          event: r.event || (meta ? meta.title : 'Registered Event'),
          dept: r.dept || (meta ? meta.dept : (r.slug ? r.slug.toUpperCase() : 'Event')),
          slug: r.slug,
          date: rDate,
          time: rTime,
          start: rStart,
          end: rEnd,
          timeRange: getTimeRangeString(rDate, rTime, rDurHours),
          regId: r.regId,
        });
      }
    });

    return conflicts;
  }

  function clearConflictWarning() {
    const existing = $('#conflict-overlay');
    if (existing) existing.remove();
  }

  function renderConflictWarning(conflicts, onConfirm) {
    clearConflictWarning();
    const targetDurHours = getEventDurationHours(ev);
    const curTimeRange = getTimeRangeString(ev.date, ev.time, targetDurHours);

    const warn = document.createElement('div');
    warn.className = 'conflict-overlay';
    warn.id = 'conflict-overlay';

    warn.innerHTML =
      `<div class="co-header">` +
        `<div>` +
          `<div class="co-header-tag">Schedule Conflict</div>` +
          `<h3>Time Clash Detected</h3>` +
        `</div>` +
        `<button type="button" class="co-close-btn" id="co-x-btn" aria-label="Dismiss">&times;</button>` +
      `</div>` +
      `<div class="co-body">` +
        `<div class="co-event-card">` +
          `<span class="co-badge">Registering For</span>` +
          `<h4>${esc(ev.title)}</h4>` +
          `<p>${esc(D[0])} &middot; ${esc(ev.date)} &middot; ${esc(curTimeRange)}</p>` +
        `</div>` +
        `<div class="co-clash-header">` +
          `Overlaps with ${conflicts.length} registered event${conflicts.length > 1 ? 's' : ''}:` +
        `</div>` +
        `<div class="co-clash-list">` +
          conflicts.map((c) =>
            `<div class="co-clash-item">` +
              `<div class="co-clash-info">` +
                `<span class="co-clash-dept">${esc(c.dept)}</span>` +
                `<div class="co-clash-title">${esc(c.event)}</div>` +
                `<span class="co-clash-time">${esc(c.date)} &middot; ${esc(c.timeRange)}</span>` +
              `</div>` +
              `<span class="co-clash-tag">Clashes</span>` +
            `</div>`
          ).join('') +
        `</div>` +
      `</div>` +
      `<div class="co-actions">` +
        `<button type="button" class="co-btn-back" id="co-back-btn">&larr; Review / Go Back</button>` +
        `<button type="button" class="co-btn-confirm" id="co-confirm-btn">Confirm &amp; Proceed &rarr;</button>` +
      `</div>`;

    const sheet = modal ? modal.querySelector('.reg-sheet') : null;
    if (sheet) {
      sheet.appendChild(warn);
    } else {
      detailsForm.appendChild(warn);
    }

    const dismiss = () => {
      clearConflictWarning();
      const hasName = detailsForm.elements.name && detailsForm.elements.name.value.trim();
      const hasEmail = detailsForm.elements.email && detailsForm.elements.email.value.trim();
      if (!conflictConfirmed && !hasName && !hasEmail) {
        closeModal();
      }
    };

    const xBtn = warn.querySelector('#co-x-btn');
    if (xBtn) xBtn.onclick = dismiss;
    const backBtn = warn.querySelector('#co-back-btn');
    if (backBtn) backBtn.onclick = dismiss;
    const confirmBtn = warn.querySelector('#co-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        conflictConfirmed = true;
        clearConflictWarning();
        onConfirm();
      };
    }
  }

  function openModal() {
    curData  = null;
    conflictConfirmed = false;
    clearConflictWarning();

    $('#m-type').textContent = `${ev.type} · ${ev.date}`;
    $('#m-title').textContent = ev.title;

    const feeDisp = $('#m-fee-display');
    if (feeDisp) feeDisp.textContent = ev.fee || 'Free';
    const teamDisp = $('#m-team-display');
    if (teamDisp) teamDisp.textContent = ev.team > 1 ? `Team of ${ev.team}` : 'Individual';

    detailsForm.reset();
    $('#err').textContent = '';
    applyEasterEggPlaceholder(detailsForm);
    const teamL = $('#team-l');
    if (teamL) teamL.style.display = ev.team > 1 ? 'grid' : 'none';

    const subBtn = $('#sub');
    if (subBtn) {
      subBtn.disabled = false;
      subBtn.style.display = '';
      subBtn.textContent = isFreeEvent ? 'Complete Free Registration ✓' : 'Proceed to Payment →';
    }

    const dot2 = $('#step-dot-2');
    const line2 = $('#step-line-2');
    if (dot2) dot2.style.display = isFreeEvent ? 'none' : 'flex';
    if (line2) line2.style.display = isFreeEvent ? 'none' : 'block';

    setStep(1);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    const earlyConflicts = findScheduleConflicts(ev);
    if (earlyConflicts.length > 0) {
      renderConflictWarning(earlyConflicts, () => {
        setTimeout(() => {
          if (detailsForm.elements.name) detailsForm.elements.name.focus();
        }, 60);
      });
    } else {
      setTimeout(() => {
        if (detailsForm.elements.name) detailsForm.elements.name.focus();
      }, 60);
    }
  }

  function closeModal() {
    if (isProcessing) return;
    conflictConfirmed = false;
    clearConflictWarning();
    modal.classList.remove('open');
    document.body.style.overflow = '';
    bar();
  }

  const mx = $('#m-x');
  if (mx) mx.onclick = closeModal;
  const okClose = $('#ok-close');
  if (okClose) okClose.onclick = closeModal;

  modal.addEventListener('click', (e) => {
    if (isProcessing) return;
    if (e.target === modal) closeModal();
  });
  window.addEventListener('keydown', (e) => {
    if (isProcessing) return;
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  detailsForm.addEventListener('input', () => {
    conflictConfirmed = false;
    clearConflictWarning();
  });

  // Step 1: Submit details
  detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isProcessing) return;
    const f = detailsForm;
    const err = $('#err');
    const d = {
      name:    f.elements.name.value.trim(),
      email:   f.email.value.trim(),
      phone:   f.phone.value.trim(),
      college: f.college.value.trim(),
      team:    (f.team ? f.team.value : '').trim(),
    };

    if (!d.name || !d.college) {
      err.textContent = 'Please fill in your name and college.';
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(d.email)) {
      err.textContent = 'Enter a valid email address.';
      return;
    }
    if (d.phone.replace(/\D/g, '').length < 10) {
      err.textContent = 'Enter a valid 10-digit phone number.';
      return;
    }

    if (readLocalRegs().some((r) => r.eventId === ev.id && r.slug === ev.slug && r.email.toLowerCase() === d.email.toLowerCase())) {
      err.textContent = 'This email is already registered for this event.';
      return;
    }
    err.textContent = '';
    curData = d;

    if (!conflictConfirmed) {
      const conflicts = findScheduleConflicts(ev, d.email, d.phone);
      if (conflicts.length > 0) {
        renderConflictWarning(conflicts, () => {
          proceedAfterDetails();
        });
        return;
      }
    }

    proceedAfterDetails();

    async function proceedAfterDetails() {
      if (isFreeEvent) {
        const subBtn = $('#sub');
        isProcessing = true;
        if (mx) mx.classList.add('disabled');
        if (subBtn) {
          subBtn.disabled = true;
          subBtn.innerHTML = '<span class="btn-spinner"></span> Confirming Registration…';
        }
        try {
          await new Promise((r) => setTimeout(r, 1000));
          await finalizeRegistration('FREE-REGISTRATION');
        } catch (submitErr) {
          err.textContent = submitErr.message || 'Registration failed. Please try again.';
        } finally {
          isProcessing = false;
          if (mx) mx.classList.remove('disabled');
          if (subBtn) {
            subBtn.disabled = false;
            subBtn.textContent = 'Complete Free Registration ✓';
          }
        }
      } else {
        preparePaymentStep();
        setStep(2);
      }
    }
  });

  // Step 2: Payment step
  function preparePaymentStep() {
    const deptPayments = (() => {
      try { return JSON.parse(localStorage.getItem('tantra26:admin:dept_payment') || '{}'); } catch { return {}; }
    })();
    const deptCfg = deptPayments[ev.slug] || {};
    const upiId = deptCfg.upiId || `tantra26.${ev.slug}@okhdfcbank`;
    const qrImage = deptCfg.qrImage;

    const numFee = (ev.fee || '').replace(/[^0-9.]/g, '') || '100';
    const payAmtVal = $('#pay-amount-val');
    if (payAmtVal) payAmtVal.textContent = ev.fee || ('₹' + numFee);
    const instrAmt = $('#instr-amount');
    if (instrAmt) instrAmt.textContent = ev.fee || ('₹' + numFee);
    const upiIdText = $('#upi-id-text');
    if (upiIdText) upiIdText.textContent = upiId;
    const payErr = $('#pay-err');
    if (payErr) payErr.textContent = '';
    const txnInp = $('#pay-txn-id');
    if (txnInp) txnInp.value = '';

    const canvas = $('#pay-qr');
    const qrImg  = $('#pay-qr-img');

    if (qrImage) {
      if (qrImg) {
        qrImg.src = qrImage;
        qrImg.style.display = 'block';
      }
      if (canvas) canvas.style.display = 'none';
    } else {
      if (qrImg) qrImg.style.display = 'none';
      if (canvas) {
        canvas.style.display = 'block';
        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Tantra%2026%20${encodeURIComponent(D[0])}&am=${numFee}&tn=${encodeURIComponent(ev.title)}&cu=INR`;
        QRCode.toCanvas(canvas, upiUrl, {
          width: 135,
          margin: 1,
          color: { dark: '#101a2d', light: '#ffffff' },
        }, (error) => {
          if (error) console.error('QR code generation error:', error);
        });
      }
    }

    const upiCopyBtn = $('#upi-copy-btn');
    if (upiCopyBtn) {
      upiCopyBtn.onclick = () => {
        navigator.clipboard.writeText(upiId).then(() => {
          upiCopyBtn.textContent = 'Copied! ✓';
          upiCopyBtn.classList.add('copied');
          setTimeout(() => {
            upiCopyBtn.textContent = 'Copy';
            upiCopyBtn.classList.remove('copied');
          }, 2000);
        });
      };
    }

    setTimeout(() => {
      if (txnInp) txnInp.focus();
    }, 300);
  }

  const payBackBtn = $('#pay-back-btn');
  if (payBackBtn) payBackBtn.onclick = () => { if (!isProcessing) setStep(1); };
  const payCancelBtn = $('#pay-cancel-btn');
  if (payCancelBtn) payCancelBtn.onclick = () => { if (!isProcessing) setStep(1); };

  if (payForm) {
    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isProcessing) return;
      const txnInput = $('#pay-txn-id');
      const payErr   = $('#pay-err');
      const txnId    = txnInput ? txnInput.value.trim() : '';

      if (!txnId) {
        if (payErr) payErr.textContent = 'Please paste the UPI Transaction ID / UTR number from your payment app.';
        if (txnInput) txnInput.focus();
        return;
      }
      if (txnId.length < 6) {
        if (payErr) payErr.textContent = 'Transaction ID / UTR must be at least 6 characters.';
        if (txnInput) txnInput.focus();
        return;
      }

      const cleanTxn = txnId.trim();
      const isTxnUsed = readLocalRegs().some((r) =>
        r.txnId &&
        r.txnId.toUpperCase() !== 'FREE-REGISTRATION' &&
        r.txnId.toLowerCase().trim() === cleanTxn.toLowerCase()
      );
      if (isTxnUsed) {
        if (payErr) payErr.textContent = 'This UPI Transaction ID / UTR number has already been used for another registration.';
        if (txnInput) txnInput.focus();
        return;
      }

      if (payErr) payErr.textContent = '';

      const payBtn = $('#pay-submit-btn');
      isProcessing = true;
      if (mx) mx.classList.add('disabled');
      if (payBackBtn) payBackBtn.style.pointerEvents = 'none';
      if (payCancelBtn) payCancelBtn.disabled = true;
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.innerHTML = '<span class="btn-spinner"></span> Verifying Transaction…';
      }

      try {
        await new Promise((r) => setTimeout(r, 1000));
        await finalizeRegistration(txnId);
      } catch (submitErr) {
        if (payErr) payErr.textContent = submitErr.message || 'Verification failed. Please try again.';
      } finally {
        isProcessing = false;
        if (mx) mx.classList.remove('disabled');
        if (payBackBtn) payBackBtn.style.pointerEvents = '';
        if (payCancelBtn) payCancelBtn.disabled = false;
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.innerHTML = 'Finish Transaction &rarr;';
        }
      }
    });
  }

  // Step 3: Finalize registration & slide to pass
  async function finalizeRegistration(txnId) {
    const payload = {
      dept_slug: ev.slug,
      event_id: ev.id,
      event_title: ev.title,
      fee: ev.fee || 'Free',
      name: curData.name,
      email: curData.email,
      phone: curData.phone,
      college: curData.college,
      team_members: curData.team || '',
      txn_id: txnId,
    };

    let passRegId = null;
    try {
      const res = await submitRegistration(payload);
      if (res && res.pass && res.pass.regId) {
        passRegId = res.pass.regId;
      }
    } catch (err) {
      if (err.message && (err.message.includes('already registered') || err.message.includes('already been used'))) {
        throw err;
      }
      console.warn('Backend note:', err.message);
    }

    const regId = passRegId || generatePassId(ev.slug || 'GEN');
    const rec = {
      slug:    ev.slug,
      dept:    D[0],
      eventId: ev.id,
      event:   ev.title,
      etype:   ev.type || 'Event',
      date:    ev.date || '7 Oct',
      time:    ev.time || '10:00 AM',
      venue:   ev.venue || 'Campus',
      fee:     ev.fee || 'Free',
      name:    curData.name,
      email:   curData.email,
      phone:   curData.phone,
      college: curData.college,
      team:    curData.team,
      txnId:   txnId,
      regId:   regId,
      regTime: new Date().toISOString(),
    };

    const list = readLocalRegs();
    list.unshift(rec);
    saveLocalRegs(list);
    try { localStorage.setItem('tantra26:last_user_name', curData.name); } catch (_) {}

    populatePass(rec);
    setStep(3);
    bar();
  }

  function populatePass(rec) {
    const ten = $('#ticket-event-name');
    if (ten) ten.textContent = ev.title;
    const tdt = $('#ticket-dept-tag');
    if (tdt) tdt.textContent = (ev.slug || 'T26').toUpperCase();
    const rid = $('#rid');
    if (rid) rid.textContent = rec.regId;
    const tn = $('#ticket-name');
    if (tn) tn.textContent = rec.name;
    const tc = $('#ticket-college');
    if (tc) tc.textContent = rec.college;
    const ta = $('#ticket-amount');
    if (ta) ta.textContent = rec.fee;
    const ttx = $('#ticket-txnid');
    if (ttx) ttx.textContent = rec.txnId;

    const okMsg = $('#ok-msg');
    if (okMsg) {
      okMsg.textContent = `Registered for ${ev.title} on ${ev.date} at ${ev.time} in ${ev.venue}.`;
    }
  }

  bar();
}
