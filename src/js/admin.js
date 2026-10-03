/**
 * admin.js — Tantra 26 Admin Dashboard logic.
 * Supports:
 *   1. Independent Department Logins (password puts user directly into their dept)
 *   2. Super Admin Central Panel (Payment QR upload per dept & Master registrations)
 *   3. Excel (.xlsx) Export for department and master registrations
 *   4. Styled Date & Time pickers with quick chips
 *   5. Clean brutalist aesthetics without generic emojis
 */

import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import {
  adminLogin,
  fetchAdminRegistrations,
  apiSaveEvent,
  apiDeleteEvent,
  apiSaveCoord,
  apiDeleteCoord,
  apiSyncDeptCoords,
  fetchDeptCoords,
  fetchDeptEvents,
  apiSavePayment,
  fetchAllDeptPayments,
  sanitizePersonalRegistrations,
  apiSetEventFeatured,
  apiFetchSpecialAttractions,
} from './api.js';
import { generateRandomCode, generateUniqueAccessCode, getEventAccessCode } from './access-code.js';
import { SlopGuard } from './slop-guard.js';

import { EVENTS as CSE_EV }   from '../data/events/cse.js';
import { EVENTS as CSCY_EV }  from '../data/events/cscy.js';
import { EVENTS as AI_EV }    from '../data/events/ai.js';
import { EVENTS as CSD_EV }   from '../data/events/csd.js';
import { EVENTS as CSBS_EV }  from '../data/events/csbs.js';
import { EVENTS as EEE_EV }   from '../data/events/eee.js';
import { EVENTS as ECE_EV }   from '../data/events/ece.js';
import { EVENTS as AEI_EV }   from '../data/events/aei.js';
import { EVENTS as CIVIL_EV } from '../data/events/civil.js';
import { EVENTS as MECH_EV }  from '../data/events/mech.js';

import { CONFIG as CSE_CFG }   from '../data/events/cse.js';
import { CONFIG as CSCY_CFG }  from '../data/events/cscy.js';
import { CONFIG as AI_CFG }    from '../data/events/ai.js';
import { CONFIG as CSD_CFG }   from '../data/events/csd.js';
import { CONFIG as CSBS_CFG }  from '../data/events/csbs.js';
import { CONFIG as EEE_CFG }   from '../data/events/eee.js';
import { CONFIG as ECE_CFG }   from '../data/events/ece.js';
import { CONFIG as AEI_CFG }   from '../data/events/aei.js';
import { CONFIG as CIVIL_CFG } from '../data/events/civil.js';
import { CONFIG as MECH_CFG }  from '../data/events/mech.js';

// ─── Mathematical & Greek Symbols Support ─────────────────────
export function expandMathShortcuts(str) {
  if (!str) return '';
  return str
    .replace(/\b(m|mu)learn\b/gi, 'µLearn')
    .replace(/\b(m|mu)-learn\b/gi, 'µLearn')
    .replace(/\\mu|&mu;|&micro;/gi, 'µ')
    .replace(/\\pi|&pi;/gi, 'π')
    .replace(/\\omega|&omega;/gi, 'ω')
    .replace(/\\ohm|\\Omega|&Omega;/gi, 'Ω')
    .replace(/\\lambda|&lambda;/gi, 'λ')
    .replace(/\\theta|&theta;/gi, 'θ')
    .replace(/\\alpha|&alpha;/gi, 'α')
    .replace(/\\beta|&beta;/gi, 'β')
    .replace(/\\gamma|&gamma;/gi, 'γ')
    .replace(/\\delta|&delta;/gi, 'δ')
    .replace(/\\Delta|&Delta;/gi, 'Δ')
    .replace(/\\sigma|&sigma;/gi, 'σ')
    .replace(/\\Sigma|&Sigma;/gi, 'Σ')
    .replace(/\\sum/gi, '∑')
    .replace(/\\infty|&infin;/gi, '∞')
    .replace(/\\approx|&asymp;/gi, '≈')
    .replace(/\\neq|\\ne\b|&ne;/gi, '≠')
    .replace(/\\pm|&plusmn;/gi, '±')
    .replace(/\\times|&times;/gi, '×')
    .replace(/\\sqrt|&radic;/gi, '√')
    .replace(/\\deg|&deg;/gi, '°');
}

export function matchEventTitle(t1, t2) {
  if (!t1 || !t2) return false;
  const s1 = String(t1).trim().toLowerCase();
  const s2 = String(t2).trim().toLowerCase();
  if (s1 === s2) return true;
  const k1 = s1.replace(/[µμ]/g, 'mu').replace(/[^\p{L}\p{N}]/gu, '');
  const k2 = s2.replace(/[µμ]/g, 'mu').replace(/[^\p{L}\p{N}]/gu, '');
  return Boolean(k1 && k1 === k2);
}

export function formatTitleSpan(text) {
  const symRe = /([µμΩωπΠλΛθΘαβγδΔσΣ∞≈≠≤≥±√∫°])/g;
  return esc(text).replace(symRe, '<span class="sym" style="text-transform:none !important;font-family:\'Inter\',system-ui,sans-serif !important;display:inline-block;font-weight:700;">$1</span>');
}

export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const s = url.trim();
  if (!s || s === 'null' || s === 'undefined' || s === '[object Object]' || s === '{}' || s === 'none') return false;
  return s.startsWith('data:image/') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/') || s.startsWith('./');
}

// ─── Password & Role Mapping ───────────────────────────────────
// No usernames required — entering password immediately routes user
const AUTH_MAP = {
  // Super Admin (Central Admin)
  'u9rcDp': { role: 'superadmin', name: 'Central Admin' },

  // Computer Science & Engineering
  'zWHCaX': { role: 'dept_admin', dept: 'cse', name: 'Computer Science & Engineering' },

  // Cyber Security
  'kY8sNw': { role: 'dept_admin', dept: 'cscy', name: 'Cyber Security' },

  // Artificial Intelligence & Data Science
  'MhFbxq': { role: 'dept_admin', dept: 'ai', name: 'Artificial Intelligence & Data Science' },

  // Computer Science & Design
  'gsGL3t': { role: 'dept_admin', dept: 'csd', name: 'Computer Science & Design' },

  // Computer Science & Business Systems
  'p6kjHf': { role: 'dept_admin', dept: 'csbs', name: 'Computer Science & Business Systems' },

  // Electrical & Electronics Engineering
  'RQKRk2': { role: 'dept_admin', dept: 'eee', name: 'Electrical & Electronics Engineering' },

  // Electronics & Communication Engineering
  'BXJ8eu': { role: 'dept_admin', dept: 'ece', name: 'Electronics & Communication Engineering' },

  // Applied Electronics & Instrumentation
  'fRLYKh': { role: 'dept_admin', dept: 'aei', name: 'Applied Electronics & Instrumentation' },

  // Civil Engineering
  'F5TwfY': { role: 'dept_admin', dept: 'civil', name: 'Civil Engineering' },

  // Mechanical Engineering
  'zEzU6v': { role: 'dept_admin', dept: 'mech', name: 'Mechanical Engineering' },
};

const DEPTS = [
  { slug: 'cse',   name: 'Computer Science & Engineering',         color: '#2b6a4d', fg: '#efe8da' },
  { slug: 'cscy',  name: 'Computer Science and Cyber Security',     color: '#141414', fg: '#efe8da' },
  { slug: 'ai',    name: 'Artificial Intelligence & Data Science',  color: '#c23b22', fg: '#efe8da' },
  { slug: 'csd',   name: 'Computer Science & Design',              color: '#e3a72f', fg: '#141414' },
  { slug: 'csbs',  name: 'Computer Science & Business Systems',     color: '#182338', fg: '#efe8da' },
  { slug: 'eee',   name: 'Electrical & Electronics Engineering',    color: '#efe8da', fg: '#141414' },
  { slug: 'ece',   name: 'Electronics & Communication Engineering', color: '#c23b22', fg: '#efe8da' },
  { slug: 'aei',   name: 'Applied Electronics & Instrumentation',   color: '#2b6a4d', fg: '#efe8da' },
  { slug: 'civil', name: 'Civil Engineering',                      color: '#e3a72f', fg: '#141414' },
  { slug: 'mech',  name: 'Mechanical Engineering',                 color: '#243a5e', fg: '#efe8da' },
];

const STATIC_EVENTS = {
  cse: CSE_EV, cscy: CSCY_EV, ai: AI_EV, csd: CSD_EV, csbs: CSBS_EV, eee: EEE_EV, ece: ECE_EV, aei: AEI_EV, civil: CIVIL_EV, mech: MECH_EV,
};
const STATIC_COORDS = {
  cse: CSE_CFG.coordinators, cscy: CSCY_CFG.coordinators, ai: AI_CFG.coordinators, csd: CSD_CFG.coordinators, csbs: CSBS_CFG.coordinators,
  eee: EEE_CFG.coordinators, ece: ECE_CFG.coordinators, aei: AEI_CFG.coordinators, civil: CIVIL_CFG.coordinators, mech: MECH_CFG.coordinators,
};

// ─── Storage helpers ───────────────────────────────────────────
const EV_KEY         = 'tantra26:admin:events';
const DEL_EV_KEY     = 'tantra26:admin:deleted_events';
const CO_KEY         = 'tantra26:admin:coords';
const SESS_KEY       = 'tantra26:admin:session_user';
const ADMIN_REGS_KEY = 'tantra26:admin:registrations';
const DEPT_PAY_KEY   = 'tantra26:admin:dept_payment';

const load = (k, fb = {}) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fb; } catch { return fb; } };
const save = (k, v)        => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function getAdminEvents() { return load(EV_KEY, {}); }
function setAdminEvents(d) { save(EV_KEY, d); }
function getDeletedEvents() { return load(DEL_EV_KEY, {}); }
function setDeletedEvents(d) { save(DEL_EV_KEY, d); }
function getAdminCoords() { return load(CO_KEY, {}); }
function setAdminCoords(d) { save(CO_KEY, d); }
function getAllRegistrations() { return load(ADMIN_REGS_KEY, []); }
function getDeptPayments() { return load(DEPT_PAY_KEY, {}); }
function setDeptPayments(d) { save(DEPT_PAY_KEY, d); }

function allEventsFor(slug) {
  const admin = getAdminEvents()[slug] || [];
  const deleted = getDeletedEvents()[slug] || [];

  if (admin.length > 0) {
    return admin
      .filter(a => !deleted.includes(a.id))
      .map(e => {
        const ev = { ...e, date: '7 Oct', _source: 'admin' };
        return { ...ev, accessCode: e.accessCode || e.access_code || getEventAccessCode(ev) };
      });
  }

  return [];
}
function allCoordsFor(slug) {
  const stored = getAdminCoords()[slug];
  return stored ?? [...(STATIC_COORDS[slug] || [])];
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── State ────────────────────────────────────────────────────
let currentUser = null; // { role: 'superadmin'|'dept_admin', dept?: string, name: string }
let activeDept = null;
let currentView = 'events'; // 'events' | 'regs' | 'central-qrs' | 'central-regs'
let editingEventId = null;
let editingCoordIdx = null;
let pendingDeleteId = null;
let pendingDeleteType = null; // 'event' | 'coord'

// ─── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const gate        = $('gate');
const app         = $('app');
const deptNav     = $('dept-nav');
const mainTitle   = $('main-title');
const mainEyebrow = $('main-eyebrow');
const addBtn      = $('add-btn');
const statsRow    = $('stats-row');
const eventsList  = $('events-list');
const emptyState  = $('empty-state');

// Modals
const eventModal  = $('event-modal');
const eventForm   = $('event-form');
const delModal    = $('del-modal');
const coordModal  = $('coord-modal');

// ─── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast-msg ${type}`;
  t.textContent = msg;
  $('toast').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ─── Initialization ───────────────────────────────────────────
export function initAdmin() {
  const storedSess = sessionStorage.getItem(SESS_KEY);
  if (storedSess) {
    try {
      currentUser = JSON.parse(storedSess);
      showApp();
      return;
    } catch {}
  }
  showGate();
}

function showGate() {
  gate.hidden = false;
  app.hidden  = true;
  const form = $('gate-form');
  const err  = $('gate-err');
  const pwIn = $('gate-pw');

  form.onsubmit = async e => {
    e.preventDefault();
    const pw = pwIn.value.trim();
    
    // 1. Try backend API login
    const apiRes = await adminLogin(pw);
    if (apiRes && apiRes.user) {
      currentUser = apiRes.user;
      sessionStorage.setItem(SESS_KEY, JSON.stringify(currentUser));
      showApp();
      return;
    }

    // 2. Fallback to client auth map
    const auth = AUTH_MAP[pw];
    if (auth) {
      currentUser = auth;
      sessionStorage.setItem(SESS_KEY, JSON.stringify(auth));
      showApp();
    } else {
      err.textContent = 'Incorrect password. Please verify your department code or admin password.';
      pwIn.value = '';
      pwIn.focus();
    }
  };
}

function showApp() {
  gate.hidden = true;
  app.hidden  = false;

  $('central-admin-nav').hidden = currentUser.role !== 'superadmin';

  buildSidebar();
  bindTopbar();
  bindViewTabs();
  bindEventModal();
  bindDeleteModal();
  bindCoordModal();
  bindExcelModal();
  bindRegistrationsView();
  bindCentralAdminViews();
  bindPosterModal();

  // If department admin, immediately select their department
  if (currentUser.role === 'dept_admin') {
    selectDept(currentUser.dept);
  } else {
    selectDept(DEPTS[0].slug);
  }

  // Immediately pull live registrations from Supabase and sanitize personal tickets
  try { sanitizePersonalRegistrations(); } catch {}
  syncLiveRegistrations();

  // Load cloud payment configs for all departments
  fetchAllDeptPayments().then(cloudPayments => {
    if (cloudPayments && Array.isArray(cloudPayments) && cloudPayments.length > 0) {
      const pStore = getDeptPayments();
      cloudPayments.forEach(p => {
        pStore[p.dept_slug] = {
          upiId: p.upi_id,
          qrImage: p.qr_image_url,
        };
      });
      setDeptPayments(pStore);
      if (currentView === 'central-qrs') renderCentralQRs();
    }
  }).catch(() => {});

  // Sync all departments from cloud in background to populate badges
  DEPTS.forEach(d => syncDeptDataFromCloud(d.slug));
  syncCentralPostersFromCloud();
}

// ─── Sidebar ─────────────────────────────────────────────────
function buildSidebar() {
  deptNav.innerHTML = '';

  // If department admin, only display their own department!
  const visibleDepts = currentUser.role === 'dept_admin'
    ? DEPTS.filter(d => d.slug === currentUser.dept)
    : DEPTS;

  $('sidebar-dept-label').textContent = currentUser.role === 'dept_admin'
    ? 'My Department'
    : 'Departments';

  visibleDepts.forEach(d => {
    const count = allEventsFor(d.slug).length;
    const btn = document.createElement('button');
    btn.className = 'dept-btn';
    btn.dataset.slug = d.slug;
    btn.innerHTML = `<span>${d.name}</span><span class="badge">${count}</span>`;
    btn.onclick = () => selectDept(d.slug);
    deptNav.appendChild(btn);
  });
}

function refreshSidebar() {
  [...deptNav.querySelectorAll('.dept-btn')].forEach(btn => {
    const count = allEventsFor(btn.dataset.slug).length;
    const badge = btn.querySelector('.badge');
    if (badge) badge.textContent = count;
    btn.classList.toggle('active', btn.dataset.slug === activeDept && !['central-qrs', 'central-regs', 'central-featured', 'central-posters'].includes(currentView));
  });

  // Central buttons active states
  $('nav-central-qrs').classList.toggle('active', currentView === 'central-qrs');
  $('nav-central-regs').classList.toggle('active', currentView === 'central-regs');
  if ($('nav-central-featured')) $('nav-central-featured').classList.toggle('active', currentView === 'central-featured');
  if ($('nav-central-posters')) $('nav-central-posters').classList.toggle('active', currentView === 'central-posters');

  updateRegsBadge();
}

function updateRegsBadge() {
  const allRegs = getAllRegistrations();
  const deptCount = activeDept ? allRegs.filter(r => r.slug === activeDept).length : 0;
  $('regs-badge').textContent = deptCount;
  $('central-regs-badge').textContent = allRegs.length;

  if ($('central-featured-badge')) {
    const featCount = getAllFeaturedCandidateEvents().filter(e => e.is_featured).length;
    $('central-featured-badge').textContent = featCount > 0 ? featCount : '★';
  }

  if ($('central-posters-badge')) {
    const posterCount = typeof getAllShowcasePosters === 'function' ? getAllShowcasePosters().length : 0;
    $('central-posters-badge').textContent = posterCount > 0 ? posterCount : 'Ad';
  }
}

// ─── Navigation & Views ───────────────────────────────────────
function bindViewTabs() {
  const tabEvs  = $('tab-events');
  const tabRegs = $('tab-regs');

  tabEvs.onclick = () => switchDeptSubView('events');
  tabRegs.onclick = () => switchDeptSubView('regs');
}

function switchDeptSubView(view) {
  currentView = view;
  hideAllViews();

  $('main-header').hidden = false;
  $('tab-events').classList.toggle('active', view === 'events');
  $('tab-regs').classList.toggle('active', view === 'regs');

  if (view === 'events') {
    $('view-events-content').hidden = false;
    addBtn.hidden = false;
  } else if (view === 'regs') {
    $('view-regs-content').hidden = false;
    addBtn.hidden = true;
    renderDeptRegistrations();
  }
  refreshSidebar();
}

function hideAllViews() {
  $('view-events-content').hidden = true;
  $('view-regs-content').hidden   = true;
  $('view-central-qrs').hidden    = true;
  $('view-central-regs').hidden   = true;
  if ($('view-central-featured')) $('view-central-featured').hidden = true;
  if ($('view-central-posters')) $('view-central-posters').hidden = true;
}

function selectDept(slug) {
  // If department admin, protect against switching
  if (currentUser.role === 'dept_admin' && slug !== currentUser.dept) {
    slug = currentUser.dept;
  }

  activeDept = slug;
  const dept = DEPTS.find(d => d.slug === slug);
  mainEyebrow.textContent = 'Tantra 26 · Department of';
  mainTitle.textContent   = dept.name;

  $('main-header').hidden = false;
  if (!['events', 'regs'].includes(currentView)) {
    currentView = 'events';
  }

  switchDeptSubView(currentView);

  renderStats(slug);
  renderCoords(slug);
  renderEvents(slug);
  refreshSidebar();

  // Sync latest coordinators and events from Supabase in background
  syncDeptDataFromCloud(slug);
}

async function syncDeptDataFromCloud(slug) {
  try {
    const [cloudCoords, cloudEvents] = await Promise.all([
      fetchDeptCoords(slug),
      fetchDeptEvents(slug),
    ]);

    if (cloudCoords && Array.isArray(cloudCoords) && cloudCoords.length > 0) {
      const store = getAdminCoords();
      store[slug] = cloudCoords.map(c => ({ name: c.name, phone: c.phone }));
      setAdminCoords(store);
      if (activeDept === slug) {
        renderCoords(slug);
      }
    }

    if (cloudEvents && Array.isArray(cloudEvents) && cloudEvents.length > 0) {
      const evStore = getAdminEvents();
      evStore[slug] = cloudEvents.map(e => ({
        id: e.id,
        type: e.type,
        title: e.title,
        date: '7 Oct',
        time: e.time,
        venue: e.venue,
        team: e.team_size || e.team || 1,
        fee: e.fee,
        desc: e.description || e.desc || '',
        details: e.details || '',
        banner: (typeof e.banner === 'string' && e.banner.startsWith('data:')) ? '' : (e.banner || ''),
        banners: (e.banners && typeof e.banners === 'object') ? Object.fromEntries(Object.entries(e.banners).filter(([_, v]) => typeof v === 'string' && !v.startsWith('data:'))) : {},
        is_featured: Boolean(e.is_featured),
        featured_order: parseInt(e.featured_order, 10) || 1,
        prizes: e.prizes || [],
        prize_pool: e.prize_pool || '',
        steps: e.steps || [],
        rules: e.rules || [],
        coord: e.coord || {},
        accessCode: e.accessCode || e.access_code || '',
        _source: 'admin',
      }));
      setAdminEvents(evStore);

      // Track any static events absent from cloudEvents as deleted
      const cloudIds = new Set(cloudEvents.map(e => e.id));
      const delStore = getDeletedEvents();
      const staticDeletions = (STATIC_EVENTS[slug] || [])
        .filter(se => !cloudIds.has(se.id))
        .map(se => se.id);
      delStore[slug] = staticDeletions;
      setDeletedEvents(delStore);

      if (activeDept === slug) {
        renderStats(slug);
        renderEvents(slug);
        refreshSidebar();
      }
    }
  } catch (err) {
    console.warn('Could not sync dept data from cloud:', err);
  }
}

// ─── Department Stats ─────────────────────────────────────────
function renderStats(slug) {
  const evs = allEventsFor(slug);
  const byType = {};
  evs.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });

  statsRow.innerHTML = [
    { n: evs.length, l: 'Total Events' },
    ...Object.entries(byType).map(([t, n]) => ({ n, l: t + 's' })),
  ].map(({ n, l }) => `
    <div class="stat-card">
      <span class="stat-n">${String(n).padStart(2, '0')}</span>
      <span class="stat-l">${l}</span>
    </div>
  `).join('');
}

// ─── Coordinators / Organisers ─────────────────────────────────
function renderCoords(slug) {
  let old = document.querySelector('.coord-section');
  if (old) old.remove();

  const section = document.createElement('div');
  section.className = 'coord-section';

  const header = document.createElement('div');
  header.className = 'section-title';
  header.innerHTML = `<span>Organisers &amp; Coordinators</span>
    <button class="add-small-btn" id="add-coord-btn">+ Add Organiser</button>`;
  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'coord-grid';
  grid.id = 'coord-grid';

  const coords = allCoordsFor(slug);
  if (coords.length === 0) {
    grid.innerHTML = `<p style="color:rgba(239,232,218,.35);font-size:.88rem;">No organisers added yet.</p>`;
  } else {
    coords.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'coord-card';
      card.innerHTML = `
        <div class="coord-info">
          <div class="coord-name">${esc(c.name)}</div>
          <div class="coord-phone">${esc(c.phone)}</div>
        </div>
        <div class="coord-actions">
          <button type="button" class="coord-btn edit" title="Edit organiser" data-ci="${i}">Edit</button>
          <button type="button" class="coord-btn del" title="Delete organiser" data-ci="${i}">Delete</button>
        </div>`;
      card.querySelector('.coord-btn.edit').onclick = () => openCoordModal(i);
      card.querySelector('.coord-btn.del').onclick  = () => confirmDelete('coord', i, c.name);
      grid.appendChild(card);
    });
  }

  section.appendChild(grid);
  $('view-events-content').insertBefore(section, eventsList);
  document.getElementById('add-coord-btn').onclick = () => openCoordModal(null);
}

// ─── Department Events List ───────────────────────────────────
function renderEvents(slug) {
  const evs = allEventsFor(slug);
  eventsList.innerHTML = '';

  if (evs.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const dept = DEPTS.find(d => d.slug === slug);

  evs.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'ev-admin';
    card.style.cssText = `--acc:${dept.color};--accfg:${dept.fg}`;

    card.innerHTML = `
      <div class="ev-admin-top">
        <div class="ev-admin-top-left">
          <span class="ev-type">${esc(ev.type)}</span>
          <span class="ev-source ${ev._source}">${ev._source}</span>
        </div>
        <span class="ev-fee">${esc(ev.fee)}</span>
      </div>
      <div class="ev-admin-body">
        <h3>${formatTitleSpan(expandMathShortcuts(ev.title))}</h3>
        <p class="ev-desc">${esc(ev.desc)}</p>
        <dl class="ev-meta">
          <dt>When</dt><dd>${esc(ev.date || '7 Oct')} · ${esc(ev.time)}</dd>
          <dt>Where</dt><dd>${esc(ev.venue)}</dd>
          <dt>Team</dt><dd>${ev.team > 1 ? 'Up to ' + ev.team : 'Individual'}</dd>
        </dl>
        <div class="ev-code-banner">
          <div>
            <span class="ev-code-lbl">Organiser Code</span>
            <code class="ev-code-val">${esc(ev.accessCode)}</code>
          </div>
          <button type="button" class="ev-code-copy" data-code="${esc(ev.accessCode)}" title="Copy code for event coordinators">Copy</button>
        </div>
      </div>
      <div class="ev-admin-footer">
        <button class="ev-edit-btn" title="Edit event details">Edit</button>
        <button class="ev-del-btn" title="Delete event">Delete</button>
      </div>`;

    card.querySelector('.ev-edit-btn').onclick = () => openEventModal(ev.id);
    card.querySelector('.ev-del-btn').onclick  = () => confirmDelete('event', ev.id, ev.title);
    const copyBtn = card.querySelector('.ev-code-copy');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(ev.accessCode).then(() => {
          toast(`Organiser Code ${ev.accessCode} copied! Give this to event coordinators ✓`);
        }).catch(() => {
          prompt('Organiser Access Code:', ev.accessCode);
        });
      };
    }
    eventsList.appendChild(card);
  });
}

// ─── Event Modal (Hardcoded 7 Oct Fest Date & Clean Time) ─────
function updateEventDescCounter() {
  const cnt = $('em-desc-count');
  if (!cnt || !eventForm || !eventForm.desc) return;
  const len = eventForm.desc.value.length;
  cnt.textContent = `${len} / 120`;
  cnt.style.color = len >= 120 ? 'var(--red, #c23b22)' : 'rgba(239,232,218,0.6)';
}

function bindEventModal() {
  $('em-close').onclick = closeEventModal;
  $('em-cancel').onclick = closeEventModal;
  const regenBtn = $('em-regen-code');
  if (regenBtn) {
    regenBtn.onclick = () => {
      if (eventForm.accessCode) {
        eventForm.accessCode.value = generateRandomCode();
        toast('New 6-digit passcode generated ✓', 'info');
      }
    };
  }
  eventModal.addEventListener('click', e => { if (e.target === eventModal) closeEventModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && eventModal.classList.contains('open')) closeEventModal(); });
  addBtn.onclick = () => openEventModal(null);

  if (eventForm.desc) {
    eventForm.desc.addEventListener('input', updateEventDescCounter);
  }

  if (eventForm.title) {
    eventForm.title.addEventListener('input', () => {
      const orig = eventForm.title.value;
      const converted = expandMathShortcuts(orig);
      if (converted !== orig) {
        const start = eventForm.title.selectionStart;
        const diff = converted.length - orig.length;
        eventForm.title.value = converted;
        try {
          eventForm.title.setSelectionRange(start + diff, start + diff);
        } catch {}
      }
    });
  }

  eventForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!SlopGuard.check(eventForm)) return;
    const f = eventForm;
    const err = $('em-err');
    const rawCode = (f.accessCode ? f.accessCode.value.trim() : '') || generateUniqueAccessCode();
    const accessCode = rawCode.toUpperCase();
    const title = expandMathShortcuts(f.title.value.trim());
    const desc = f.desc.value.trim();

    if (desc.length > 120) {
      err.textContent = 'Preview description cannot exceed 120 characters.';
      f.desc.focus();
      return;
    }

    const duration = parseInt(f.duration ? f.duration.value : 120, 10);
    if (isNaN(duration) || duration < 10) {
      err.textContent = 'Event duration must be at least 10 minutes.';
      if (f.duration) f.duration.focus();
      return;
    }

    const data = {
      title,
      type:  f.type.value,
      fee:   f.fee.value.trim(),
      date:  '7 Oct', // Fest date is strictly October 7
      time:  f.time.value.trim(),
      duration,
      venue: f.venue.value.trim(),
      team:  parseInt(f.team.value) || 1,
      desc:  desc.slice(0, 120),
      accessCode,
    };
    if (!data.title || !data.fee || !data.time || !data.venue || !data.desc) {
      err.textContent = 'Please fill in all required fields.';
      return;
    }
    if (accessCode.length !== 6) {
      err.textContent = 'Organiser access code must be exactly 6 characters.';
      return;
    }

    const store = getAdminEvents();
    const slug  = activeDept;
    if (!store[slug]) store[slug] = [];

    const finalId = editingEventId || uid();

    // Verify access code is globally unique
    let codeDuplicate = false;
    let dupEventTitle = '';
    for (const [deptKey, evList] of Object.entries(store)) {
      if (Array.isArray(evList)) {
        for (const evItem of evList) {
          if (evItem.id !== finalId) {
            const existingCode = (evItem.accessCode || evItem.access_code || getEventAccessCode(evItem) || '').toUpperCase();
            if (existingCode === accessCode) {
              codeDuplicate = true;
              dupEventTitle = evItem.title;
              break;
            }
          }
        }
      }
      if (codeDuplicate) break;
    }
    if (codeDuplicate) {
      err.textContent = `Access code "${accessCode}" is already in use by "${dupEventTitle}". Please generate a unique code.`;
      return;
    }
    err.textContent = '';
    if (editingEventId) {
      const idx = store[slug].findIndex(e => e.id === editingEventId);
      if (idx !== -1) {
        store[slug][idx] = { ...store[slug][idx], ...data, id: editingEventId };
      } else {
        // Was a default event being updated
        store[slug].push({ id: editingEventId, ...data, _created: new Date().toISOString() });
      }
      toast('Event updated ✓');
    } else {
      store[slug].push({ id: finalId, ...data, _created: new Date().toISOString() });
      toast('Event added ✓');
    }

    setAdminEvents(store);

    closeEventModal();
    refreshSidebar();
    renderStats(slug);
    renderEvents(slug);

    // Sync with backend API & Supabase
    const fullSavedEv = store[slug].find(e => e.id === finalId) || { ...data, dept_slug: slug, id: finalId };
    apiSaveEvent({ ...fullSavedEv, dept_slug: slug, id: finalId }, !!editingEventId).then(res => {
      if (res) toast('Saved & synced to cloud ✓', 'info');
    }).catch(err => {
      console.error('Failed to sync event to cloud:', err);
    });
  });
}

function openEventModal(id) {
  editingEventId = id;
  const f = eventForm;
  f.reset();
  $('em-err').textContent = '';

  if (id) {
    $('em-mode').textContent  = 'Edit Event';
    $('em-title').textContent = 'Edit Event';
    const ev = allEventsFor(activeDept).find(e => e.id === id);
    if (ev) {
      f.title.value = ev.title || '';
      f.type.value  = ev.type || 'Competition';
      f.fee.value   = ev.fee || '';
      f.date.value  = '7 Oct';
      f.time.value  = ev.time || '10:00 AM';
      if (f.duration) f.duration.value = Math.max(10, parseInt(ev.duration, 10) || 120);
      const v = (ev.venue || '').trim();
      f.venue.value = (v === '--' || v === '-') ? '' : v;
      f.team.value  = ev.team || 1;
      f.desc.value  = ev.desc || '';
      if (f.accessCode) f.accessCode.value = ev.accessCode || getEventAccessCode(ev);
    }
  } else {
    $('em-mode').textContent  = 'Add Event';
    $('em-title').textContent = 'New Event';
    f.date.value = '7 Oct';
    f.time.value = '10:00 AM';
    if (f.duration) f.duration.value = 120;
    if (f.accessCode) f.accessCode.value = generateUniqueAccessCode();
  }

  updateEventDescCounter();
  eventModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => f.title.focus(), 60);
}

function closeEventModal() {
  eventModal.classList.remove('open');
  document.body.style.overflow = '';
  editingEventId = null;
}

// ─── Coordinator modal ────────────────────────────────────────
function bindCoordModal() {
  $('cm-close').onclick  = closeCoordModal;
  $('cm-cancel').onclick = closeCoordModal;
  coordModal.addEventListener('click', e => { if (e.target === coordModal) closeCoordModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && coordModal.classList.contains('open')) closeCoordModal(); });

  $('coord-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!SlopGuard.check($('coord-form'))) return;
    const name  = $('cm-name').value.trim();
    const phone = $('cm-phone').value.trim();
    if (!name || !phone) { $('cm-err').textContent = 'Please fill in both fields.'; return; }
    const rawP = phone.replace(/\D/g, '');
    const cleanPhone = (rawP.length > 10 && (rawP.startsWith('91') || rawP.startsWith('0'))) ? rawP.slice(-10) : rawP;
    if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      $('cm-err').textContent = 'Enter a valid 10-digit mobile number (e.g. 9876543210).';
      return;
    }
    $('cm-err').textContent = '';

    const store = getAdminCoords();
    const slug  = activeDept;
    const currentList = [...allCoordsFor(slug)];

    if (editingCoordIdx !== null && editingCoordIdx >= 0 && editingCoordIdx < currentList.length) {
      currentList[editingCoordIdx] = { name, phone };
      toast('Coordinator updated ✓');
    } else {
      currentList.push({ name, phone });
      toast('Coordinator added ✓');
    }

    store[slug] = currentList;
    setAdminCoords(store);
    closeCoordModal();
    renderCoords(slug);

    // Sync full department list to Supabase
    apiSyncDeptCoords(slug, currentList).then(ok => {
      if (ok) toast('Synced to cloud ✓', 'info');
    }).catch(err => {
      console.error('Failed to sync coordinators to Supabase:', err);
    });
  });
}

function openCoordModal(idx) {
  editingCoordIdx = idx;
  $('cm-err').textContent = '';
  $('coord-form').reset();

  if (idx !== null) {
    $('cm-mode').textContent  = 'Edit Organiser';
    $('cm-title').textContent = 'Edit Organiser';
    const coord = allCoordsFor(activeDept)[idx];
    if (coord) { $('cm-name').value = coord.name; $('cm-phone').value = coord.phone; }
  } else {
    $('cm-mode').textContent  = 'Add Organiser';
    $('cm-title').textContent = 'New Organiser';
  }

  coordModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('cm-name').focus(), 60);
}

function closeCoordModal() {
  coordModal.classList.remove('open');
  document.body.style.overflow = '';
  editingCoordIdx = null;
}

// ─── Delete confirm modal ─────────────────────────────────────
function bindDeleteModal() {
  $('del-cancel').onclick = closeDelModal;
  delModal.addEventListener('click', e => { if (e.target === delModal) closeDelModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && delModal.classList.contains('open')) closeDelModal(); });

  $('del-confirm').onclick = () => {
    if (pendingDeleteType === 'event') {
      const store = getAdminEvents();
      if (store[activeDept]) {
        store[activeDept] = store[activeDept].filter(e => e.id !== pendingDeleteId);
        setAdminEvents(store);
      }
      const delStore = getDeletedEvents();
      if (!delStore[activeDept]) delStore[activeDept] = [];
      if (!delStore[activeDept].includes(pendingDeleteId)) {
        delStore[activeDept].push(pendingDeleteId);
        setDeletedEvents(delStore);
      }
      // Prune from admin registrations and participant registrations cache immediately
      try {
        const aRaw = JSON.parse(localStorage.getItem(ADMIN_REGS_KEY) || '[]');
        if (Array.isArray(aRaw)) {
          const filtered = aRaw.filter(r => (r.eventId || r.event_id || r.id) !== pendingDeleteId);
          if (filtered.length !== aRaw.length) {
            localStorage.setItem(ADMIN_REGS_KEY, JSON.stringify(filtered));
          }
        }
        const regRaw = JSON.parse(localStorage.getItem('tantra26:registrations') || '[]');
        if (Array.isArray(regRaw)) {
          const filtered = regRaw.filter(r => (r.eventId || r.event_id || r.id) !== pendingDeleteId);
          if (filtered.length !== regRaw.length) {
            localStorage.setItem('tantra26:registrations', JSON.stringify(filtered));
          }
        }
      } catch {}
      apiDeleteEvent(pendingDeleteId).then(ok => {
        if (ok) toast('Deleted from cloud ✓', 'info');
      }).catch(() => {});
      toast('Event deleted', 'info');
      refreshSidebar();
      renderStats(activeDept);
      renderEvents(activeDept);
    } else if (pendingDeleteType === 'coord') {
      const store  = getAdminCoords();
      const coords = [...allCoordsFor(activeDept)];
      coords.splice(pendingDeleteId, 1);
      store[activeDept] = coords;
      setAdminCoords(store);
      toast('Organiser removed', 'info');
      renderCoords(activeDept);

      apiSyncDeptCoords(activeDept, coords).then(ok => {
        if (ok) toast('Synced to cloud ✓', 'info');
      }).catch(err => {
        console.error('Failed to sync coordinators after delete:', err);
      });
    }
    closeDelModal();
  };
}

function confirmDelete(type, id, label) {
  pendingDeleteType = type;
  pendingDeleteId   = id;
  $('del-name').textContent = label;
  delModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDelModal() {
  delModal.classList.remove('open');
  document.body.style.overflow = '';
  pendingDeleteId = null; pendingDeleteType = null;
}

// ─── Department Registrations View ────────────────────────────
let isSyncingRegs = false;
function syncLiveRegistrations() {
  if (isSyncingRegs) return;
  isSyncingRegs = true;
  fetchAdminRegistrations().then(liveRegs => {
    isSyncingRegs = false;
    if (liveRegs && Array.isArray(liveRegs)) {
      const formatted = liveRegs.map(r => ({
        regId: r.reg_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        college: r.college,
        slug: r.dept_slug,
        dept: r.dept_slug,
        event: r.event_title,
        eventId: r.event_id,
        fee: r.fee,
        team: r.team_members,
        txnId: r.txn_id,
        time: r.created_at,
      }));
      save(ADMIN_REGS_KEY, formatted);
      try { sanitizePersonalRegistrations(); } catch {}
      updateRegsBadge();
      if (currentView === 'regs') renderDeptRegistrations();
      if (currentView === 'central-regs') renderCentralRegs();
    }
  }).catch(() => { isSyncingRegs = false; });
}

function bindRegistrationsView() {
  const searchInput = $('regs-search');
  searchInput.addEventListener('input', () => {
    renderDeptRegistrations(searchInput.value.trim());
  });

  $('export-dept-excel-btn').onclick = () => {
    openExcelModal(activeDept);
  };
}

function renderDeptRegistrations(query = '') {
  syncLiveRegistrations();
  const allRegs = getAllRegistrations();
  const tbody = $('regs-tbody');
  const empty = $('regs-empty-state');
  tbody.innerHTML = '';

  const filtered = allRegs.filter(r => {
    if (r.slug !== activeDept) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.college && r.college.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.txnId && r.txnId.toLowerCase().includes(q)) ||
      (r.event && r.event.toLowerCase().includes(q)) ||
      (r.regId && r.regId.toLowerCase().includes(q))
    );
  });

  updateRegsBadge();

  if (filtered.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    const dateFormatted = r.time ? new Date(r.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
    tr.innerHTML = `
      <td><span class="reg-id-badge">${esc(r.regId || '—')}</span></td>
      <td>
        <strong>${esc(r.name || '—')}</strong><br>
        <small style="color:rgba(239,232,218,.45)">${esc(r.college || '—')}</small>
      </td>
      <td>${esc(r.event || '—')}</td>
      <td>${esc(r.fee || 'Free')}</td>
      <td>
        ${r.txnId ? `<span class="txn-badge" title="UPI Transaction ID">${esc(r.txnId)}</span>` : '<span style="color:rgba(239,232,218,.35)">Free / None</span>'}
      </td>
      <td>
        <span style="font-size:12px">${esc(r.phone || '—')}</span><br>
        <small style="color:rgba(239,232,218,.45)">${esc(r.email || '—')}</small>
      </td>
      <td style="color:rgba(239,232,218,.5);white-space:nowrap">${dateFormatted}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Central Admin Panels (Super Admin Only) ──────────────────
function bindCentralAdminViews() {
  $('nav-central-qrs').onclick = () => {
    if (currentUser.role !== 'superadmin') return;
    currentView = 'central-qrs';
    hideAllViews();
    $('main-header').hidden = true;
    $('view-central-qrs').hidden = false;
    refreshSidebar();
    renderCentralQRs();
  };

  $('nav-central-regs').onclick = () => {
    if (currentUser.role !== 'superadmin') return;
    currentView = 'central-regs';
    hideAllViews();
    $('main-header').hidden = true;
    $('view-central-regs').hidden = false;
    refreshSidebar();
    renderCentralRegs();
  };

  if ($('nav-central-featured')) {
    $('nav-central-featured').onclick = () => {
      if (currentUser.role !== 'superadmin') return;
      currentView = 'central-featured';
      hideAllViews();
      $('main-header').hidden = true;
      $('view-central-featured').hidden = false;
      refreshSidebar();
      renderCentralFeatured();
    };
  }

  if ($('nav-central-posters')) {
    $('nav-central-posters').onclick = () => {
      if (currentUser.role !== 'superadmin') return;
      currentView = 'central-posters';
      hideAllViews();
      $('main-header').hidden = true;
      $('view-central-posters').hidden = false;
      refreshSidebar();
      renderCentralPosters();
      syncCentralPostersFromCloud();
    };
  }

  if ($('add-poster-btn')) {
    $('add-poster-btn').onclick = () => {
      openPosterModal();
    };
  }

  $('central-dept-filter').onchange = () => {
    renderCentralRegs();
  };

  $('central-regs-search').oninput = () => {
    renderCentralRegs();
  };

  if ($('central-feat-dept-filter')) {
    $('central-feat-dept-filter').onchange = () => {
      renderCentralFeatured();
    };
  }

  if ($('central-feat-search')) {
    $('central-feat-search').oninput = () => {
      renderCentralFeatured();
    };
  }

  $('export-master-excel-btn').onclick = () => {
    openExcelModal('all');
  };
}

// ─── Central View 1: Department Payment QRs Management ────────
function renderCentralQRs() {
  const grid = $('qrs-grid');
  grid.innerHTML = '';
  const storedPayments = getDeptPayments();

  DEPTS.forEach(dept => {
    const cfg = storedPayments[dept.slug] || {};
    const upiId = cfg.upiId || `tantra26.${dept.slug}@okhdfcbank`;
    const qrImage = cfg.qrImage; // base64

    const card = document.createElement('div');
    card.className = 'dept-qr-card';
    card.style.cssText = `--acc:${dept.color};--accfg:${dept.fg}`;

    card.innerHTML = `
      <div class="dept-qr-card-head">
        <h4>${esc(dept.name)}</h4>
        <span class="qr-status-tag ${qrImage ? 'custom' : 'auto'}">${qrImage ? 'Custom QR' : 'Auto UPI'}</span>
      </div>
      <div class="dept-qr-card-body">
        <div class="qr-preview-box" id="preview-box-${dept.slug}">
          ${qrImage
            ? `<img src="${qrImage}" alt="${esc(dept.name)} QR">`
            : `<canvas id="qr-canvas-${dept.slug}" width="140" height="140"></canvas>`}
        </div>
        <label>UPI ID
          <input type="text" id="upi-input-${dept.slug}" value="${esc(upiId)}" placeholder="e.g. tantra26.${dept.slug}@upi">
        </label>
        <div class="qr-actions-row">
          <label class="upload-btn-label">
            Upload Image
            <input type="file" id="file-${dept.slug}" accept="image/png,image/jpeg,image/webp" style="display:none">
          </label>
          <button type="button" class="qr-save-btn" id="save-qr-${dept.slug}">Save</button>
          ${qrImage ? `<button type="button" class="qr-reset-btn" id="reset-qr-${dept.slug}">Reset</button>` : ''}
        </div>
      </div>
    `;

    grid.appendChild(card);

    // If auto QR, render canvas
    if (!qrImage) {
      const canvas = $(`qr-canvas-${dept.slug}`);
      if (canvas) {
        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Tantra%2026%20${encodeURIComponent(dept.name)}&cu=INR`;
        QRCode.toCanvas(canvas, upiUrl, {
          width: 135,
          margin: 1,
          color: { dark: '#101a2d', light: '#ffffff' }
        });
      }
    }

    // File input handler
    const fileIn = $(`file-${dept.slug}`);
    fileIn.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target.result;
        const curUpi = $(`upi-input-${dept.slug}`).value.trim() || upiId;
        const payments = getDeptPayments();
        if (!payments[dept.slug]) payments[dept.slug] = {};
        payments[dept.slug].qrImage = dataUrl;
        payments[dept.slug].upiId = curUpi;
        setDeptPayments(payments);
        toast(`${dept.name} QR updated ✓`);
        renderCentralQRs();
        apiSavePayment({ dept_slug: dept.slug, upi_id: curUpi, qr_image_url: dataUrl }).then(ok => {
          if (ok) toast(`${dept.name} synced to cloud ✓`, 'info');
        }).catch(console.error);
      };
      reader.readAsDataURL(file);
    };

    // Save UPI ID button
    $(`save-qr-${dept.slug}`).onclick = () => {
      const newUpi = $(`upi-input-${dept.slug}`).value.trim() || upiId;
      const payments = getDeptPayments();
      if (!payments[dept.slug]) payments[dept.slug] = {};
      payments[dept.slug].upiId = newUpi;
      setDeptPayments(payments);
      toast(`${dept.name} settings saved ✓`);
      renderCentralQRs();
      apiSavePayment({ dept_slug: dept.slug, upi_id: newUpi, qr_image_url: payments[dept.slug].qrImage || null }).then(ok => {
        if (ok) toast(`${dept.name} synced to cloud ✓`, 'info');
      }).catch(console.error);
    };

    // Reset button
    if (qrImage) {
      $(`reset-qr-${dept.slug}`).onclick = () => {
        const curUpi = $(`upi-input-${dept.slug}`).value.trim() || upiId;
        const payments = getDeptPayments();
        if (payments[dept.slug]) {
          delete payments[dept.slug].qrImage;
          setDeptPayments(payments);
        }
        toast(`${dept.name} reverted to auto QR`, 'info');
        renderCentralQRs();
        apiSavePayment({ dept_slug: dept.slug, upi_id: curUpi, qr_image_url: null }).then(ok => {
          if (ok) toast(`${dept.name} reset synced to cloud ✓`, 'info');
        }).catch(console.error);
      };
    }
  });
}

// ─── Central View 2: Master Registrations View ─────────────────
function renderCentralRegs() {
  syncLiveRegistrations();
  const allRegs   = getAllRegistrations();
  const deptFilter = $('central-dept-filter').value;
  const searchVal  = ($('central-regs-search').value || '').trim().toLowerCase();
  const tbody      = $('central-regs-tbody');
  const empty      = $('central-empty-state');
  tbody.innerHTML  = '';

  // Stats
  const colleges = new Set();
  let paidCount = 0;
  allRegs.forEach(r => {
    if (r.college) colleges.add(r.college.toLowerCase());
    if (r.txnId && r.txnId !== 'FREE-REGISTRATION') paidCount++;
  });

  $('master-stats-row').innerHTML = `
    <div class="master-stat-card">
      <span class="master-stat-val">${String(allRegs.length).padStart(2, '0')}</span>
      <span class="master-stat-lbl">Total Registrations</span>
    </div>
    <div class="master-stat-card">
      <span class="master-stat-val">${String(paidCount).padStart(2, '0')}</span>
      <span class="master-stat-lbl">UPI Paid Transactions</span>
    </div>
    <div class="master-stat-card">
      <span class="master-stat-val">${String(colleges.size).padStart(2, '0')}</span>
      <span class="master-stat-lbl">Institutions</span>
    </div>
  `;

  const filtered = allRegs.filter(r => {
    if (deptFilter && r.slug !== deptFilter) return false;
    if (!searchVal) return true;
    return (
      (r.name && r.name.toLowerCase().includes(searchVal)) ||
      (r.college && r.college.toLowerCase().includes(searchVal)) ||
      (r.email && r.email.toLowerCase().includes(searchVal)) ||
      (r.txnId && r.txnId.toLowerCase().includes(searchVal)) ||
      (r.event && r.event.toLowerCase().includes(searchVal)) ||
      (r.regId && r.regId.toLowerCase().includes(searchVal))
    );
  });

  updateRegsBadge();

  if (filtered.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    const dateFormatted = r.time ? new Date(r.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
    tr.innerHTML = `
      <td><span class="reg-id-badge">${esc(r.regId || '—')}</span></td>
      <td>
        <strong>${esc(r.name || '—')}</strong><br>
        <small style="color:rgba(239,232,218,.45)">${esc(r.college || '—')}</small>
      </td>
      <td>${esc(r.event || '—')}</td>
      <td><span class="badge" style="background:rgba(255,255,255,.1);text-transform:uppercase">${esc(r.slug || '—')}</span></td>
      <td>${esc(r.fee || 'Free')}</td>
      <td>
        ${r.txnId ? `<span class="txn-badge" title="UPI Transaction ID">${esc(r.txnId)}</span>` : '<span style="color:rgba(239,232,218,.35)">Free / None</span>'}
      </td>
      <td>
        <span style="font-size:12px">${esc(r.phone || '—')}</span><br>
        <small style="color:rgba(239,232,218,.45)">${esc(r.email || '—')}</small>
      </td>
      <td style="color:rgba(239,232,218,.5);white-space:nowrap">${dateFormatted}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Central View 3: Featured Events Manager ──────────────────
function getAllFeaturedCandidateEvents() {
  const list = [];
  let localOrganiserEvents = {};
  try {
    localOrganiserEvents = JSON.parse(localStorage.getItem('tantra26:events') || '{}');
  } catch {}

  DEPTS.forEach(d => {
    const deptEvents = allEventsFor(d.slug);
    deptEvents.forEach(e => {
      // Merge with any newer local organiser event record (safely matching keys)
      const orgEv = localOrganiserEvents[d.slug + ':' + e.id]
        || localOrganiserEvents[e.id]
        || (e.id ? Object.values(localOrganiserEvents).find(o => o && o.id === e.id) : null)
        || (e.title ? Object.values(localOrganiserEvents).find(o => o && o.slug === d.slug && matchEventTitle(o.title, e.title)) : null);

      const merged = orgEv ? { ...e, ...orgEv } : { ...e };
      merged.deptSlug = d.slug;
      merged.deptName = d.name;

      const bMerged = (merged.banners && typeof merged.banners === 'object') ? merged.banners : {};
      const orgBanners = (orgEv && orgEv.banners && typeof orgEv.banners === 'object') ? orgEv.banners : {};
      const eBanners = (e.banners && typeof e.banners === 'object') ? e.banners : {};

      const featDesk = [
        bMerged.featured_desktop,
        orgBanners.featured_desktop,
        eBanners.featured_desktop,
        bMerged.event_desktop,
        orgBanners.event_desktop,
        eBanners.event_desktop,
        orgEv?.banner,
        e.banner,
      ].find(isValidImageUrl) || '';

      const featMob = [
        bMerged.featured_mobile,
        orgBanners.featured_mobile,
        eBanners.featured_mobile,
        bMerged.event_mobile,
        orgBanners.event_mobile,
        eBanners.event_mobile,
      ].find(isValidImageUrl) || (featDesk ? featDesk : '');

      merged.banners = {
        ...bMerged,
        featured_desktop: featDesk,
        featured_mobile: featMob,
      };

      merged.is_featured = Boolean(merged.is_featured);
      merged.featured_order = parseInt(merged.featured_order, 10) || 1;
      list.push(merged);
    });
  });

  return list;
}

function renderCentralFeatured() {
  const deptFilter = $('central-feat-dept-filter') ? $('central-feat-dept-filter').value : '';
  const searchVal  = ($('central-feat-search') ? $('central-feat-search').value : '').trim().toLowerCase();
  const grid       = $('central-featured-grid');
  const empty      = $('featured-empty-state');
  if (!grid) return;
  grid.innerHTML   = '';

  const allCandidateEvents = getAllFeaturedCandidateEvents();

  // Filter
  const filtered = allCandidateEvents.filter(ev => {
    if (deptFilter && ev.deptSlug !== deptFilter) return false;
    if (!searchVal) return true;
    return (
      (ev.title && ev.title.toLowerCase().includes(searchVal)) ||
      (ev.id && ev.id.toLowerCase().includes(searchVal)) ||
      (ev.type && ev.type.toLowerCase().includes(searchVal)) ||
      (ev.deptName && ev.deptName.toLowerCase().includes(searchVal))
    );
  });

  // Sort: featured items first (by featured_order asc), then by department, then by title
  filtered.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.is_featured && b.is_featured) {
      return (a.featured_order || 1) - (b.featured_order || 1);
    }
    return a.title.localeCompare(b.title);
  });

  // Update badge count
  const featuredCount = allCandidateEvents.filter(e => e.is_featured).length;
  if ($('central-featured-badge')) {
    $('central-featured-badge').textContent = featuredCount > 0 ? featuredCount : '★';
  }

  if (filtered.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const deptConfigMap = {
    cse: CSE_CFG,
    cscy: CSCY_CFG,
    ai: AI_CFG,
    csd: CSD_CFG,
    csbs: CSBS_CFG,
    eee: EEE_CFG,
    ece: ECE_CFG,
    aei: AEI_CFG,
    civil: CIVIL_CFG,
    mech: MECH_CFG,
  };

  // Handle Demo Mode button
  const demoBtn = $('feat-demo-toggle-btn');
  const demoText = $('feat-demo-btn-text');
  const isDemo = localStorage.getItem('tantra26:featured:demo_mode') === 'true';

  if (demoBtn && demoText) {
    demoBtn.classList.toggle('is-active', isDemo);
    demoText.textContent = isDemo ? 'Demo Mode Active (Live on Homepage)' : 'Enable Demo Mode';

    demoBtn.onclick = () => {
      const nextState = !(localStorage.getItem('tantra26:featured:demo_mode') === 'true');
      localStorage.setItem('tantra26:featured:demo_mode', String(nextState));
      demoBtn.classList.toggle('is-active', nextState);
      demoText.textContent = nextState ? 'Demo Mode Active (Live on Homepage)' : 'Enable Demo Mode';
      toast(nextState ? 'Showcase Demo Mode ENABLED! Check homepage.' : 'Showcase Demo Mode disabled.');
    };
  }

  // Calculate currently occupied slots across active featured events
  const occupiedSlots = new Set(
    allCandidateEvents
      .filter(e => e.is_featured)
      .map(e => parseInt(e.featured_order, 10) || 1)
  );

  let nextFreeSlot = 1;
  while (occupiedSlots.has(nextFreeSlot)) {
    nextFreeSlot++;
  }

  filtered.forEach(ev => {
    const b = ev.banners || {};
    const hasFeatDesktop = isValidImageUrl(b.featured_desktop);
    const hasFeatMobile  = isValidImageUrl(b.featured_mobile);
    const isReady        = hasFeatDesktop && hasFeatMobile;
    const isFeat         = Boolean(ev.is_featured);
    const cfg            = deptConfigMap[ev.deptSlug] || {};
    const deptBg         = cfg.heroBg || '#182338';
    const deptFg         = cfg.heroFg || '#efe8da';

    const slotVal = isFeat ? (parseInt(ev.featured_order, 10) || 1) : nextFreeSlot;
    const isDuplicateSlot = isFeat && allCandidateEvents.some(
      x => x.is_featured && x.id !== ev.id && (parseInt(x.featured_order, 10) || 1) === (parseInt(ev.featured_order, 10) || 1)
    );

    const card = document.createElement('div');
    card.className = `feat-card ${isFeat ? 'is-featured' : ''}`;
    card.innerHTML = `
      <div class="feat-card-head" style="--acc: ${deptBg}; --accfg: ${deptFg}">
        <div class="feat-card-title-col">
          <span class="feat-dept-label">${esc(ev.deptName)}</span>
          <h4>${formatTitleSpan(expandMathShortcuts(ev.title))}</h4>
        </div>
        <span class="feat-type-badge">${esc(ev.type || 'Event')}</span>
      </div>
      <div class="feat-card-body">
        <div class="feat-meta-row">
          <span>Fee: ${esc(ev.fee || 'Free')} · Team: ${esc(ev.team || '1')} · Venue: ${esc(ev.venue || 'Campus')}</span>
        </div>

        ${isFeat
          ? isDuplicateSlot
            ? `<div><span class="feat-status-badge" style="background:#c23b22;color:#efe8da;font-weight:700">⚠️ Conflict: Slot #${ev.featured_order || 1} already in use!</span></div>`
            : `<div><span class="feat-status-badge active-featured">★ Featured on Homepage (Slot #${ev.featured_order || 1})</span></div>`
          : isReady
            ? `<div><span class="feat-status-badge ready">✓ Ready to Feature</span></div>`
            : ''
        }

        <div class="feat-banner-previews">
          <div class="f-prev-slot">
            <span>Featured Desktop (16:8)</span>
            ${hasFeatDesktop
              ? `<img src="${esc(b.featured_desktop)}" alt="Featured Desktop Preview" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="f-no-img" style="display:none">No Banner Uploaded</div>`
              : `<div class="f-no-img">No Banner Uploaded</div>`
            }
          </div>
          <div class="f-prev-slot">
            <span>Featured Mobile (4:5)</span>
            ${hasFeatMobile
              ? `<img src="${esc(b.featured_mobile)}" alt="Featured Mobile Preview" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="f-no-img" style="display:none">No Banner Uploaded</div>`
              : `<div class="f-no-img">No Banner Uploaded</div>`
            }
          </div>
        </div>

        <div class="feat-card-actions">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font: 700 10px/1 'Inter'; letter-spacing: .12em; text-transform: uppercase; color: rgba(239,232,218,.6);">Order:</label>
            <input type="number" min="1" max="99" class="feat-order-input" value="${slotVal}" ${!isReady && !isFeat ? 'disabled' : ''}>
          </div>
          <div>
            ${isFeat
              ? `<button class="feat-toggle-btn btn-disable">Unfeature Event</button>`
              : isReady
                ? `<button class="feat-toggle-btn btn-enable">★ Feature on Homepage</button>`
                : `<button class="feat-toggle-btn" disabled title="Organiser must upload both Desktop and Mobile featured banners">Missing Banners</button>`
            }
          </div>
        </div>
      </div>
    `;

    // Bind order input change
    const orderInput = card.querySelector('.feat-order-input');
    if (orderInput) {
      orderInput.onchange = async () => {
        const newOrder = parseInt(orderInput.value, 10);
        if (isNaN(newOrder) || newOrder < 1) {
          toast('Slot number must be at least 1', 'error');
          orderInput.value = isFeat ? (parseInt(ev.featured_order, 10) || 1) : nextFreeSlot;
          return;
        }

        // Prevent two events from having the exact same slot
        const conflict = allCandidateEvents.find(
          x => x.is_featured && x.id !== ev.id && (parseInt(x.featured_order, 10) || 1) === newOrder
        );
        if (conflict) {
          toast(`Slot #${newOrder} is already in use by "${conflict.title}". Each featured event must have a distinct slot.`, 'error');
          orderInput.value = isFeat ? (parseInt(ev.featured_order, 10) || 1) : nextFreeSlot;
          return;
        }

        ev.featured_order = newOrder;

        // Update local store
        const adminEvents = getAdminEvents();
        if (adminEvents[ev.deptSlug]) {
          const target = adminEvents[ev.deptSlug].find(x => x.id === ev.id);
          if (target) target.featured_order = newOrder;
          setAdminEvents(adminEvents);
        }

        if (isFeat) {
          const res = await apiSetEventFeatured(ev.id, true, newOrder);
          if (res.ok) {
            toast(`Order updated for ${ev.title} (Slot #${newOrder}) ✓`);
            renderCentralFeatured();
          } else {
            toast(res.error || 'Failed to update order', 'error');
          }
        }
      };
    }

    // Bind toggle button
    const toggleBtn = card.querySelector('.feat-toggle-btn');
    if (toggleBtn && !toggleBtn.disabled) {
      toggleBtn.onclick = async () => {
        const targetOrder = parseInt(orderInput.value, 10) || slotVal;

        if (!isFeat) {
          // Check conflict before featuring
          const conflict = allCandidateEvents.find(
            x => x.is_featured && x.id !== ev.id && (parseInt(x.featured_order, 10) || 1) === targetOrder
          );
          if (conflict) {
            toast(`Cannot feature in Slot #${targetOrder}: already occupied by "${conflict.title}". Pick an unused slot.`, 'error');
            return;
          }
        }

        toggleBtn.disabled = true;
        toggleBtn.textContent = isFeat ? 'Unfeaturing…' : 'Featuring…';

        const res = await apiSetEventFeatured(ev.id, !isFeat, targetOrder);
        if (res.ok) {
          ev.is_featured = !isFeat;
          ev.featured_order = targetOrder;

          // Update local storage
          const adminEvents = getAdminEvents();
          if (!adminEvents[ev.deptSlug]) adminEvents[ev.deptSlug] = [];
          let target = adminEvents[ev.deptSlug].find(x => x.id === ev.id);
          if (!target) {
            target = { ...ev };
            adminEvents[ev.deptSlug].push(target);
          }
          target.is_featured = !isFeat;
          target.featured_order = targetOrder;
          setAdminEvents(adminEvents);

          toast(isFeat ? `Removed ${ev.title} from featured events` : `★ ${ev.title} is now featured in Slot #${targetOrder}!`);
          renderCentralFeatured();
          refreshSidebar();
        } else {
          toast(res.error || 'Failed to update featured status', 'error');
          toggleBtn.disabled = false;
          toggleBtn.textContent = isFeat ? 'Unfeature Event' : '★ Feature on Homepage';
        }
      };
    }

    grid.appendChild(card);
  });
}

// ─── Central View 4: Showcase Posters & Attractions Manager ───
let currentPosterDeskImg = '';
let currentPosterMobImg = '';

function getAllShowcasePosters() {
  const adminEvents = getAdminEvents();
  const dedicated = load('tantra26:admin:showcase_posters', []);
  const posters = [];
  const seen = new Set();

  const add = (e) => {
    if (!e || !e.id || seen.has(e.id)) return;
    if (e.display_only || e.displayOnly || e.dept_slug === 'central' || e.type === 'Special Attraction') {
      posters.push(e);
      seen.add(e.id);
    }
  };

  (adminEvents['central'] || []).forEach(add);
  dedicated.forEach(add);

  Object.keys(adminEvents).forEach(slug => {
    (adminEvents[slug] || []).forEach(add);
  });

  return posters;
}

function updateShowcaseBadge() {
  if ($('central-posters-badge')) {
    const posters = getAllShowcasePosters();
    $('central-posters-badge').textContent = posters.length > 0 ? posters.length : 'Ad';
  }
}

let isSyncingCentral = false;
async function syncCentralPostersFromCloud() {
  if (isSyncingCentral) return;
  isSyncingCentral = true;
  try {
    const cloudAttractions = await apiFetchSpecialAttractions();
    if (cloudAttractions && Array.isArray(cloudAttractions)) {
      const adminEvents = getAdminEvents();
      const existing = [
        ...(adminEvents['central'] || []),
        ...load('tantra26:admin:showcase_posters', []),
      ];
      const map = new Map();
      existing.forEach(p => { if (p && p.id) map.set(p.id, p); });
      cloudAttractions.forEach(p => { if (p && p.id) map.set(p.id, p); });
      const merged = Array.from(map.values());
      adminEvents['central'] = merged;
      setAdminEvents(adminEvents);
      save('tantra26:admin:showcase_posters', merged);
      renderCentralPosters();
      updateShowcaseBadge();
    }
  } catch (err) {
    console.warn('Could not sync central posters from cloud:', err);
  } finally {
    isSyncingCentral = false;
  }
}

function renderCentralPosters() {
  const grid = $('central-posters-grid');
  const empty = $('posters-empty-state');
  if (!grid) return;
  grid.innerHTML = '';

  const posters = getAllShowcasePosters();
  updateShowcaseBadge();
  if (posters.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  posters.forEach(p => {
    const card = document.createElement('div');
    const isFeat = Boolean(p.is_featured);
    card.className = `feat-card ${isFeat ? 'is-featured' : ''}`;
    const b = p.banners || {};
    const deskImg = b.featured_desktop || p.banner || b.event_desktop || '';
    const mobImg  = b.featured_mobile  || b.event_mobile || deskImg;

    card.innerHTML = `
      <div class="feat-card-head" style="--acc: #182338; --accfg: #efe8da">
        <div class="feat-card-title-col">
          <span class="feat-dept-label">Central Attraction · ${esc(p.venue || 'Campus Ground')}</span>
          <h4>${formatTitleSpan(expandMathShortcuts(p.title))}</h4>
        </div>
        <span class="feat-type-badge">${esc(p.type || 'Special Attraction')}</span>
      </div>
      <div class="feat-card-body">
        <div class="feat-meta-row">
          <span>${esc(p.date || '7-8 Oct')} · ${esc(p.time || 'All Day')} · Viewing Only</span>
        </div>
        <div>
          <span class="feat-status-badge ${isFeat ? 'active-featured' : ''}">${isFeat ? '★ Spotlight Active on Homepage' : 'Hidden from Homepage'}</span>
        </div>
        <div class="feat-banner-previews">
          <div class="f-prev-slot">
            <span>Desktop Poster (16:8)</span>
            ${deskImg ? `<img src="${esc(deskImg)}" alt="Desktop Preview" style="width:100%;height:100%;object-fit:cover">` : `<div class="f-no-img">No Banner</div>`}
          </div>
          <div class="f-prev-slot">
            <span>Mobile Poster (4:5)</span>
            ${mobImg ? `<img src="${esc(mobImg)}" alt="Mobile Preview" style="width:100%;height:100%;object-fit:cover">` : `<div class="f-no-img">No Banner</div>`}
          </div>
        </div>
        <div class="feat-card-actions" style="margin-top:auto;display:flex;gap:10px;justify-content:flex-end;align-items:center">
          <button type="button" class="feat-toggle-btn edit-poster-btn">Edit Poster</button>
          <button type="button" class="tb-btn tb-btn--danger delete-poster-btn" style="padding:7px 14px;font-size:11px;font-weight:700">Delete</button>
        </div>
      </div>
    `;

    card.querySelector('.edit-poster-btn').onclick = () => openPosterModal(p);
    card.querySelector('.delete-poster-btn').onclick = () => deleteShowcasePoster(p);
    grid.appendChild(card);
  });
}

function compressPosterImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openPosterModal(poster = null) {
  const modal = $('poster-modal');
  if (!modal) return;

  $('pm-id').value = poster?.id || '';
  $('pm-mode').textContent = poster ? 'Edit Attraction' : 'Showcase Attraction';
  $('pm-title').textContent = poster ? 'Edit Showcase Poster' : 'New Showcase Poster';
  $('pm-title-input').value = poster?.title || '';
  $('pm-type').value = poster?.type || 'Special Attraction';
  $('pm-venue').value = poster?.venue || 'Campus Central Ground';
  $('pm-date').value = poster?.date || '7-8 Oct';
  $('pm-time').value = poster?.time || 'All Day';
  $('pm-desc').value = poster?.desc || poster?.details || '';
  $('pm-is-featured').checked = poster ? Boolean(poster.is_featured) : true;

  const b = poster?.banners || {};
  currentPosterDeskImg = b.featured_desktop || poster?.banner || '';
  currentPosterMobImg = b.featured_mobile || currentPosterDeskImg;

  if (currentPosterDeskImg) {
    $('pm-desk-preview').style.display = 'block';
    $('pm-desk-img').src = currentPosterDeskImg;
  } else {
    $('pm-desk-preview').style.display = 'none';
    $('pm-desk-img').src = '';
  }

  if (currentPosterMobImg) {
    $('pm-mob-preview').style.display = 'block';
    $('pm-mob-img').src = currentPosterMobImg;
  } else {
    $('pm-mob-preview').style.display = 'none';
    $('pm-mob-img').src = '';
  }

  $('pm-banner-desk-file').value = '';
  $('pm-banner-mob-file').value = '';

  modal.classList.add('open');
}

function closePosterModal() {
  const modal = $('poster-modal');
  if (modal) modal.classList.remove('open');
}

function bindPosterModal() {
  const modal = $('poster-modal');
  if (!modal) return;

  $('pm-close').onclick = closePosterModal;
  $('pm-cancel').onclick = closePosterModal;

  $('pm-banner-desk-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressPosterImage(file);
      currentPosterDeskImg = dataUrl;
      $('pm-desk-preview').style.display = 'block';
      $('pm-desk-img').src = dataUrl;
      if (!currentPosterMobImg) {
        currentPosterMobImg = dataUrl;
        $('pm-mob-preview').style.display = 'block';
        $('pm-mob-img').src = dataUrl;
      }
    } catch {
      toast('Failed to process desktop image', 'error');
    }
  };

  $('pm-banner-mob-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressPosterImage(file, 1200, 0.82);
      currentPosterMobImg = dataUrl;
      $('pm-mob-preview').style.display = 'block';
      $('pm-mob-img').src = dataUrl;
    } catch {
      toast('Failed to process mobile image', 'error');
    }
  };

  $('poster-form').onsubmit = async (e) => {
    e.preventDefault();
    const title = $('pm-title-input').value.trim();
    if (!title) {
      toast('Please enter a title for this poster', 'error');
      return;
    }

    const id = $('pm-id').value.trim() || ('attraction-' + Date.now().toString(36));
    const isFeatured = $('pm-is-featured').checked;

    const posterObj = {
      id,
      title,
      type: $('pm-type').value.trim() || 'Special Attraction',
      venue: $('pm-venue').value.trim() || 'Campus',
      date: $('pm-date').value.trim() || '7-8 Oct',
      time: $('pm-time').value.trim() || 'All Day',
      desc: $('pm-desc').value.trim(),
      details: $('pm-desc').value.trim(),
      fee: 'Viewing Only',
      team: 1,
      slug: 'central',
      deptSlug: 'central',
      dept_slug: 'central',
      display_only: true,
      displayOnly: true,
      is_featured: isFeatured,
      featured_order: 1,
      banners: {
        featured_desktop: currentPosterDeskImg,
        featured_mobile: currentPosterMobImg || currentPosterDeskImg,
        event_desktop: currentPosterDeskImg,
        event_mobile: currentPosterMobImg || currentPosterDeskImg,
      },
      banner: currentPosterDeskImg,
    };

    // Save to adminEvents['central']
    const adminEvents = getAdminEvents();
    if (!adminEvents['central']) adminEvents['central'] = [];
    const idx = adminEvents['central'].findIndex(x => x.id === id);
    if (idx >= 0) {
      adminEvents['central'][idx] = posterObj;
    } else {
      adminEvents['central'].push(posterObj);
    }
    setAdminEvents(adminEvents);
    try { localStorage.removeItem('tantra26:cache:featured_events'); } catch {}

    closePosterModal();
    toast('Showcase poster saved ✓');
    renderCentralPosters();
    updateRegsBadge();

    // Async save to cloud database
    apiSaveEvent(posterObj).then(() => {
      toast('Poster synced to database ✓', 'info');
      syncCentralPostersFromCloud();
    }).catch(err => {
      console.warn('apiSaveEvent poster warning:', err);
    });
  };
}

async function deleteShowcasePoster(poster) {
  if (!confirm(`Are you sure you want to delete the showcase poster "${poster.title}"?`)) return;

  const id = poster.id;

  // 1. Immediately prune from local storage
  const adminEvents = getAdminEvents();
  if (adminEvents['central']) {
    adminEvents['central'] = adminEvents['central'].filter(x => x.id !== id);
  }
  Object.keys(adminEvents).forEach(s => {
    adminEvents[s] = (adminEvents[s] || []).filter(x => x.id !== id);
  });
  setAdminEvents(adminEvents);
  save('tantra26:admin:showcase_posters', load('tantra26:admin:showcase_posters', []).filter(x => x.id !== id));
  try { localStorage.removeItem('tantra26:cache:featured_events'); } catch {}

  toast(`Deleted "${poster.title}"`);
  renderCentralPosters();
  updateShowcaseBadge();
  updateRegsBadge();

  // 2. Delete from cloud database
  try {
    await apiDeleteEvent(id);
  } catch (err) {
    console.error('Delete poster failed:', err);
  }

  // 3. Confirm cloud synchronization
  await syncCentralPostersFromCloud();
}

function getDepartmentEventsList(slug) {
  if (!slug || slug === 'all') return [];
  const list = [...(allEventsFor(slug) || [])];
  const allRegs = getAllRegistrations();
  const knownTitles = new Set(list.map(e => (e.title || '').trim().toLowerCase()));

  allRegs.filter(r => r.slug === slug).forEach(r => {
    if (r.event && !knownTitles.has(r.event.trim().toLowerCase())) {
      knownTitles.add(r.event.trim().toLowerCase());
      list.push({ id: r.eventId || r.event, title: r.event });
    }
  });
  return list;
}

function populateExcelEventOptions(deptSlug) {
  const eventSelect = $('excel-event-select');
  const eventLabel = $('excel-event-label');
  if (!eventSelect || !eventLabel) return;

  if (!deptSlug || deptSlug === 'all') {
    eventLabel.style.display = 'none';
    eventSelect.innerHTML = '<option value="all">All Events (All Departments)</option>';
    return;
  }

  eventLabel.style.display = 'block';
  const deptObj = DEPTS.find(d => d.slug === deptSlug);
  const deptName = deptObj ? deptObj.name : deptSlug.toUpperCase();

  const events = getDepartmentEventsList(deptSlug);
  const allRegs = getAllRegistrations().filter(r => r.slug === deptSlug);

  let html = `<option value="all">All Events in ${deptName} (${allRegs.length} total)</option>`;

  events.forEach(ev => {
    const count = allRegs.filter(r => {
      const matchId = r.eventId && (r.eventId === ev.id);
      const matchTitle = matchEventTitle(r.event, ev.title);
      return matchId || matchTitle;
    }).length;
    html += `<option value="${esc(ev.id || ev.title)}">${esc(ev.title)} (${count} registered)</option>`;
  });

  eventSelect.innerHTML = html;
}

// ─── Real Excel (.xlsx) Export using SheetJS ──────────────────
function exportToExcel(slug, eventIdentifier = 'all') {
  syncLiveRegistrations();
  const allRegs = getAllRegistrations();
  let regs = (slug && slug !== 'all') ? allRegs.filter(r => r.slug === slug) : allRegs;

  let eventObj = null;
  if (slug && slug !== 'all' && eventIdentifier && eventIdentifier !== 'all') {
    const deptEvents = getDepartmentEventsList(slug);
    eventObj = deptEvents.find(e => e.id === eventIdentifier || (e.title && e.title.trim().toLowerCase() === eventIdentifier.trim().toLowerCase()));

    const targetTitle = (eventObj ? eventObj.title : eventIdentifier).trim().toLowerCase();
    const targetId = eventObj ? eventObj.id : eventIdentifier;

    regs = regs.filter(r => {
      const matchId = r.eventId && (r.eventId === targetId);
      const matchTitle = matchEventTitle(r.event, targetTitle);
      return matchId || matchTitle;
    });
  }

  if (!regs.length) {
    const eventName = eventObj ? eventObj.title : (eventIdentifier !== 'all' ? eventIdentifier : '');
    const msg = eventName
      ? `No registrations found for event: ${eventName}`
      : (slug && slug !== 'all' ? `No registrations found for ${slug.toUpperCase()}` : 'No registrations found to export');
    toast(msg, 'info');
    return;
  }

  // Format data with clear, professional headers
  const excelData = regs.map((r, i) => ({
    'Sl No': i + 1,
    'Registration ID': r.regId || '',
    'Participant Name': r.name || '',
    'College / Institution': r.college || '',
    'Email Address': r.email || '',
    'Phone Number': r.phone || '',
    'Department': (r.dept || r.slug || '').toUpperCase(),
    'Event Title': r.event || (eventObj ? eventObj.title : ''),
    'Entry Fee': r.fee || 'Free',
    'Team Members': r.team || 'Individual',
    'UPI Transaction ID / UTR': r.txnId || 'N/A',
    'Registration Timestamp': r.time ? new Date(r.time).toLocaleString('en-IN') : '',
  }));

  // Create workbook & worksheet
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for beautiful layout in Excel
  ws['!cols'] = [
    { wch: 8 },  // Sl No
    { wch: 18 }, // Reg ID
    { wch: 22 }, // Name
    { wch: 30 }, // College
    { wch: 26 }, // Email
    { wch: 16 }, // Phone
    { wch: 14 }, // Dept
    { wch: 26 }, // Event
    { wch: 12 }, // Fee
    { wch: 24 }, // Team
    { wch: 22 }, // Txn ID
    { wch: 24 }, // Time
  ];

  const wb = XLSX.utils.book_new();

  let rawSheet = 'All Registrations';
  if (slug && slug !== 'all') {
    if (eventObj) {
      rawSheet = eventObj.title;
    } else {
      rawSheet = slug.toUpperCase();
    }
  }
  const cleanSheetName = rawSheet.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);

  let filename = 'Tantra26_Master_Registrations.xlsx';
  if (slug && slug !== 'all') {
    if (eventObj) {
      const safeEvent = eventObj.title.replace(/[µμ]/g, 'mu').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      filename = `Tantra26_${slug.toUpperCase()}_${safeEvent}_Registrations.xlsx`;
    } else {
      filename = `Tantra26_${slug.toUpperCase()}_Registrations.xlsx`;
    }
  }

  XLSX.writeFile(wb, filename);
  toast(eventObj ? `Excel file downloaded for ${eventObj.title} ✓` : `Excel file downloaded ✓`);
}

// ─── Topbar Actions & Excel Export Logic ───────────────────────
function bindTopbar() {
  $('logout-btn').onclick = () => {
    sessionStorage.removeItem(SESS_KEY);
    location.reload();
  };

  $('export-excel-btn').onclick = () => {
    if (currentUser.role === 'dept_admin') {
      openExcelModal(currentUser.dept);
    } else {
      const defaultDept = (activeDept && ['events', 'regs'].includes(currentView)) ? activeDept : 'all';
      openExcelModal(defaultDept);
    }
  };
}

function bindExcelModal() {
  const modal = $('excel-modal');
  if (!modal) return;

  $('excel-modal-close').onclick  = closeExcelModal;
  $('excel-modal-cancel').onclick = closeExcelModal;
  modal.addEventListener('click', e => { if (e.target === modal) closeExcelModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeExcelModal(); });

  const deptSel = $('excel-dept-select');
  if (deptSel) {
    deptSel.addEventListener('change', () => {
      populateExcelEventOptions(deptSel.value);
    });
  }

  $('excel-modal-download').onclick = () => {
    const deptVal = (currentUser && currentUser.role === 'dept_admin')
      ? currentUser.dept
      : (deptSel ? deptSel.value : 'all');

    const eventSel = $('excel-event-select');
    const eventVal = eventSel ? eventSel.value : 'all';

    closeExcelModal();
    exportToExcel(deptVal, eventVal);
  };
}

function openExcelModal(defaultDept = 'all') {
  syncLiveRegistrations();
  const deptSel = $('excel-dept-select');
  const deptLabel = $('excel-dept-label');
  const modalHint = $('excel-modal-hint');

  if (currentUser && currentUser.role === 'dept_admin') {
    // Lock department to department admin's assigned department
    if (deptSel) deptSel.value = currentUser.dept;
    if (deptLabel) deptLabel.style.display = 'none';
    if (modalHint) {
      const deptObj = DEPTS.find(d => d.slug === currentUser.dept);
      modalHint.textContent = `Export registrations for ${deptObj ? deptObj.name : currentUser.dept.toUpperCase()}. Choose all events or a specific event below.`;
    }
    populateExcelEventOptions(currentUser.dept);
  } else {
    // Superadmin: allow choosing any department or all
    if (deptLabel) deptLabel.style.display = 'block';
    if (deptSel) {
      deptSel.value = defaultDept || 'all';
    }
    if (modalHint) {
      modalHint.textContent = 'Choose which department and specific event to export, or download a consolidated master file with all participants.';
    }
    populateExcelEventOptions(deptSel ? deptSel.value : 'all');
  }

  const modal = $('excel-modal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeExcelModal() {
  const modal = $('excel-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ─── Utility ──────────────────────────────────────────────────
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

try {
  document.documentElement.appendChild(document.createComment(' #TECHNOBLADENEVERDIES '));
} catch (_) {}

