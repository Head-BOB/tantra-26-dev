/**
 * organisers-login.js — Unified Organisers & Event Manager Controller for Tantra 26.
 * Manages 6-digit passcode authentication, sessions, and seamlessly renders
 * the event manager dashboard directly within /organisers without redirecting.
 */

import { getAllEvents } from '../data/all-events.js';
import { getEventAccessCode } from './access-code.js';
import { apiFetchEventByCode } from './api.js';
import { initDashboard } from './organiser-event-page.js';

const SESS_KEY = 'tantra26:organiser_session';
const ADMIN_EV_KEY = 'tantra26:admin:events';
const DEL_EV_KEY = 'tantra26:admin:deleted_events';

const $ = s => document.querySelector(s);

// ─── Canvas Starfield Animation ────────────────────────────────
const c = $('#sky');
if (c) {
  const g = c.getContext('2d');
  let W = innerWidth, H = innerHeight;
  let stars = [];
  let mx = 0, my = 0, tx = 0, ty = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const COLS = ['#efe8da', '#efe8da', '#b9c4de', '#e3a72f'];

  function size() {
    W = innerWidth;
    H = innerHeight;
    c.width = W * DPR;
    c.height = H * DPR;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    stars = [];
    const count = Math.round((W * H) / 5600);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: Math.random() * 0.9 + 0.1,
        t: Math.random() * 6,
        col: COLS[(Math.random() * COLS.length) | 0],
        big: Math.random() < 0.1,
      });
    }
  }

  size();
  window.addEventListener('resize', size);

  window.addEventListener('pointermove', e => {
    mx = (e.clientX / W - 0.5) * 1.4;
    my = (e.clientY / H - 0.5) * 1.4;
  });

  // Mobile Device Orientation Parallax (gyroscope / accelerometer)
  if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', e => {
      if (e.gamma !== null && e.beta !== null) {
        // gamma: left-right tilt [-90, 90]
        // beta: front-back tilt [-180, 180], phone normally held at ~40deg
        const tiltX = Math.max(-1, Math.min(1, e.gamma / 24));
        const tiltY = Math.max(-1, Math.min(1, (e.beta - 42) / 28));
        mx = tiltX * 1.3;
        my = tiltY * 1.3;
      }
    }, { passive: true });
  }

  // Mobile Touch Drag Parallax
  window.addEventListener('touchmove', e => {
    if (e.touches && e.touches[0]) {
      const t = e.touches[0];
      mx = (t.clientX / W - 0.5) * 1.5;
      my = (t.clientY / H - 0.5) * 1.5;
    }
  }, { passive: true });

  const logoNode = document.querySelector('.logo');
  const cardNode = document.getElementById('card');
  let idleTick = 0;

  function frame() {
    if (document.body.classList.contains('is-dashboard')) {
      requestAnimationFrame(frame);
      return;
    }
    g.clearRect(0, 0, W, H);

    idleTick += 0.014;
    const ambX = Math.sin(idleTick) * 0.12;
    const ambY = Math.cos(idleTick * 0.75) * 0.1;
    const targetX = mx + ambX;
    const targetY = my + ambY;

    tx += (targetX - tx) * 0.06;
    ty += (targetY - ty) * 0.06;

    stars.forEach(s => {
      s.y -= s.z * 0.16;
      if (s.y < -6) s.y = H + 6;
      s.t += 0.03;

      const px = tx * 75 * s.z;
      const py = ty * 55 * s.z;
      const x = (((s.x - px) % W) + W) % W;
      const y = (((s.y - py) % H) + H) % H;

      g.globalAlpha = (0.45 + 0.55 * Math.abs(Math.sin(s.t))) * (0.4 + s.z * 0.6);
      g.fillStyle = s.col;
      if (s.big) {
        const r = 2 + s.z * 3;
        g.fillRect(x - r, y - 0.6, r * 2, 1.2);
        g.fillRect(x - 0.6, y - r, 1.2, r * 2);
      } else {
        g.fillRect(x, y, s.z * 1.8, s.z * 1.8);
      }
    });

    // Subtle 3D multiplane depth for login card and logo on tilt
    if (logoNode && !logoNode.classList.contains('rise')) {
      logoNode.style.transform = `translate3d(${tx * -9}px, ${ty * -7}px, 0)`;
    }
    if (cardNode && !cardNode.classList.contains('shake')) {
      cardNode.style.transform = `translate3d(${tx * -5}px, ${ty * -4}px, 0)`;
    }

    requestAnimationFrame(frame);
  }
  frame();
}

// ─── Authentication Logic ──────────────────────────────────────
const pwIn = $('#pw');
const clearBtn = $('#eye');
const errEl = $('#err');
const cardEl = $('#card');
const formEl = $('#form');
const goBtn = $('#go');

if (clearBtn && pwIn) {
  clearBtn.onclick = () => {
    pwIn.value = '';
    pwIn.focus();
  };
}

if (pwIn) {
  pwIn.addEventListener('input', () => {
    pwIn.value = pwIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (errEl) errEl.textContent = '';
  });
}

function fail(msg) {
  if (errEl) errEl.textContent = msg;
  if (cardEl) {
    cardEl.classList.remove('shake');
    void cardEl.offsetWidth; // trigger reflow
    cardEl.classList.add('shake');
  }
}

/**
 * Gather all events across all sources: static, admin local, and Supabase
 */
function gatherAllEvents() {
  const results = [];
  const seenIds = new Set();

  const deletedMap = JSON.parse(localStorage.getItem(DEL_EV_KEY) || '{}');
  const globalDel = new Set(JSON.parse(localStorage.getItem('tantra26:deleted_events') || '[]'));
  Object.values(deletedMap).forEach(arr => {
    if (Array.isArray(arr)) arr.forEach(id => globalDel.add(id));
  });

  const isDeleted = (id) => !id || globalDel.has(id);

  // 1. Admin local events
  try {
    const adminEvents = JSON.parse(localStorage.getItem(ADMIN_EV_KEY) || '{}');
    Object.entries(adminEvents).forEach(([deptSlug, list]) => {
      if (Array.isArray(list)) {
        list.forEach(ev => {
          if (ev && ev.id && !isDeleted(ev.id) && ev.is_active !== false) {
            const code = (ev.accessCode || ev.access_code || getEventAccessCode(ev)).toUpperCase();
            results.push({ ...ev, dept_slug: deptSlug, slug: ev.slug || deptSlug, accessCode: code });
            seenIds.add(ev.id);
          }
        });
      }
    });
  } catch {}

  // 2. Organiser local edits
  try {
    const evMap = JSON.parse(localStorage.getItem('tantra26:events') || '{}');
    Object.values(evMap).forEach(ev => {
      if (ev && ev.id && !seenIds.has(ev.id) && !isDeleted(ev.id) && ev.is_active !== false) {
        const code = (ev.accessCode || ev.access_code || ev.code || getEventAccessCode(ev)).toUpperCase();
        results.push({ ...ev, accessCode: code });
        seenIds.add(ev.id);
      }
    });
  } catch {}

  // 3. Static catalog events
  const staticEvents = getAllEvents();
  staticEvents.forEach(ev => {
    if (ev && ev.id && !seenIds.has(ev.id) && !isDeleted(ev.id)) {
      const code = (ev.accessCode || ev.access_code || getEventAccessCode(ev)).toUpperCase();
      results.push({ ...ev, accessCode: code });
      seenIds.add(ev.id);
    }
  });

  return results;
}

// ─── View Switchers ───────────────────────────────────────────
function showLogin() {
  document.body.classList.remove('is-dashboard');
  const app = $('#app');
  if (app) app.hidden = true;
  const loginView = $('#login-view');
  if (loginView) loginView.hidden = false;
  if (pwIn) {
    pwIn.value = '';
    setTimeout(() => pwIn.focus(), 80);
  }
  if (errEl) errEl.textContent = '';
  if (goBtn) {
    goBtn.disabled = false;
    goBtn.classList.remove('busy');
    goBtn.textContent = 'Enter';
  }
}

function showDashboard(eventObj) {
  document.body.classList.add('is-dashboard');
  const loginView = $('#login-view');
  if (loginView) loginView.hidden = true;
  const app = $('#app');
  if (app) app.hidden = false;

  initDashboard(eventObj, () => {
    try { sessionStorage.removeItem(SESS_KEY); } catch {}
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', '/organisers');
    }
    showLogin();
  });
}

// ─── Page Bootstrap ───────────────────────────────────────────
async function init() {
  // Clear session if ?logout=1
  if (/[?&]logout(=1)?/i.test(window.location.search)) {
    try { sessionStorage.removeItem(SESS_KEY); } catch {}
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', '/organisers');
    }
    showLogin();
    return;
  }

  // Check code from URL or existing session
  let code = (new URLSearchParams(window.location.search).get('code') || '').trim().toUpperCase();
  if (!code) {
    try {
      const raw = sessionStorage.getItem(SESS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.accessCode) code = parsed.accessCode.trim().toUpperCase();
      }
    } catch {}
  }

  if (code && code.length === 6) {
    let matched = null;
    try {
      const cloudEv = await apiFetchEventByCode(code);
      if (cloudEv && cloudEv.is_active !== false && !cloudEv.is_deleted) {
        matched = cloudEv;
      }
    } catch {}

    if (!matched) {
      const allEvents = gatherAllEvents();
      matched = allEvents.find(ev => (ev.accessCode || getEventAccessCode(ev)).toUpperCase() === code);
    }

    if (matched) {
      showDashboard(matched);
      return;
    } else {
      showLogin();
      fail(`Passcode "${code}" was not found.`);
      return;
    }
  }

  showLogin();
}

init();

// ─── Passcode Submission ──────────────────────────────────────
if (formEl) {
  formEl.addEventListener('submit', async e => {
    e.preventDefault();
    if (errEl) errEl.textContent = '';
    const code = pwIn.value.trim().toUpperCase();

    if (!code) {
      return fail('Please enter your 6-digit event passcode.');
    }
    if (code.length !== 6) {
      return fail('Passcode must be exactly 6 characters.');
    }

    goBtn.disabled = true;
    goBtn.classList.add('busy');
    goBtn.textContent = 'Verifying…';

    try {
      // 1. Check live database first so renamed titles & updated fees always apply
      let matched = null;
      try {
        const cloudEvent = await apiFetchEventByCode(code);
        if (cloudEvent && cloudEvent.is_active !== false && !cloudEvent.is_deleted) {
          matched = cloudEvent;
        }
      } catch {}

      // 2. Fallback to local memory or static catalog
      if (!matched) {
        const allEvents = gatherAllEvents();
        matched = allEvents.find(ev => {
          const evCode = (ev.accessCode || getEventAccessCode(ev)).toUpperCase();
          return evCode === code;
        });
      }

      if (matched) {
        // Store event locally
        try {
          const store = JSON.parse(localStorage.getItem('tantra26:events') || '{}');
          store[(matched.slug || matched.dept_slug) + ':' + matched.id] = matched;
          localStorage.setItem('tantra26:events', JSON.stringify(store));
        } catch {}

        // Store session
        const sessionData = {
          event: matched,
          accessCode: code,
          loginTime: new Date().toISOString(),
        };
        sessionStorage.setItem(SESS_KEY, JSON.stringify(sessionData));

        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, '', `/organisers?code=${encodeURIComponent(code)}`);
        }

        showDashboard(matched);
        return;
      }

      // No match
      goBtn.disabled = false;
      goBtn.classList.remove('busy');
      goBtn.textContent = 'Enter';
      pwIn.select();
      fail('Invalid passcode. Check with your department admin.');
    } catch (err) {
      goBtn.disabled = false;
      goBtn.classList.remove('busy');
      goBtn.textContent = 'Enter';
      fail('Verification error. Please try again.');
    }
  });
}
