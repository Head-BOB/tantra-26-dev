/**
 * organisers-login.js — Coordinator authentication for Tantra 26.
 * Matches 6-digit alphanumeric event passcodes and launches the event dashboard.
 */

import { getAllEvents } from '../data/all-events.js';
import { getEventAccessCode } from './access-code.js';
import { apiFetchEventByCode } from './api.js';

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
    mx = e.clientX / W - 0.5;
    my = e.clientY / H - 0.5;
  });

  function frame() {
    g.clearRect(0, 0, W, H);
    tx += (mx - tx) * 0.05;
    ty += (my - ty) * 0.05;
    stars.forEach(s => {
      s.y -= s.z * 0.16;
      if (s.y < -6) s.y = H + 6;
      s.t += 0.03;
      const x = (((s.x - tx * 50 * s.z) % W) + W) % W;
      const y = s.y - ty * 50 * s.z;
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

if (clearBtn) {
  clearBtn.onclick = () => {
    pwIn.value = '';
    pwIn.focus();
  };
}

if (pwIn) {
  pwIn.addEventListener('input', () => {
    pwIn.value = pwIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    errEl.textContent = '';
  });
}

function fail(msg) {
  errEl.textContent = msg;
  cardEl.classList.remove('shake');
  void cardEl.offsetWidth; // trigger reflow
  cardEl.classList.add('shake');
}

const DEPT_NAMES = {
  cse: 'Computer Science & Engineering',
  cscy: 'Cyber Security',
  ai: 'Artificial Intelligence & Data Science',
  csd: 'Computer Science & Design',
  csbs: 'Computer Science & Business Systems',
  eee: 'Electrical & Electronics Engineering',
  ece: 'Electronics & Communication Engineering',
  aei: 'Applied Electronics & Instrumentation',
  civil: 'Civil Engineering',
  mech: 'Mechanical Engineering',
};

function getDeptTitle(ev) {
  if (!ev) return 'Event';
  if (ev.dept && typeof ev.dept === 'string' && ev.dept.trim()) return ev.dept;
  const slug = (ev.dept_slug || ev.slug || '').toLowerCase();
  if (slug && DEPT_NAMES[slug]) return DEPT_NAMES[slug];
  if (slug) return slug.toUpperCase();
  return 'Event';
}

/**
 * Gather all events across all sources: static, admin local, and Supabase
 */
function gatherAllEvents() {
  const results = [];
  const seenIds = new Set();

  // 1. Admin local events
  try {
    const adminEvents = JSON.parse(localStorage.getItem(ADMIN_EV_KEY) || '{}');
    const deletedMap = JSON.parse(localStorage.getItem(DEL_EV_KEY) || '{}');

    Object.entries(adminEvents).forEach(([deptSlug, list]) => {
      const deleted = deletedMap[deptSlug] || [];
      if (Array.isArray(list)) {
        list.forEach(ev => {
          if (!deleted.includes(ev.id)) {
            const code = getEventAccessCode(ev);
            results.push({ ...ev, dept_slug: deptSlug, slug: ev.slug || deptSlug, accessCode: code });
            seenIds.add(ev.id);
          }
        });
      }
    });
  } catch {}

  // 2. Static events
  const staticEvents = getAllEvents();
  staticEvents.forEach(ev => {
    if (!seenIds.has(ev.id)) {
      const code = getEventAccessCode(ev);
      results.push({ ...ev, accessCode: code });
      seenIds.add(ev.id);
    }
  });

  return results;
}

// Clean URL if ?logout is present
if (/[?&]logout(=1)?/i.test(window.location.search)) {
  try {
    sessionStorage.removeItem(SESS_KEY);
  } catch {}
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

formEl.addEventListener('submit', async e => {
  e.preventDefault();
  errEl.textContent = '';
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
    const allEvents = gatherAllEvents();
    let matched = allEvents.find(ev => {
      const evCode = (ev.accessCode || getEventAccessCode(ev)).toUpperCase();
      return evCode === code;
    });

    // If not found in local memory or static files, fetch live from Supabase / Backend API
    if (!matched) {
      const cloudEvent = await apiFetchEventByCode(code);
      if (cloudEvent) {
        matched = cloudEvent;
      }
    }

    if (matched) {
      // Store session
      const sessionData = {
        event: matched,
        accessCode: code,
        loginTime: new Date().toISOString(),
      };
      sessionStorage.setItem(SESS_KEY, JSON.stringify(sessionData));

      // Take them directly to event dashboard immediately
      window.location.href = `/organiser-event.html?code=${encodeURIComponent(code)}`;
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
