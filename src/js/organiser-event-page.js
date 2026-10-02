/**
 * organiser-event-page.js — Logic for Tantra 26 Organiser Event Manager.
 * Handles event loading by 6-digit code, SlopGuard AI detection,
 * detailed description, competition guide & rules, coordinator contact,
 * registrations view, and client-side Excel (.xlsx) export.
 */

import { SlopGuard } from './slop-guard.js';
import { getAllEvents } from '../data/all-events.js';
import { getEventAccessCode } from './access-code.js';
import { apiFetchEventByCode, apiSaveOrganiserEvent } from './api.js';

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

const EV_KEY = 'tantra26:events';
const ADMIN_EV_KEY = 'tantra26:admin:events';
const DEL_EV_KEY = 'tantra26:admin:deleted_events';
const REG_KEY = 'tantra26:admin:registrations';
const DEMO_CODE = 'TANTRA26';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function readEvents() {
  try {
    return JSON.parse(localStorage.getItem(EV_KEY) || '{}');
  } catch {
    return {};
  }
}

function demoEvent(kind) {
  const b = {
    code: DEMO_CODE,
    slug: 'cse',
    id: 'code-rush',
    title: 'Code Rush',
    type: 'Competition',
    date: '7 Oct',
    time: '10:00 AM',
    venue: 'CS Lab 1',
    fee: '₹50',
    team: 1,
    desc: 'Timed competitive programming round.',
    details: '',
    banner: '',
    steps: [],
    rules: [],
    coord: { name: '', phone: '', email: '' },
  };
  if (kind === 'workshop') {
    b.id = 'git-deploy';
    b.title = 'Git & Deploy';
    b.type = 'Workshop';
    b.date = '8 Oct';
    b.time = '11:00 AM';
    b.venue = 'Seminar Hall';
    b.fee = 'Free';
  }
  if (kind === 'expo') {
    b.id = 'robo-expo';
    b.slug = 'mech';
    b.title = 'Robo Expo';
    b.type = 'Expo';
    b.date = '9 Oct';
    b.time = '10:00 AM';
    b.venue = 'Workshop Ground';
    b.fee = 'Free';
  }
  return b;
}

function loadEventByCode(rawCode) {
  const q = location.search;
  const demo = /[?&]demo(=(\w+))?/.exec(q);
  if (demo) return demoEvent(demo[2]);

  if (!rawCode) return null;
  const code = rawCode.trim().toUpperCase();

  // 1. Organiser records
  const s = readEvents();
  for (const k in s) {
    const item = s[k];
    if (item) {
      const c = (item.code || item.accessCode || '').toUpperCase();
      if (c === code) return item;
    }
  }

  // 2. Admin local dashboard events
  try {
    const adminEvents = JSON.parse(localStorage.getItem(ADMIN_EV_KEY) || '{}');
    const delEvents = JSON.parse(localStorage.getItem(DEL_EV_KEY) || '{}');
    for (const slug in adminEvents) {
      const list = adminEvents[slug] || [];
      const dels = delEvents[slug] || [];
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (dels.includes(e.id)) continue;
        const evCode = (e.accessCode || e.code || getEventAccessCode(e)).toUpperCase();
        if (evCode === code) {
          return {
            code,
            slug,
            id: e.id,
            title: e.title,
            type: e.type || 'Competition',
            date: e.date || '7 Oct',
            time: e.time || '10:00 AM',
            venue: e.venue || 'Campus',
            fee: e.fee || 'Free',
            team: e.team || 1,
            desc: e.desc || '',
            details: e.details || e.desc || '',
            banner: e.banner || '',
            steps: e.steps || [],
            rules: e.rules || [],
            coord: e.coord || { name: '', phone: '', email: '' },
          };
        }
      }
    }
  } catch {}

  // 3. Static catalog events
  const staticList = getAllEvents();
  for (let j = 0; j < staticList.length; j++) {
    const se = staticList[j];
    const seCode = (se.accessCode || se.code || getEventAccessCode(se)).toUpperCase();
    if (seCode === code) {
      return {
        code,
        slug: se.slug,
        id: se.id,
        title: se.title,
        type: se.type || 'Competition',
        date: se.date || '7 Oct',
        time: se.time || '10:00 AM',
        venue: se.venue || 'Campus',
        fee: se.fee || 'Free',
        team: se.team || 1,
        desc: se.desc || '',
        details: se.details || se.desc || '',
        banner: se.banner || '',
        steps: se.steps || [],
        rules: se.rules || [],
        coord: se.coord || { name: '', phone: '', email: '' },
      };
    }
  }

  if (code === DEMO_CODE) return demoEvent();
  return null;
}

function saveEvent(eventObj) {
  const s = readEvents();
  s[eventObj.slug + ':' + eventObj.id] = eventObj;
  try {
    localStorage.setItem(EV_KEY, JSON.stringify(s));
  } catch {}

  // Synchronize with tantra26:admin:events
  try {
    const adminEvents = JSON.parse(localStorage.getItem(ADMIN_EV_KEY) || '{}');
    if (adminEvents[eventObj.slug]) {
      const list = adminEvents[eventObj.slug];
      let found = false;
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === eventObj.id) {
          list[i].details = eventObj.details;
          list[i].banner = eventObj.banner;
          list[i].steps = eventObj.steps;
          list[i].rules = eventObj.rules;
          list[i].coord = eventObj.coord;
          found = true;
          break;
        }
      }
      if (!found) {
        list.push({ ...eventObj, accessCode: eventObj.code });
      }
      localStorage.setItem(ADMIN_EV_KEY, JSON.stringify(adminEvents));
    }
  } catch {}

  // Synchronize directly with cloud database (Supabase & Backend API)
  apiSaveOrganiserEvent(eventObj).catch((err) => {
    console.warn('[CloudSync] Warning saving organiser event to database:', err);
  });
}

function loadRegistrations(eventObj) {
  if (/[?&]demo/.test(location.search)) {
    const n = ['Asha Nair', 'Rahul Menon', 'Meera Joseph', 'Arjun Das', 'Sneha Pillai', 'Vishnu Raj', 'Anjali K', 'Nikhil Paul'];
    const c = ['VJEC', 'CET', 'NIT Calicut', 'GEC Thrissur', 'VJEC', 'Amal Jyothi', 'MEC Kochi', 'VJEC'];
    return n.map((x, i) => ({
      name: x,
      college: c[i],
      email: x.split(' ')[0].toLowerCase() + '@example.com',
      phone: '98765432' + (10 + i),
      team: i % 3 === 0 ? x.split(' ')[0] + ', Friend' : '',
      regId: 'T26-' + (eventObj.slug || 'GEN').toUpperCase() + '-' + (1000 + i * 37),
      regTime: new Date(Date.now() - i * 5400000).toISOString(),
    }));
  }
  try {
    const all = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
    return all.filter((r) => r.slug === eventObj.slug && (r.eventId === eventObj.id || r.event === eventObj.title));
  } catch {
    return [];
  }
}

// ─── Initialization ──────────────────────────────────────────────
let codeParam = (new URLSearchParams(location.search).get('code') || '').trim();
if (!codeParam) {
  try {
    const rawSess = sessionStorage.getItem('tantra26:organiser_session');
    if (rawSess) {
      const sess = JSON.parse(rawSess);
      if (sess && sess.accessCode) codeParam = sess.accessCode.trim();
    }
  } catch {}
}

// Ensure signout links clear organiser session
document.querySelectorAll('#signout, #gate-back, a[href*="organisers.html"]').forEach((el) => {
  el.addEventListener('click', () => {
    try {
      sessionStorage.removeItem('tantra26:organiser_session');
    } catch {}
  });
});

let dirty = false;

async function bootstrap() {
  if (!codeParam) {
    window.location.replace('/organisers.html');
    return;
  }

  // 1. Try local storage / static catalog first
  let ev = loadEventByCode(codeParam);

  // 2. If not present in local storage, fetch live from Supabase / Backend API
  if (!ev) {
    try {
      const cloudEv = await apiFetchEventByCode(codeParam);
      if (cloudEv) {
        ev = cloudEv;
        saveEvent(cloudEv);
      }
    } catch (err) {
      console.warn('Error fetching cloud event by code:', err);
    }
  }

  // 3. If still not found after cloud lookup
  if (!ev) {
    $('#app').hidden = true;
    $('#gate').hidden = false;
    $('#gate-msg').textContent = `Passcode "${codeParam}" was not found. Please double-check the 6-digit code or ask your department administrator.`;
    return;
  }

  // 4. Render the dashboard directly
  initDashboard(ev);
}

if (window.location.pathname.includes('organiser-event')) {
  bootstrap();
}

export function initDashboard(ev, onSignOut = null) {
  ev.steps = ev.steps || [];
  ev.rules = ev.rules || [];
  ev.coord = ev.coord || {};

  const activeCode = (ev.code || ev.accessCode || codeParam || '').toUpperCase();

  const signoutBtn = $('#signout');
  if (signoutBtn) {
    signoutBtn.onclick = (e) => {
      e.preventDefault();
      try { sessionStorage.removeItem('tantra26:organiser_session'); } catch {}
      if (typeof onSignOut === 'function') {
        onSignOut();
      } else {
        window.location.href = '/organisers?logout=1';
      }
    };
  }

  const isComp = ev.type === 'Competition';
  const D = DEPTS[ev.slug] || ['Department', '#e3a72f', '#141414', (ev.slug || 'T26').toUpperCase()];

  // In background, fetch freshest database state to update any remote changes
  apiFetchEventByCode(codeParam).then(fresh => {
    if (fresh && ev && !dirty) {
      if (fresh.details && fresh.details !== ev.details && !$('#details').value) {
        ev.details = fresh.details;
        $('#details').value = fresh.details;
      }
      if (fresh.banner && !$('#banner').value) {
        ev.banner = fresh.banner;
        $('#banner').value = fresh.banner;
      }
      if (fresh.coord && fresh.coord.name && !$('#c-name').value) {
        ev.coord = fresh.coord;
        $('#c-name').value = fresh.coord.name || '';
        $('#c-phone').value = fresh.coord.phone || '';
        $('#c-email').value = fresh.coord.email || '';
      }
    }
  }).catch(() => {});

  $('#gate').hidden = true;
  $('#app').hidden = false;
  document.title = `${ev.title} · Event Manager · Tantra 26`;

  function formatTitleSpan(text) {
    const symRe = /([µμΩωπΠλΛθΘαβγδΔσΣ∞≈≠≤≥±√∫°])/g;
    return esc(text).replace(symRe, '<span class="sym" style="text-transform:none;font-family:\'Inter\',system-ui,sans-serif;display:inline-block">$1</span>');
  }

  // Hero & overview
  const hero = $('#hero');
  hero.style.setProperty('--c', D[1]);
  hero.style.setProperty('--t', D[2]);
  $('#ghost').textContent = D[3];
  $('#h-title').innerHTML = formatTitleSpan(ev.title);
  $('#codechip').textContent = `Code: ${ev.code || codeParam.toUpperCase()}`;
  $('#h-chips').innerHTML = `<span class="chip">${esc(ev.type)}</span><span class="chip">${esc(D[0])}</span><span class="chip">${esc(ev.date)} &middot; ${esc(ev.time)}</span>`;

  const specs = [
    ['Event name', ev.title],
    ['Department', D[0]],
    ['Category', ev.type],
    ['Schedule', `${ev.date} · ${ev.time}`],
    ['Venue', ev.venue || 'Campus'],
    ['Registration fee', ev.fee || 'Free'],
    ['Team size', ev.team > 1 ? `Up to ${ev.team} members` : 'Individual (1 participant)'],
  ];

  const specsHtml = specs
    .map(([lbl, val]) => `<div class="ov-item"><span class="ov-lbl">${lbl}</span><span class="ov-val">${esc(val)}</span></div>`)
    .join('');

  const descHtml = ev.desc
    ? `<div class="ov-desc-wrap"><span class="ov-lbl">Preview description</span><p class="ov-desc-text">${esc(ev.desc)}</p></div>`
    : '';

  $('#over').innerHTML = `<div class="ov-specs">${specsHtml}</div>${descHtml}`;

  $('#preview').href = `/event.html?d=${encodeURIComponent(ev.slug)}&e=${encodeURIComponent(ev.id)}`;

  // Type visibility: competitions only get guide + rules
  document.querySelectorAll('[data-comp]').forEach((n) => {
    n.hidden = !isComp;
  });
  $('#about-h').textContent = isComp ? 'Detailed description' : `About this ${ev.type.toLowerCase()}`;

  const links = [
    ['s-over', 'Overview'],
    ['s-about', 'Description'],
  ].concat(isComp ? [['s-guide', 'Guide'], ['s-rules', 'Rules']] : [])
   .concat([['s-coord', 'Coordinator'], ['s-regs', 'Registrations']]);

  $('#jump').innerHTML = links.map((l) => `<a href="#${l[0]}">${l[1]}</a>`).join('');

  // Populate fields
  $('#banner').value = ev.banner || '';
  $('#details').value = ev.details || '';
  $('#c-name').value = ev.coord.name || '';
  $('#c-phone').value = ev.coord.phone || '';
  $('#c-email').value = ev.coord.email || '';

  function countChars() {
    const n = $('#details').value.length;
    $('#dcount').textContent = `${n} characters`;
  }
  countChars();

  function stepRow(s, i) {
    const d = document.createElement('div');
    d.className = 'it';
    d.innerHTML = `
      <div class="num">${i + 1}</div>
      <div class="f">
        <input data-slop="Step ${i + 1} title" placeholder="Step title (e.g. Report to the lab)" value="${esc(s.t || '')}">
        <textarea rows="2" data-slop="Step ${i + 1} details" placeholder="What happens in this step">${esc(s.x || '')}</textarea>
      </div>
      <div class="mv">
        <button type="button" data-a="up" aria-label="Move up">&uarr;</button>
        <button type="button" data-a="dn" aria-label="Move down">&darr;</button>
        <button type="button" data-a="rm" aria-label="Remove">&times;</button>
      </div>
    `;
    return d;
  }

  function ruleRow(r, i) {
    const d = document.createElement('div');
    d.className = 'it';
    d.innerHTML = `
      <div class="num">${i + 1}</div>
      <div class="f">
        <textarea rows="2" data-slop="Rule ${i + 1}" placeholder="Write one rule">${esc(r || '')}</textarea>
      </div>
      <div class="mv">
        <button type="button" data-a="rm" aria-label="Remove">&times;</button>
      </div>
    `;
    return d;
  }

  function relabel(box, kind) {
    [].forEach.call(box.children, (row, i) => {
      row.querySelector('.num').textContent = i + 1;
      const f = row.querySelectorAll('[data-slop]');
      if (kind === 's') {
        f[0].setAttribute('data-slop', `Step ${i + 1} title`);
        f[1].setAttribute('data-slop', `Step ${i + 1} details`);
      } else {
        f[0].setAttribute('data-slop', `Rule ${i + 1}`);
      }
    });
  }

  function drawStepsAndRules() {
    const sb = $('#steps');
    const rb = $('#rules');
    if (sb) sb.innerHTML = '';
    if (rb) rb.innerHTML = '';
    if (isComp) {
      ev.steps.forEach((s, i) => sb && sb.appendChild(stepRow(s, i)));
      ev.rules.forEach((r, i) => rb && rb.appendChild(ruleRow(r, i)));
    }
    SlopGuard.flagAll();
  }

  function pullFromDOM() {
    ev.banner = $('#banner').value.trim();
    ev.details = $('#details').value.trim();
    ev.coord = {
      name: $('#c-name').value.trim(),
      phone: $('#c-phone').value.trim(),
      email: $('#c-email').value.trim(),
    };
    if (isComp) {
      ev.steps = [].map.call($('#steps').children, (r) => {
        const f = r.querySelectorAll('input,textarea');
        return { t: f[0].value.trim(), x: f[1].value.trim() };
      });
      ev.rules = [].map.call($('#rules').children, (r) => r.querySelector('textarea').value.trim());
    }
  }

  if (isComp) {
    if (!ev.steps.length) ev.steps = [{ t: '', x: '' }];
    if (!ev.rules.length) ev.rules = [''];
  }
  drawStepsAndRules();

  function markDirty() {
    dirty = true;
    const s = $('#status');
    s.textContent = 'Unsaved changes';
    s.className = 'status dirty';
  }

  document.addEventListener('input', (e) => {
    if (e.target.closest('main')) {
      markDirty();
      if (e.target.id === 'details') countChars();
    }
  });

  if ($('#addstep')) {
    $('#addstep').onclick = () => {
      pullFromDOM();
      ev.steps.push({ t: '', x: '' });
      drawStepsAndRules();
      markDirty();
      $('#steps').lastElementChild.querySelector('input').focus();
    };
  }

  if ($('#addrule')) {
    $('#addrule').onclick = () => {
      pullFromDOM();
      ev.rules.push('');
      drawStepsAndRules();
      markDirty();
      $('#rules').lastElementChild.querySelector('textarea').focus();
    };
  }

  function mover(box, kind) {
    if (!box) return;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const row = b.closest('.it');
      const a = b.dataset.a;
      if (a === 'rm') {
        if (box.children.length <= 1) {
          row.querySelectorAll('input,textarea').forEach((x) => { x.value = ''; });
          return;
        }
        row.remove();
      }
      if (a === 'up' && row.previousElementSibling) {
        box.insertBefore(row, row.previousElementSibling);
      }
      if (a === 'dn' && row.nextElementSibling) {
        box.insertBefore(row.nextElementSibling, row);
      }
      relabel(box, kind);
      markDirty();
    });
  }
  mover($('#steps'), 's');
  mover($('#rules'), 'r');

  // Save handler with SlopGuard check
  function toast(m, bad) {
    const t = $('#toast');
    t.textContent = m;
    t.className = 'toast on' + (bad ? ' bad' : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => {
      t.className = 'toast';
    }, 3600);
  }

  $('#save').onclick = () => {
    if (!SlopGuard.check()) return; // Em dash found: modal opens, saving is aborted

    pullFromDOM();
    const miss = [];
    if (ev.details.length < 20) miss.push('write a description (at least 20 characters)');
    if (isComp && !ev.steps.some((s) => s.t && s.x)) miss.push('add at least one guide step with title and details');
    if (isComp && !ev.rules.some(Boolean)) miss.push('add at least one rule');
    if (!ev.coord.name || !(ev.coord.phone || ev.coord.email)) miss.push('add the coordinator name and a phone or email');

    if (miss.length > 0) {
      return toast(`Please ${miss.join(', ')}.`, true);
    }

    if (isComp) {
      ev.steps = ev.steps.filter((s) => s.t || s.x);
      ev.rules = ev.rules.filter(Boolean);
      drawStepsAndRules();
    }

    saveEvent(ev);
    dirty = false;
    const s = $('#status');
    s.textContent = `Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    s.className = 'status';
    toast('Saved ✓ The public event page is updated.');
  };

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ─── Registrations & Excel Exporter ──────────────────────────
  let regs = [];
  function fmt(t) {
    const d = new Date(t);
    return isNaN(d) ? '' : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function drawRegs() {
    regs = loadRegistrations(ev).sort((a, b) => new Date(b.regTime) - new Date(a.regTime));
    const cols = {};
    regs.forEach((r) => { cols[(r.college || '').trim().toLowerCase()] = 1; });
    const day = regs.filter((r) => Date.now() - new Date(r.regTime) < 864e5).length;
    const teams = regs.filter((r) => r.team).length;

    $('#stats').innerHTML = [
      [regs.length, 'Registrations'],
      [Object.keys(cols).length, 'Colleges'],
      [teams, 'Team entries'],
      [day, 'Last 24 hours'],
    ].map((s) => `<div class="stat"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('');

    const q = $('#q').value.trim().toLowerCase();
    const rows = regs.filter((r) => !q || [r.name, r.college, r.email, r.regId, r.phone].join(' ').toLowerCase().indexOf(q) > -1);

    $('#tb').innerHTML = rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.college)}</td><td>${esc(r.email)}</td>` +
      `<td>${esc(r.phone)}</td><td>${esc(r.team || '-')}</td><td>${esc(r.regId)}</td><td>${esc(fmt(r.regTime))}</td></tr>`
    ).join('');

    $('#noregs').hidden = rows.length > 0;
  }

  $('#q').addEventListener('input', drawRegs);
  $('#refresh').onclick = () => {
    drawRegs();
    toast('Registrations refreshed.');
  };
  drawRegs();
  setInterval(() => {
    if (document.activeElement !== $('#q')) drawRegs();
  }, 20000);

  // Pure JS .xlsx generation without external libraries
  function crc(b) {
    let t = crc.t;
    if (!t) {
      t = crc.t = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
    }
    let c = -1;
    for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const cd = [];
    let off = 0;

    files.forEach((f) => {
      const nm = enc.encode(f.n);
      const d = enc.encode(f.d);
      const c = crc(d);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(12, 0x21, true);
      h.setUint32(14, c, true);
      h.setUint32(18, d.length, true);
      h.setUint32(22, d.length, true);
      h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, d);

      const e = new DataView(new ArrayBuffer(46));
      e.setUint32(0, 0x02014b50, true);
      e.setUint16(4, 20, true);
      e.setUint16(6, 20, true);
      e.setUint16(14, 0x21, true);
      e.setUint32(16, c, true);
      e.setUint32(20, d.length, true);
      e.setUint32(24, d.length, true);
      e.setUint16(28, nm.length, true);
      e.setUint32(42, off, true);
      cd.push(new Uint8Array(e.buffer), nm);
      off += 30 + nm.length + d.length;
    });

    const cl = cd.reduce((a, b) => a + b.length, 0);
    const z = new DataView(new ArrayBuffer(22));
    z.setUint32(0, 0x06054b50, true);
    z.setUint16(8, files.length, true);
    z.setUint16(10, files.length, true);
    z.setUint32(12, cl, true);
    z.setUint32(16, off, true);

    return new Blob(parts.concat(cd, [new Uint8Array(z.buffer)]), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  const xe = (t) => String(t == null ? '' : t)
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

  function makeXlsx(rows) {
    const R = (n) => String.fromCharCode(65 + n);
    const x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const sheet = x +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="8" width="26" customWidth="1"/></cols>' +
      '<sheetData>' +
      rows.map((r, i) =>
        `<row r="${i + 1}">` +
        r.map((v, j) => `<c r="${R(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`).join('') +
        '</row>'
      ).join('') +
      '</sheetData></worksheet>';

    return zip([
      {
        n: '[Content_Types].xml',
        d: x + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '</Types>',
      },
      {
        n: '_rels/.rels',
        d: x + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      },
      {
        n: 'xl/workbook.xml',
        d: x + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="Registrations" sheetId="1" r:id="rId1"/></sheets></workbook>',
      },
      {
        n: 'xl/_rels/workbook.xml.rels',
        d: x + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '</Relationships>',
      },
      { n: 'xl/worksheets/sheet1.xml', d: sheet },
    ]);
  }

  $('#export').onclick = () => {
    if (!regs.length) return toast('There are no registrations to export yet.', true);
    const rows = [
      ['#', 'Name', 'College', 'Email', 'Phone', 'Team members', 'Reg ID', 'Registered at'],
    ].concat(regs.map((r, i) => [i + 1, r.name, r.college, r.email, r.phone, r.team || '', r.regId, fmt(r.regTime)]));

    const u = URL.createObjectURL(makeXlsx(rows));
    const a = document.createElement('a');
    a.href = u;
    a.download = `${ev.title.replace(/\W+/g, '-').toLowerCase()}-registrations.xlsx`;
    a.click();
    setTimeout(() => { URL.revokeObjectURL(u); }, 800);
    toast(`Exported ${regs.length} registrations to Excel ✓`);
  };
}
