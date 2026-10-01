/**
 * dept-page.js — Shared logic for all department pages.
 * Supports on-site registration with multi-step sliding transition,
 * UPI QR code generation, transaction ID verification, and ticket pass confirmation.
 */

import QRCode from 'qrcode';
import { fetchDeptEvents, fetchDeptCoords, fetchDeptPayment, submitRegistration } from './api.js';
import { getEventMetadata } from '../data/all-events.js';

export function initDeptPage(CONFIG, EVENTS) {
  const $ = (x) => document.querySelector(x);
  const esc = (t) =>
    String(t).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  // ---- Admin data merge from localStorage with backend live sync ----
  const adminEvents = (() => {
    try {
      const store = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
      return store[CONFIG.slug] || [];
    } catch {
      return [];
    }
  })();
  const deletedEvents = (() => {
    try {
      const store = JSON.parse(localStorage.getItem('tantra26:admin:deleted_events') || '{}');
      return store[CONFIG.slug] || [];
    } catch {
      return [];
    }
  })();

  let allEvents = (() => {
    const base = EVENTS
      .filter(e => !deletedEvents.includes(e.id))
      .map(e => {
        const override = adminEvents.find(a => a.id === e.id);
        if (override) return { ...e, ...override, date: '7 Oct' };
        return { ...e, date: '7 Oct' };
      });
    const custom = adminEvents
      .filter(a => !EVENTS.some(s => s.id === a.id))
      .filter(a => !deletedEvents.includes(a.id))
      .map(e => ({ ...e, date: '7 Oct' }));
    return [...base, ...custom];
  })();

  let coordinators = (() => {
    try {
      const store = JSON.parse(localStorage.getItem('tantra26:admin:coords') || '{}');
      return store[CONFIG.slug] ?? CONFIG.coordinators;
    } catch {
      return CONFIG.coordinators;
    }
  })();

  // ---- Hero chips & Filter buttons ----
  let filt = 'All';
  const fl = $('#filters');

  function updateChipsAndFilters() {
    const types = {};
    allEvents.forEach((e) => { types[e.type] = 1; });
    $('#chips').innerHTML = [
      `<span class="chip">${allEvents.length} events</span>`,
      ...Object.keys(types).map((t) => `<span class="chip">${esc(t)}s</span>`),
    ].join('');

    fl.innerHTML = '';
    ['All', ...Object.keys(types)].forEach((t) => {
      const b = document.createElement('button');
      b.className = 'fb' + (t === filt ? ' on' : '');
      b.textContent = t === 'All' ? 'All' : t + 's';
      b.onclick = () => {
        filt = t;
        [...fl.children].forEach((x) => x.classList.toggle('on', x === b));
        draw();
      };
      fl.appendChild(b);
    });
  }
  updateChipsAndFilters();

  // ---- Registrations storage helpers ----
  const KEY = 'tantra26:registrations';
  function loadRegs() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  }
  function saveRegs(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
  }
  function isReg(id) {
    return loadRegs().some((r) => r.eventId === id && r.slug === CONFIG.slug);
  }

  // ---- Event cards ----
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
    { threshold: 0.12 }
  );

  function draw() {
    const g = $('#grid');
    g.innerHTML = '';
    allEvents.filter((e) => filt === 'All' || e.type === filt).forEach((e, i) => {
      const a = document.createElement('article');
      a.className = 'ev';
      a.style.transitionDelay = `${(i % 3) * 0.08}s`;
      const done = isReg(e.id);
      const regBtn = `<button class="reg${done ? ' done' : ''}" data-id="${esc(e.id)}"${done ? ' disabled' : ''}>${done ? 'Registered &#10003;' : 'Register <b>&rarr;</b>'}</button>`;
      a.innerHTML =
        `<div class="ev-top"><b>${esc(e.type)}</b><span>${esc(e.fee)}</span></div>` +
        `<div class="ev-body"><h3>${esc(e.title)}</h3><p class="desc">${esc(e.desc)}</p>` +
        `<dl class="meta"><dt>When</dt><dd>${esc(e.date)} &middot; ${esc(e.time)}</dd>` +
        `<dt>Where</dt><dd>${esc(e.venue)}</dd>` +
        `<dt>Team</dt><dd>${e.team > 1 ? 'Up to ' + e.team + ' members' : 'Individual'}</dd></dl>` +
        regBtn + `</div>`;
      g.appendChild(a);
      io.observe(a);
    });
  }
  draw();

  // ---- Coordinator contacts ----
  $('#coord').innerHTML = coordinators
    .map((c) => `<div><b>${esc(c.name)}</b>${esc(c.phone)}</div>`)
    .join('');

  // ---- Live async sync from backend / Supabase if available ----
  fetchDeptEvents(CONFIG.slug).then((backendEvents) => {
    if (backendEvents && Array.isArray(backendEvents) && backendEvents.length > 0) {
      allEvents = backendEvents;
      updateChipsAndFilters();
      draw();
      try {
        const store = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
        store[CONFIG.slug] = backendEvents;
        localStorage.setItem('tantra26:admin:events', JSON.stringify(store));
      } catch {}
    }
  });
  fetchDeptCoords(CONFIG.slug).then((backendCoords) => {
    if (backendCoords && Array.isArray(backendCoords) && backendCoords.length > 0) {
      coordinators = backendCoords;
      $('#coord').innerHTML = coordinators
        .map((c) => `<div><b>${esc(c.name)}</b>${esc(c.phone)}</div>`)
        .join('');
      try {
        const store = JSON.parse(localStorage.getItem('tantra26:admin:coords') || '{}');
        store[CONFIG.slug] = backendCoords.map(c => ({ name: c.name, phone: c.phone }));
        localStorage.setItem('tantra26:admin:coords', JSON.stringify(store));
      } catch {}
    }
  });
  fetchDeptPayment(CONFIG.slug).then((cloudPay) => {
    if (cloudPay) {
      try {
        const store = JSON.parse(localStorage.getItem('tantra26:admin:dept_payment') || '{}');
        store[CONFIG.slug] = {
          upiId: cloudPay.upi_id,
          qrImage: cloudPay.qr_image_url,
        };
        localStorage.setItem('tantra26:admin:dept_payment', JSON.stringify(store));
      } catch {}
    }
  });

  // ══════════════════════════════════════════════════════════════
  // REGISTRATION & UPI PAYMENT MODAL (SLIDING MULTI-STEP)
  // ══════════════════════════════════════════════════════════════
  const modal       = $('#modal');
  const slider      = $('#modal-slider');
  const detailsForm = $('#form');
  const payForm     = $('#pay-form');
  const UPI_ID      = 'tantra26@okhdfcbank';

  // Easter egg teaser suggestions for registration modal
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

  // Set initial teaser on load
  applyEasterEggPlaceholder(detailsForm);

  let curEvent    = null;
  let curData     = null;
  let isFreeEvent = false;

  function setStep(stepNum) {
    // Step 1: 0%, Step 2: -33.3333%, Step 3: -66.6667%
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

  // ── Schedule conflict detection ─────────────────────────────
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

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

  function getEventDurationHours(ev) {
    const id = (ev.id || ev.eventId || '').toLowerCase();
    const type = (ev.type || ev.etype || '').toLowerCase();
    const title = (ev.title || ev.event || '').toLowerCase();
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
    const allRegs = loadRegs();
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
      if (regEventId === targetEvent.id && r.slug === CONFIG.slug) return;

      const meta = getEventMetadata(regEventId, r.event || r.event_title, r.slug);
      const rDate = (r.date && !r.date.includes('T')) ? r.date : (meta ? meta.date : '7 Oct');
      const rTime = (r.time && /(AM|PM)/i.test(r.time)) ? r.time : (meta ? meta.time : '10:00 AM');
      const rStart = parseEventTime(rDate, rTime);
      if (!rStart) return;

      const rDurHours = getEventDurationHours(meta || r);
      const rEnd = rStart + rDurHours * 3600000;

      // Interval overlap: targetStart < rEnd && targetEnd > rStart
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

  let conflictConfirmed = false;

  function clearConflictWarning() {
    const existing = $('#conflict-overlay') || $('#crossover-box');
    if (existing) existing.remove();
  }

  function renderConflictWarning(conflicts, onConfirm) {
    clearConflictWarning();
    const targetDurHours = getEventDurationHours(curEvent);
    const curTimeRange = getTimeRangeString(curEvent.date, curEvent.time, targetDurHours);

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
          `<h4>${esc(curEvent.title)}</h4>` +
          `<p>${esc(CONFIG.dept)} &middot; ${esc(curEvent.date)} &middot; ${esc(curTimeRange)}</p>` +
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
      // If user hasn't filled form yet (i.e. warned right on clicking register), close modal
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

  function openModal(ev) {
    if (!ev) return;
    curEvent = ev;
    curData  = null;
    conflictConfirmed = false;
    clearConflictWarning();

    const feeRaw = String(ev.fee || '').trim();
    isFreeEvent  = /free|^₹?0$/i.test(feeRaw);

    // Header info
    $('#m-type').textContent = `${ev.type} · ${ev.date}`;
    $('#m-title').textContent = ev.title;

    // Badges
    const feeDisp = $('#m-fee-display');
    if (feeDisp) feeDisp.textContent = ev.fee || 'Free';
    const teamDisp = $('#m-team-display');
    if (teamDisp) teamDisp.textContent = ev.team > 1 ? `Team of ${ev.team}` : 'Individual';

    // Form setup
    detailsForm.reset();
    $('#err').textContent = '';
    applyEasterEggPlaceholder(detailsForm);
    const teamL = $('#team-l');
    if (teamL) teamL.style.display = ev.team > 1 ? 'grid' : 'none';

    // Step button label
    const subBtn = $('#sub');
    if (subBtn) {
      subBtn.disabled = false;
      subBtn.style.display = '';
      subBtn.textContent = isFreeEvent ? 'Complete Free Registration ✓' : 'Proceed to Payment →';
    }

    // Step dots for free events
    const dot2 = $('#step-dot-2');
    const line2 = $('#step-line-2');
    if (dot2) dot2.style.display = isFreeEvent ? 'none' : 'flex';
    if (line2) line2.style.display = isFreeEvent ? 'none' : 'block';

    setStep(1);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Check immediately for conflicts before user fills anything
    const earlyConflicts = findScheduleConflicts(curEvent);
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

  let isProcessing = false;

  function closeModal() {
    if (isProcessing) return;
    conflictConfirmed = false;
    clearConflictWarning();
    modal.classList.remove('open');
    document.body.style.overflow = '';
    draw();
  }

  // Card click delegation
  $('#grid').addEventListener('click', (e) => {
    const b = e.target.closest('button.reg');
    if (!b || b.disabled) return;
    openModal(allEvents.find((x) => x.id === b.dataset.id));
  });

  const mx = $('#m-x');
  if (mx) mx.onclick = closeModal;
  const okClose = $('#ok-close');
  if (okClose) okClose.onclick = closeModal;

  modal.addEventListener('click', (e) => {
    if (isProcessing) return;
    if (e.target === modal) closeModal();
  });
  addEventListener('keydown', (e) => {
    if (isProcessing) return;
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  // Reset conflict confirmation when form input changes
  detailsForm.addEventListener('input', () => {
    conflictConfirmed = false;
    clearConflictWarning();
  });

  // ── Step 1: Participant details submit ──────────────────────
  detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isProcessing) return;
    const f = detailsForm, err = $('#err');
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

    if (loadRegs().some((r) => r.eventId === curEvent.id && r.slug === CONFIG.slug && r.email.toLowerCase() === d.email.toLowerCase())) {
      err.textContent = 'This email is already registered for this event.';
      return;
    }
    err.textContent = '';
    curData = d;

    // Check for crossover / schedule conflict with already registered events
    if (!conflictConfirmed) {
      const conflicts = findScheduleConflicts(curEvent, d.email, d.phone);
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

  // ── Step 2: Prepare & render UPI QR code ────────────────────
  function preparePaymentStep() {
    // Check department-specific payment config from admin
    const deptPayments = (() => {
      try { return JSON.parse(localStorage.getItem('tantra26:admin:dept_payment') || '{}'); } catch { return {}; }
    })();
    const deptCfg = deptPayments[CONFIG.slug] || {};
    const upiId = deptCfg.upiId || `tantra26.${CONFIG.slug}@okhdfcbank`;
    const qrImage = deptCfg.qrImage; // Base64 data URL if uploaded

    const numFee = (curEvent.fee || '').replace(/[^0-9.]/g, '') || '100';
    const payAmtVal = $('#pay-amount-val');
    if (payAmtVal) payAmtVal.textContent = curEvent.fee || ('₹' + numFee);
    const instrAmt = $('#instr-amount');
    if (instrAmt) instrAmt.textContent = curEvent.fee || ('₹' + numFee);
    const upiIdText = $('#upi-id-text');
    if (upiIdText) upiIdText.textContent = upiId;
    const payErr = $('#pay-err');
    if (payErr) payErr.textContent = '';
    const txnInp = $('#pay-txn-id');
    if (txnInp) txnInp.value = '';

    const canvas = $('#pay-qr');
    const qrImg  = $('#pay-qr-img');

    if (qrImage) {
      // Use uploaded custom QR code image
      if (qrImg) {
        qrImg.src = qrImage;
        qrImg.style.display = 'block';
      }
      if (canvas) canvas.style.display = 'none';
    } else {
      // Fallback to dynamic UPI QR code generator
      if (qrImg) qrImg.style.display = 'none';
      if (canvas) {
        canvas.style.display = 'block';
        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Tantra%2026%20${encodeURIComponent(CONFIG.dept)}&am=${numFee}&tn=${encodeURIComponent(curEvent.title)}&cu=INR`;
        QRCode.toCanvas(canvas, upiUrl, {
          width: 135,
          margin: 1,
          color: { dark: '#101a2d', light: '#ffffff' }
        }, (error) => {
          if (error) console.error('QR code generation error:', error);
        });
      }
    }

    // Update copy button to copy this department's UPI ID
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

  // Back to step 1 buttons
  const payBackBtn = $('#pay-back-btn');
  if (payBackBtn) payBackBtn.onclick = () => { if (!isProcessing) setStep(1); };
  const payCancelBtn = $('#pay-cancel-btn');
  if (payCancelBtn) payCancelBtn.onclick = () => { if (!isProcessing) setStep(1); };

  // ── Step 2: Payment submission (UPI Txn ID verification) ────
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

      // Check if this transaction ID was already used across all registrations
      const cleanTxn = txnId.trim();
      const isTxnUsed = loadRegs().some((r) =>
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

  // ── Step 3: Finalize registration & slide to pass ───────────
  async function finalizeRegistration(txnId) {
    const payload = {
      dept_slug: CONFIG.slug,
      event_id: curEvent.id,
      event_title: curEvent.title,
      fee: curEvent.fee || 'Free',
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

    const regId = passRegId || ('T26-' + CONFIG.slug.toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());
    const rec = {
      slug:    CONFIG.slug,
      dept:    CONFIG.dept,
      eventId: curEvent.id,
      event:   curEvent.title,
      etype:   curEvent.type || 'Event',
      date:    curEvent.date || '7 Oct',
      time:    curEvent.time || '10:00 AM',
      venue:   curEvent.venue || 'Campus',
      fee:     curEvent.fee || 'Free',
      name:    curData.name,
      email:   curData.email,
      phone:   curData.phone,
      college: curData.college,
      team:    curData.team,
      txnId:   txnId,
      regId:   regId,
      regTime: new Date().toISOString(),
    };

    const list = loadRegs();
    list.unshift(rec);
    saveRegs(list);
    try { localStorage.setItem('tantra26:last_user_name', curData.name); } catch (_) {}

    populatePass(rec);
    setStep(3);
  }

  function populatePass(rec) {
    const ten = $('#ticket-event-name');
    if (ten) ten.textContent = curEvent.title;
    const tdt = $('#ticket-dept-tag');
    if (tdt) tdt.textContent = CONFIG.slug.toUpperCase();
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
      okMsg.textContent = `Registered for ${curEvent.title} on ${curEvent.date} at ${curEvent.time} in ${curEvent.venue}.`;
    }
  }

  try {
    document.documentElement.appendChild(document.createComment(' #TECHNOBLADENEVERDIES '));
  } catch (_) {}
}
