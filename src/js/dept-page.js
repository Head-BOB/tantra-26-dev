/**
 * dept-page.js — Shared logic for all department pages.
 * Supports on-site registration with multi-step sliding transition,
 * UPI QR code generation, transaction ID verification, and ticket pass confirmation.
 */

import QRCode from 'qrcode';
import { fetchDeptEvents, fetchDeptCoords, fetchDeptPayment, submitRegistration } from './api.js';

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
  let allEvents = [...EVENTS, ...adminEvents];

  let coordinators = (() => {
    try {
      const store = JSON.parse(localStorage.getItem('tantra26:admin:coords') || '{}');
      return store[CONFIG.slug] ?? CONFIG.coordinators;
    } catch {
      return CONFIG.coordinators;
    }
  })();

  // ---- Hero chips ----
  const types = {};
  allEvents.forEach((e) => { types[e.type] = 1; });
  $('#chips').innerHTML = [
    `<span class="chip">${allEvents.length} events</span>`,
    ...Object.keys(types).map((t) => `<span class="chip">${esc(t)}s</span>`),
  ].join('');

  // ---- Filter buttons ----
  let filt = 'All';
  const fl = $('#filters');
  ['All', ...Object.keys(types)].forEach((t) => {
    const b = document.createElement('button');
    b.className = 'fb' + (t === 'All' ? ' on' : '');
    b.textContent = t === 'All' ? 'All' : t + 's';
    b.onclick = () => {
      filt = t;
      [...fl.children].forEach((x) => x.classList.toggle('on', x === b));
      draw();
    };
    fl.appendChild(b);
  });

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
      draw();
    }
  });
  fetchDeptCoords(CONFIG.slug).then((backendCoords) => {
    if (backendCoords && Array.isArray(backendCoords) && backendCoords.length > 0) {
      coordinators = backendCoords;
      $('#coord').innerHTML = coordinators
        .map((c) => `<div><b>${esc(c.name)}</b>${esc(c.phone)}</div>`)
        .join('');
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

  function openModal(ev) {
    if (!ev) return;
    curEvent = ev;
    curData  = null;
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
    const teamL = $('#team-l');
    if (teamL) teamL.style.display = ev.team > 1 ? 'grid' : 'none';

    // Step button label
    const subBtn = $('#sub');
    if (subBtn) {
      subBtn.disabled = false;
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
    setTimeout(() => {
      if (detailsForm.elements.name) detailsForm.elements.name.focus();
    }, 60);
  }

  function closeModal() {
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

  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

  // ── Step 1: Participant details submit ──────────────────────
  detailsForm.addEventListener('submit', (e) => {
    e.preventDefault();
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

    if (isFreeEvent) {
      finalizeRegistration('FREE-REGISTRATION');
    } else {
      preparePaymentStep();
      setStep(2);
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
  if (payBackBtn) payBackBtn.onclick = () => setStep(1);
  const payCancelBtn = $('#pay-cancel-btn');
  if (payCancelBtn) payCancelBtn.onclick = () => setStep(1);

  // ── Step 2: Payment submission (UPI Txn ID verification) ────
  if (payForm) {
    payForm.addEventListener('submit', (e) => {
      e.preventDefault();
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
      if (payErr) payErr.textContent = '';

      const payBtn = $('#pay-submit-btn');
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = 'Verifying…';
      }

      finalizeRegistration(txnId).finally(() => {
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.textContent = 'Finish Transaction →';
        }
      });
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
      if (err.message && err.message.includes('already registered')) {
        const payErr = $('#pay-err');
        if (payErr) payErr.textContent = err.message;
        throw err;
      }
      console.warn('Backend unavailable, persisting registration locally:', err);
    }

    const regId = passRegId || ('T26-' + CONFIG.slug.toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());
    const rec = {
      slug:    CONFIG.slug,
      dept:    CONFIG.dept,
      eventId: curEvent.id,
      event:   curEvent.title,
      fee:     curEvent.fee || 'Free',
      name:    curData.name,
      email:   curData.email,
      phone:   curData.phone,
      college: curData.college,
      team:    curData.team,
      txnId:   txnId,
      regId:   regId,
      time:    new Date().toISOString(),
    };

    const list = loadRegs();
    list.push(rec);
    saveRegs(list);

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
}
