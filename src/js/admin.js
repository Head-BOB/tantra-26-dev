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
  apiSavePayment,
} from './api.js';

import { EVENTS as CSE_EV }   from '../data/events/cse.js';
import { EVENTS as AI_EV }    from '../data/events/ai.js';
import { EVENTS as CSD_EV }   from '../data/events/csd.js';
import { EVENTS as CSBS_EV }  from '../data/events/csbs.js';
import { EVENTS as EEE_EV }   from '../data/events/eee.js';
import { EVENTS as ECE_EV }   from '../data/events/ece.js';
import { EVENTS as AEI_EV }   from '../data/events/aei.js';
import { EVENTS as CIVIL_EV } from '../data/events/civil.js';
import { EVENTS as MECH_EV }  from '../data/events/mech.js';

import { CONFIG as CSE_CFG }   from '../data/events/cse.js';
import { CONFIG as AI_CFG }    from '../data/events/ai.js';
import { CONFIG as CSD_CFG }   from '../data/events/csd.js';
import { CONFIG as CSBS_CFG }  from '../data/events/csbs.js';
import { CONFIG as EEE_CFG }   from '../data/events/eee.js';
import { CONFIG as ECE_CFG }   from '../data/events/ece.js';
import { CONFIG as AEI_CFG }   from '../data/events/aei.js';
import { CONFIG as CIVIL_CFG } from '../data/events/civil.js';
import { CONFIG as MECH_CFG }  from '../data/events/mech.js';

// ─── Password & Role Mapping ───────────────────────────────────
// No usernames required — entering password immediately routes user
const AUTH_MAP = {
  // Super Admin (Central Admin)
  'u9rcDp': { role: 'superadmin', name: 'Central Admin' },

  // Computer Science & Engineering
  'zWHCaX': { role: 'dept_admin', dept: 'cse', name: 'Computer Science & Engineering' },

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
  cse: CSE_EV, ai: AI_EV, csd: CSD_EV, csbs: CSBS_EV, eee: EEE_EV, ece: ECE_EV, aei: AEI_EV, civil: CIVIL_EV, mech: MECH_EV,
};
const STATIC_COORDS = {
  cse: CSE_CFG.coordinators, ai: AI_CFG.coordinators, csd: CSD_CFG.coordinators, csbs: CSBS_CFG.coordinators,
  eee: EEE_CFG.coordinators, ece: ECE_CFG.coordinators, aei: AEI_CFG.coordinators, civil: CIVIL_CFG.coordinators, mech: MECH_CFG.coordinators,
};

// ─── Storage helpers ───────────────────────────────────────────
const EV_KEY         = 'tantra26:admin:events';
const DEL_EV_KEY     = 'tantra26:admin:deleted_events';
const CO_KEY         = 'tantra26:admin:coords';
const SESS_KEY       = 'tantra26:admin:session_user';
const REG_KEY        = 'tantra26:registrations';
const DEPT_PAY_KEY   = 'tantra26:admin:dept_payment';

const load = (k, fb = {}) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fb; } catch { return fb; } };
const save = (k, v)        => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function getAdminEvents() { return load(EV_KEY, {}); }
function setAdminEvents(d) { save(EV_KEY, d); }
function getDeletedEvents() { return load(DEL_EV_KEY, {}); }
function setDeletedEvents(d) { save(DEL_EV_KEY, d); }
function getAdminCoords() { return load(CO_KEY, {}); }
function setAdminCoords(d) { save(CO_KEY, d); }
function getAllRegistrations() { return load(REG_KEY, []); }
function getDeptPayments() { return load(DEPT_PAY_KEY, {}); }
function setDeptPayments(d) { save(DEPT_PAY_KEY, d); }

function allEventsFor(slug) {
  const admin = getAdminEvents()[slug] || [];
  const deleted = getDeletedEvents()[slug] || [];

  const base = (STATIC_EVENTS[slug] || [])
    .filter(e => !deleted.includes(e.id))
    .map(e => {
      const override = admin.find(a => a.id === e.id);
      if (override) return { ...e, ...override, date: '7 Oct', _source: 'admin' };
      return { ...e, date: '7 Oct', _source: 'default' };
    });

  const custom = admin
    .filter(a => !STATIC_EVENTS[slug]?.some(s => s.id === a.id))
    .filter(a => !deleted.includes(a.id))
    .map(e => ({ ...e, date: '7 Oct', _source: 'admin' }));

  return [...base, ...custom];
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

  // If department admin, immediately select their department
  if (currentUser.role === 'dept_admin') {
    selectDept(currentUser.dept);
  } else {
    selectDept(DEPTS[0].slug);
  }
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
    btn.classList.toggle('active', btn.dataset.slug === activeDept && !['central-qrs', 'central-regs'].includes(currentView));
  });

  // Central buttons active states
  $('nav-central-qrs').classList.toggle('active', currentView === 'central-qrs');
  $('nav-central-regs').classList.toggle('active', currentView === 'central-regs');

  updateRegsBadge();
}

function updateRegsBadge() {
  const allRegs = getAllRegistrations();
  const deptCount = activeDept ? allRegs.filter(r => r.slug === activeDept).length : 0;
  $('regs-badge').textContent = deptCount;
  $('central-regs-badge').textContent = allRegs.length;
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
        <h3>${esc(ev.title)}</h3>
        <p class="ev-desc">${esc(ev.desc)}</p>
        <dl class="ev-meta">
          <dt>When</dt><dd>${esc(ev.date || '7 Oct')} · ${esc(ev.time)}</dd>
          <dt>Where</dt><dd>${esc(ev.venue)}</dd>
          <dt>Team</dt><dd>${ev.team > 1 ? 'Up to ' + ev.team : 'Individual'}</dd>
        </dl>
      </div>
      <div class="ev-admin-footer">
        <button class="ev-edit-btn" title="Edit event details">Edit</button>
        <button class="ev-del-btn" title="Delete event">Delete</button>
      </div>`;

    card.querySelector('.ev-edit-btn').onclick = () => openEventModal(ev.id);
    card.querySelector('.ev-del-btn').onclick  = () => confirmDelete('event', ev.id, ev.title);
    eventsList.appendChild(card);
  });
}

// ─── Event Modal (Hardcoded 7 Oct Fest Date & Clean Time) ─────
function bindEventModal() {
  $('em-close').onclick = closeEventModal;
  $('em-cancel').onclick = closeEventModal;
  eventModal.addEventListener('click', e => { if (e.target === eventModal) closeEventModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && eventModal.classList.contains('open')) closeEventModal(); });
  addBtn.onclick = () => openEventModal(null);

  eventForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = eventForm;
    const err = $('em-err');
    const data = {
      title: f.title.value.trim(),
      type:  f.type.value,
      fee:   f.fee.value.trim(),
      date:  '7 Oct', // Fest date is strictly October 7
      time:  f.time.value.trim(),
      venue: f.venue.value.trim(),
      team:  parseInt(f.team.value) || 1,
      desc:  f.desc.value.trim(),
    };
    if (!data.title || !data.fee || !data.time || !data.venue || !data.desc) {
      err.textContent = 'Please fill in all required fields.';
      return;
    }
    err.textContent = '';

    const store = getAdminEvents();
    const slug  = activeDept;
    if (!store[slug]) store[slug] = [];

    const finalId = editingEventId || uid();
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

    // Sync with backend API
    apiSaveEvent({ ...data, dept_slug: slug, id: finalId }, !!editingEventId).catch(() => {});

    closeEventModal();
    refreshSidebar();
    renderStats(slug);
    renderEvents(slug);
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
      f.venue.value = ev.venue || '';
      f.team.value  = ev.team || 1;
      f.desc.value  = ev.desc || '';
    }
  } else {
    $('em-mode').textContent  = 'Add Event';
    $('em-title').textContent = 'New Event';
    f.date.value = '7 Oct';
    f.time.value = '10:00 AM';
  }

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
    const name  = $('cm-name').value.trim();
    const phone = $('cm-phone').value.trim();
    if (!name || !phone) { $('cm-err').textContent = 'Please fill in both fields.'; return; }
    $('cm-err').textContent = '';

    const store = getAdminCoords();
    const slug  = activeDept;
    if (!store[slug]) store[slug] = [...(STATIC_COORDS[slug] || [])];

    if (editingCoordIdx !== null) {
      store[slug][editingCoordIdx] = { name, phone };
      toast('Coordinator updated ✓');
    } else {
      store[slug].push({ name, phone });
      toast('Coordinator added ✓');
    }

    setAdminCoords(store);
    apiSaveCoord({ dept_slug: slug, name, phone }, editingCoordIdx).catch(() => {});
    closeCoordModal();
    renderCoords(slug);
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
      apiDeleteEvent(pendingDeleteId).catch(() => {});
      toast('Event deleted', 'info');
      refreshSidebar();
      renderStats(activeDept);
      renderEvents(activeDept);
    } else if (pendingDeleteType === 'coord') {
      const store  = getAdminCoords();
      const coords = allCoordsFor(activeDept);
      coords.splice(pendingDeleteId, 1);
      store[activeDept] = coords;
      setAdminCoords(store);
      apiDeleteCoord(pendingDeleteId).catch(() => {});
      toast('Organiser removed', 'info');
      renderCoords(activeDept);
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
    if (liveRegs && Array.isArray(liveRegs) && liveRegs.length > 0) {
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
      save(REG_KEY, formatted);
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

  $('central-dept-filter').onchange = () => {
    renderCentralRegs();
  };

  $('central-regs-search').oninput = () => {
    renderCentralRegs();
  };

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
        const payments = getDeptPayments();
        if (!payments[dept.slug]) payments[dept.slug] = {};
        payments[dept.slug].qrImage = dataUrl;
        payments[dept.slug].upiId = $(`upi-input-${dept.slug}`).value.trim() || upiId;
        setDeptPayments(payments);
        toast(`${dept.name} QR updated ✓`);
        renderCentralQRs();
      };
      reader.readAsDataURL(file);
    };

    // Save UPI ID button
    $(`save-qr-${dept.slug}`).onclick = () => {
      const newUpi = $(`upi-input-${dept.slug}`).value.trim();
      const payments = getDeptPayments();
      if (!payments[dept.slug]) payments[dept.slug] = {};
      payments[dept.slug].upiId = newUpi || upiId;
      setDeptPayments(payments);
      toast(`${dept.name} settings saved ✓`);
      renderCentralQRs();
    };

    // Reset button
    if (qrImage) {
      $(`reset-qr-${dept.slug}`).onclick = () => {
        const payments = getDeptPayments();
        if (payments[dept.slug]) {
          delete payments[dept.slug].qrImage;
          setDeptPayments(payments);
        }
        toast(`${dept.name} reverted to auto QR`, 'info');
        renderCentralQRs();
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
      const matchTitle = r.event && (r.event.trim().toLowerCase() === ev.title.trim().toLowerCase());
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
      const matchTitle = r.event && (r.event.trim().toLowerCase() === targetTitle);
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
      const safeEvent = eventObj.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
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

