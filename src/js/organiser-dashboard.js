/**
 * organiser-dashboard.js — Controller for Event Organiser / Coordinator Dashboard.
 * Displays real-time participants, statistics, search/filtering, and XLSX export.
 */

import * as XLSX from 'xlsx';
import { fetchAdminRegistrations } from './api.js';

const SESS_KEY = 'tantra26:organiser_session';
const REG_KEY  = 'tantra26:admin:registrations';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let session = null;
let currentEvent = null;
let allRegistrations = [];
let filteredRegistrations = [];

// ─── Initialization ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

function initDashboard() {
  const rawSession = sessionStorage.getItem(SESS_KEY);
  if (!rawSession) {
    window.location.href = '/organisers.html';
    return;
  }

  try {
    session = JSON.parse(rawSession);
  } catch {
    window.location.href = '/organisers.html';
    return;
  }

  if (!session || !session.event) {
    window.location.href = '/organisers.html';
    return;
  }

  currentEvent = session.event;

  // Bind topbar & hero
  renderEventDetails();

  // Bind action listeners
  $('signout-btn').onclick = handleSignOut;
  $('refresh-btn').onclick = () => loadEventRegistrations(true);
  $('export-excel-btn').onclick = exportToExcel;
  $('search-box').addEventListener('input', handleSearch);

  // Load participants
  loadEventRegistrations();
}

function handleSignOut() {
  sessionStorage.removeItem(SESS_KEY);
  window.location.href = '/organisers.html?logout=1';
}

function renderEventDetails() {
  const ev = currentEvent;
  const deptName = ev.dept || ev.dept_slug?.toUpperCase() || 'Department';
  const code = session.accessCode || ev.accessCode || '------';

  document.title = `${ev.title} · Coordinator Dashboard · Tantra 26`;

  $('dept-badge').textContent = deptName;
  $('code-badge').textContent = code;

  $('hero-dept-name').textContent = deptName;
  $('hero-event-title').textContent = ev.title || 'Event Name';
  $('hero-event-desc').textContent = ev.desc || ev.description || 'No description provided.';

  $('chip-when').textContent = `${ev.date || '7 Oct'} · ${ev.time || '10:00 AM'}`;
  $('chip-where').textContent = ev.venue || 'Campus';
  $('chip-fee').textContent = ev.fee || 'Free';
  $('chip-team').textContent = ev.team > 1 ? `Up to ${ev.team} members` : 'Individual';
  $('chip-type').textContent = ev.type || 'Event';
}

// ─── Data Loading ──────────────────────────────────────────────
async function loadEventRegistrations(showToast = false) {
  const ev = currentEvent;
  const evId = String(ev.id || '').trim();
  const evTitle = String(ev.title || '').trim().toLowerCase();
  const deptSlug = (ev.slug || ev.dept_slug || '').toLowerCase();

  let cloudList = [];
  try {
    const fetched = await fetchAdminRegistrations(deptSlug);
    if (Array.isArray(fetched)) {
      cloudList = fetched;
    }
  } catch (err) {
    console.warn('Could not fetch cloud registrations:', err);
  }

  // Local storage fallback
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
  } catch {}

  // Filter matching this specific event
  const combined = [...cloudList, ...localList].filter(r => {
    const rId = String(r.eventId || r.event_id || '').trim();
    const rTitle = String(r.event || r.event_title || '').trim().toLowerCase();
    const rSlug = String(r.slug || r.dept_slug || '').trim().toLowerCase();

    const matchesId = evId && rId === evId;
    const matchesTitle = evTitle && rTitle === evTitle;
    const matchesDept = !deptSlug || !rSlug || rSlug === deptSlug;

    return (matchesId || matchesTitle) && matchesDept;
  });

  // Deduplicate by regId or id
  const seen = new Set();
  allRegistrations = [];

  combined.forEach(r => {
    const uniqueKey = r.regId || r.reg_id || r.id || `${r.email}-${r.eventId}`;
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      allRegistrations.push(normalizeRegistration(r));
    }
  });

  // Sort descending by registration timestamp
  allRegistrations.sort((a, b) => new Date(b.regTime) - new Date(a.regTime));

  filteredRegistrations = [...allRegistrations];
  renderStats();
  renderTable();

  if (showToast) {
    const refreshBtn = $('refresh-btn');
    refreshBtn.textContent = 'Updated ✓';
    setTimeout(() => { refreshBtn.textContent = 'Refresh'; }, 1500);
  }
}

function normalizeRegistration(r) {
  return {
    regId: r.regId || r.reg_id || r.id || 'T26-PASS',
    name: r.name || r.participant_name || 'Anonymous',
    email: r.email || '',
    phone: r.phone || '',
    college: r.college || r.college_name || 'Not provided',
    team: r.team || r.team_name || '',
    fee: r.fee || currentEvent.fee || 'Free',
    txnid: r.txnid || r.txn_id || r.upi_txnid || r.upi_txn_id || '',
    regTime: r.regTime || r.reg_time || r.created_at || new Date().toISOString(),
  };
}

// ─── Stats Rendering ───────────────────────────────────────────
function renderStats() {
  const count = allRegistrations.length;
  $('stat-count').textContent = count;
  $('reg-badge-count').textContent = count;

  // Teams calculation
  const teams = new Set();
  allRegistrations.forEach(r => {
    if (r.team && r.team.trim()) teams.add(r.team.trim().toLowerCase());
  });
  $('stat-teams').textContent = teams.size > 0 ? teams.size : count;

  // Fee Volume calculation
  let totalFee = 0;
  const feeStr = currentEvent.fee || '';
  const numMatch = feeStr.replace(/,/g, '').match(/\d+/);
  if (numMatch) {
    const unitFee = parseInt(numMatch[0], 10);
    totalFee = unitFee * count;
    $('stat-fees').textContent = `₹${totalFee.toLocaleString('en-IN')}`;
  } else {
    $('stat-fees').textContent = 'Free';
  }

  // Verified UPI Transactions
  const verifiedCount = allRegistrations.filter(r => r.txnid && r.txnid.trim().length >= 6 && r.txnid !== 'FREE-REGISTRATION' && r.txnid !== 'PAY-AT-VENUE').length;
  $('stat-verified').textContent = verifiedCount;
}

// ─── Table Rendering ───────────────────────────────────────────
function renderTable() {
  const tbody = $('participants-tbody');
  const emptyBox = $('empty-box');
  const tableWrap = $('table-wrap');

  tbody.innerHTML = '';

  if (filteredRegistrations.length === 0) {
    tableWrap.hidden = true;
    emptyBox.hidden = false;
    return;
  }

  tableWrap.hidden = false;
  emptyBox.hidden = true;

  filteredRegistrations.forEach(r => {
    const tr = document.createElement('tr');

    const formattedDate = formatDateTime(r.regTime);
    const isPayVenue = r.txnid === 'PAY-AT-VENUE' || (r.fee && /pay\s+at\s+venue/i.test(r.fee));
    const txnBadge = isPayVenue
      ? `<span class="txn-pill" style="background:rgba(217,119,6,0.18);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)" title="Entry fee to be collected at venue desk">Pay at Venue</span>`
      : r.txnid === 'FREE-REGISTRATION'
      ? `<span class="txn-pill" style="background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3)" title="Free Entry">Free</span>`
      : r.txnid
      ? `<span class="txn-pill" title="UPI Transaction ID">${esc(r.txnid)}</span>`
      : `<span style="opacity:0.4;font-size:11px">Pending / Cash</span>`;

    const teamBadge = r.team
      ? `<span class="team-pill">${esc(r.team)}</span>`
      : `<span style="opacity:0.4;font-size:11.5px">Individual</span>`;

    tr.innerHTML = `
      <td><span class="pass-id">${esc(r.regId)}</span></td>
      <td>
        <strong class="participant-name">${esc(r.name)}</strong>
      </td>
      <td>
        <div><a href="mailto:${esc(r.email)}" style="color:var(--gold);text-decoration:underline;">${esc(r.email)}</a></div>
        <div class="participant-sub"><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></div>
      </td>
      <td>${esc(r.college)}</td>
      <td>${teamBadge}</td>
      <td>${txnBadge}</td>
      <td style="white-space:nowrap;font-size:.82rem;color:rgba(239,232,218,0.65)">${esc(formattedDate)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

// ─── Search Filtering ──────────────────────────────────────────
function handleSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    filteredRegistrations = [...allRegistrations];
  } else {
    filteredRegistrations = allRegistrations.filter(r => {
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.college.toLowerCase().includes(q) ||
        r.team.toLowerCase().includes(q) ||
        r.regId.toLowerCase().includes(q) ||
        r.txnid.toLowerCase().includes(q)
      );
    });
  }
  renderTable();
}

// ─── Excel Export (.xlsx) ──────────────────────────────────────
function exportToExcel() {
  if (allRegistrations.length === 0) {
    alert('No participants to export yet.');
    return;
  }

  const ev = currentEvent;
  const cleanTitle = (ev.title || 'event').replace(/[µμ]/g, 'mu').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Tantra26_${cleanTitle}_Participants.xlsx`;

  // Prepare data rows
  const rows = allRegistrations.map((r, idx) => ({
    'Sl. No.': idx + 1,
    'Pass ID': r.regId,
    'Participant Name': r.name,
    'Email Address': r.email,
    'Phone Number': r.phone,
    'College / Institution': r.college,
    'Team Name': r.team || 'Individual',
    'Event Name': ev.title,
    'Department': ev.dept || ev.slug?.toUpperCase() || 'Tantra 26',
    'Entry Fee': r.fee || ev.fee || 'Free',
    'UPI Transaction ID / UTR': r.txnid === 'PAY-AT-VENUE' ? 'Pay at Venue' : (r.txnid || 'N/A'),
    'Registration Timestamp': r.regTime,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 8 },  // Sl No
    { wch: 18 }, // Pass ID
    { wch: 24 }, // Name
    { wch: 28 }, // Email
    { wch: 16 }, // Phone
    { wch: 32 }, // College
    { wch: 18 }, // Team
    { wch: 26 }, // Event
    { wch: 24 }, // Dept
    { wch: 12 }, // Fee
    { wch: 24 }, // UPI Txn ID
    { wch: 24 }, // Timestamp
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

  XLSX.writeFile(workbook, filename);
}
