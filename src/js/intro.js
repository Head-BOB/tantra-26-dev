/**
 * intro.js — Scroll-scrubbed intro animation for the landing page.
 * Drives: Ready scene → 3-2-1 countdown → rocket → final Tantra logo.
 *
 * Depends on: starfield.js (imported here)
 * Expects DOM elements matching original index.html structure.
 */

import { Field } from './starfield.js';

export function initIntro() {
  const E1 = 'cubic-bezier(.7,0,.2,1)';
  const OUT = 'cubic-bezier(.16,1,.3,1)';
  const $ = (x) => document.querySelector(x);

  // Logo letter elements
  const logoLetters = [...document.querySelectorAll('#tantra-svg .logo-let')];

  // Star field (single continuous field across rocket liftoff and logo reveal)
  const f1 = new Field($('#c1'), 220, true);

  // ---------- Easing helpers ----------
  const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const seg   = (t, s, d) => clamp((t - s) / d);
  const outX  = (v) => v >= 1 ? 1 : 1 - Math.pow(2, -10 * v);
  const io    = (v) => v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  const inQ   = (v) => Math.pow(v, 2.2);

  // Scene refs
  const s1    = $('#s1');
  const slabs = ['#n3', '#n2', '#n1'].map($);
  const rk    = $('#rk');
  const rocket = $('#rocket');
  const fin   = $('#fin');
  const logoEl = $('#logo');
  const l26   = $('#logo26');
  let logoAssembled = false;

  // Puff particles
  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'puff';
    const z = innerHeight * (0.03 + Math.random() * 0.05);
    p.style.cssText =
      `width:${z}px;height:${z}px;` +
      `left:${innerWidth / 2 - z / 2}px;` +
      `top:${innerHeight * 0.86 - z * 0.8}px`;
    rk.appendChild(p);
    puffs.push({
      e: p,
      d: Math.random() * 700,
      l: 1100 + Math.random() * 700,
      dx: (Math.random() < 0.5 ? -1 : 1) * innerWidth * (0.05 + Math.random() * 0.2),
      dy: (Math.random() - 0.2) * z,
    });
  }

  const hint = $('#hint');
  const readyHint = $('#ready-scroll-hint');
  let readyHintTimer = null;
  let readyHintVisible = false;

  function scheduleReadyHint() {
    clearTimeout(readyHintTimer);
    readyHintTimer = setTimeout(() => {
      const sc = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (sc < 15 && cur < 80 && readyHint) {
        readyHint.classList.add('visible');
        readyHintVisible = true;
      }
    }, 3000);
  }

  function dismissReadyHint() {
    clearTimeout(readyHintTimer);
    readyHintTimer = null;
    if (readyHint && readyHintVisible) {
      readyHint.classList.remove('visible');
      readyHintVisible = false;
    }
  }

  let sc0 = 0;

  const COUNTDOWN_STAGES = [
    { sIn: 2060, sHold: 2400, sOut: 2960, sEnd: 3300 }, // 3 (#n3)
    { sIn: 2960, sHold: 3300, sOut: 3860, sEnd: 4200 }, // 2 (#n2)
    { sIn: 3860, sHold: 4200, sOut: 4760, sEnd: 5100 }, // 1 (#n1)
  ];

  function render(t) {
    // Scene 1: "Ready?"
    if (t < 2060) {
      s1.style.visibility = 'visible';
      s1.style.opacity = 1;
    } else if (t < 2400) {
      s1.style.visibility = 'visible';
      s1.style.opacity = 1 - io(seg(t, 2060, 340));
    } else {
      s1.style.visibility = 'hidden';
      s1.style.opacity = 0;
    }

    // 3-2-1 countdown: in-place crossfade (fade out old, fade in next in the same place)
    slabs.forEach((e, i) => {
      const st = COUNTDOWN_STAGES[i];
      const isVis = t >= st.sIn - 20 && t < st.sEnd + 20;
      e.style.visibility = isVis ? 'visible' : 'hidden';
      e.style.transform = 'translate3d(0,0,0)';
      const b = e.querySelector('b');

      if (!isVis) {
        e.style.opacity = 0;
        if (b) b.style.opacity = 0;
        return;
      }

      // Stage background opacity (keeps background solid during exit so next stage cleanly overlays)
      if (t < st.sHold) {
        e.style.opacity = io(seg(t, st.sIn, st.sHold - st.sIn));
      } else {
        e.style.opacity = 1;
      }

      // Number text opacity and subtle in-place micro-scale
      if (b) {
        if (t < st.sHold) {
          const inP = io(seg(t, st.sIn, st.sHold - st.sIn));
          b.style.opacity = inP;
          b.style.transform = `scale(${1.04 - 0.04 * inP})`;
        } else if (t < st.sOut) {
          b.style.opacity = 1;
          b.style.transform = 'scale(1)';
        } else {
          const outP = io(seg(t, st.sOut, st.sEnd - st.sOut));
          b.style.opacity = 1 - outP;
          b.style.transform = `scale(${1 - 0.04 * outP})`;
        }
      }
    });

    // Rocket stage (seamless in-place fade in)
    const rkVis = t >= 4740;
    rk.style.visibility = rkVis ? 'visible' : 'hidden';
    rk.style.transform = 'translate3d(0,0,0)';
    if (rkVis) {
      const rkProg = io(seg(t, 4760, 340));
      rk.style.opacity = rkProg;
      const sh = seg(t, 5100, 1800);
      let x = 0, y = 0;
      if (sh > 0 && sh < 1) {
        const k = t * 0.09;
        x = Math.sin(k) * 3.5;
        y = Math.cos(k * 1.7) * 1.5;
      }
      const upProg = seg(t, 6900, 1300);
      const up = Math.pow(upProg, 2.4);
      const vh = window.innerHeight || 800;
      rocket.style.transform = `translate3d(${x}px,${y - up * 2.8 * vh}px,0)`;

      if (t >= 5050 && t <= 7800) {
        puffs.forEach((q) => {
          const u = clamp((t - 5100 - q.d) / q.l);
          const o = u <= 0 ? 0 : 0.8 * (1 - u);
          q.e.style.opacity = o;
          q.e.style.transform = `translate3d(${q.dx * u}px,${q.dy * u}px,0) scale(${0.4 + 2.2 * u})`;
        });
      } else {
        puffs.forEach((q) => { q.e.style.opacity = 0; });
      }
    } else {
      rk.style.opacity = 0;
      puffs.forEach((q) => { q.e.style.opacity = 0; });
    }

    // Final logo stage (seamless overlay on the same space background)
    if (t >= 10950) {
      logoAssembled = true;
    } else if (t < 7500) {
      logoAssembled = false;
    }

    const finVis = t >= 7570;
    fin.style.visibility = finVis ? 'visible' : 'hidden';
    if (finVis) {
      fin.style.transform = 'translate3d(0,0,0)';
      if (logoAssembled) {
        logoLetters.forEach((e) => {
          e.style.opacity = 1;
          e.setAttribute('transform', 'translate(0, 0)');
        });
        if (l26) {
          l26.setAttribute('opacity', 1);
          l26.setAttribute('transform', 'translate(0, 0)');
        }
      } else {
        logoLetters.forEach((e, j) => {
          const st2 = 8600 + j * 190;
          const p = outX(seg(t, st2, 600));
          e.style.opacity = p;
          e.setAttribute('transform', `translate(0, ${-45 * (1 - p)})`);
        });
        if (l26) {
          const p26 = outX(seg(t, 10250, 700));
          l26.setAttribute('opacity', p26);
          l26.setAttribute('transform', `translate(0, ${14 * (1 - p26)})`);
        }
      }
    } else {
      fin.style.transform = 'translate3d(0,0,0)';
      logoLetters.forEach((e) => {
        e.style.opacity = 0;
        e.setAttribute('transform', 'translate(0, -45)');
      });
      if (l26) {
        l26.setAttribute('opacity', 0);
        l26.setAttribute('transform', 'translate(0, 14)');
      }
    }

    hint.style.opacity = (logoAssembled ? 1 : seg(t, 10900, 400)) * (1 - clamp(sc0 / 60));

    // Star field speeds on the single continuous canvas
    if (t >= 8350) {
      f1.target = 24;
    } else if (t > 6900) {
      f1.target = 3200;
    } else {
      f1.target = 26;
      if (t < 6900) f1.speed = Math.min(f1.speed, 60);
    }
  }

  // ---------- Scroll driver & Stage Pacing ----------
  const T = 11400, PX = 0.6;
  const track = $('#track');
  let maxS = 0, cur = 0;
  let lastW = 0, lastH = 0;
  let baseVh = window.innerHeight || 800;

  function sizeTrack(force = false) {
    const nw = window.innerWidth || 1200;
    const nh = window.innerHeight || 800;
    // Don't resize track on mobile browser address-bar toggles (width unchanged, small height diff)
    if (!force && lastW > 0 && Math.abs(nw - lastW) === 0 && Math.abs(nh - lastH) < 160) return;
    lastW = nw;
    lastH = nh;
    baseVh = nh;
    maxS = T * PX;
    track.style.height = `${baseVh + maxS + baseVh * 0.7}px`;
  }
  sizeTrack(true);
  window.addEventListener('resize', () => sizeTrack(false));
  window.addEventListener('orientationchange', () => {
    lastW = 0;
    setTimeout(() => sizeTrack(true), 250);
  });

  // Key stage scroll positions (px)
  const STAGE_SCROLLS = [
    0,            // Stage 0: Ready?
    2600 * PX,    // Stage 1: 3 (~1560px)
    3500 * PX,    // Stage 2: 2 (~2100px)
    4400 * PX,    // Stage 3: 1 (~2640px)
    5100 * PX,    // Stage 4: Rocket ignition (~3060px)
  ];

  function getCurrentStageIndex() {
    const sc = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (sc >= maxS - 120) return 5; // Logo reveal / completed
    if (sc >= 2850) return 4;       // Rocket stage
    if (sc >= 2370) return 3;       // Number 1
    if (sc >= 1830) return 2;       // Number 2
    if (sc >= 800)  return 1;       // Number 3
    return 0;                       // Ready?
  }

  let isAutoScrolling = false;
  let autoScrollRaf = null;
  let isTransitioning = false;
  let transitionRaf = null;
  let countdownTimer = null;

  function cancelAutoScroll() {
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
    if (isAutoScrolling) {
      isAutoScrolling = false;
      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = null;
      }
    }
    if (transitionRaf) {
      cancelAnimationFrame(transitionRaf);
      transitionRaf = null;
    }
    isTransitioning = false;
  }

  function smoothScrollTo(targetY, duration = 460, onComplete) {
    if (transitionRaf) {
      cancelAnimationFrame(transitionRaf);
      transitionRaf = null;
    }
    isTransitioning = true;
    const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const dist = targetY - startY;
    if (Math.abs(dist) < 4) {
      window.scrollTo(0, targetY);
      isTransitioning = false;
      if (onComplete) onComplete();
      return;
    }
    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      // Smooth quintic ease-out: rapid departure, feathered landing
      const ease = 1 - Math.pow(1 - p, 4);
      window.scrollTo(0, Math.round(startY + dist * ease));
      if (p < 1) {
        transitionRaf = requestAnimationFrame(step);
      } else {
        window.scrollTo(0, targetY);
        isTransitioning = false;
        transitionRaf = null;
        if (onComplete) onComplete();
      }
    }
    transitionRaf = requestAnimationFrame(step);
  }

  function startAutoScroll() {
    if (isAutoScrolling) return;
    if (transitionRaf) {
      cancelAnimationFrame(transitionRaf);
      transitionRaf = null;
    }
    const startSc = window.pageYOffset || document.documentElement.scrollTop || 0;
    const targetSc = maxS;
    if (startSc >= targetSc - 120) return;

    isAutoScrolling = true;
    const startTime = performance.now();
    const totalDist = targetSc - startSc;
    const duration = Math.min(3400, Math.max(2000, totalDist * 0.85));

    function step(now) {
      if (!isAutoScrolling) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth cubic ease-in-out
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentY = Math.round(startSc + totalDist * eased);
      window.scrollTo(0, currentY);

      if (progress < 1 && isAutoScrolling) {
        autoScrollRaf = requestAnimationFrame(step);
      } else {
        window.scrollTo(0, targetSc);
        isAutoScrolling = false;
        autoScrollRaf = null;
      }
    }

    autoScrollRaf = requestAnimationFrame(step);
  }

  function startAutoCountdownFrom(fromIdx) {
    cancelAutoScroll();

    function stepTo(idx) {
      if (idx === 1) {
        // Ready? -> 3
        smoothScrollTo(STAGE_SCROLLS[1], 460, () => {
          countdownTimer = setTimeout(() => {
            stepTo(2);
          }, 680);
        });
      } else if (idx === 2) {
        // 3 -> 2
        smoothScrollTo(STAGE_SCROLLS[2], 420, () => {
          countdownTimer = setTimeout(() => {
            stepTo(3);
          }, 680);
        });
      } else if (idx === 3) {
        // 2 -> 1
        smoothScrollTo(STAGE_SCROLLS[3], 420, () => {
          countdownTimer = setTimeout(() => {
            stepTo(4);
          }, 680);
        });
      } else if (idx === 4) {
        // 1 -> Rocket launch pad
        smoothScrollTo(STAGE_SCROLLS[4], 440, () => {
          countdownTimer = setTimeout(() => {
            startAutoScroll();
          }, 180);
        });
      }
    }

    stepTo(fromIdx);
  }

  function goToNextStage() {
    dismissReadyHint();
    const idx = getCurrentStageIndex();
    if (idx === 0) {
      // From Ready? -> start full automatic countdown: 3 -> 2 -> 1 -> Rocket -> Tantra Logo!
      startAutoCountdownFrom(1);
    } else if (idx === 1) {
      startAutoCountdownFrom(2);
    } else if (idx === 2) {
      startAutoCountdownFrom(3);
    } else if (idx === 3) {
      startAutoCountdownFrom(4);
    } else if (idx === 4) {
      startAutoScroll();
    }
  }

  function goToPrevStage() {
    if (isTransitioning) return;
    cancelAutoScroll();
    dismissReadyHint();
    const idx = getCurrentStageIndex();
    if (idx >= 5) {
      smoothScrollTo(STAGE_SCROLLS[4], 420);
    } else if (idx === 4) {
      smoothScrollTo(STAGE_SCROLLS[3], 420);
    } else if (idx === 3) {
      smoothScrollTo(STAGE_SCROLLS[2], 420);
    } else if (idx === 2) {
      smoothScrollTo(STAGE_SCROLLS[1], 420);
    } else if (idx === 1) {
      smoothScrollTo(STAGE_SCROLLS[0], 380);
    } else {
      smoothScrollTo(0, 300);
    }
  }

  // Touch handling on mobile (prevents inertial fling past the intro to the footer)
  let touchStartY = 0;
  let touchActive = false;
  let lastTouchActionTime = 0;

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchActive = true;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!touchActive || e.touches.length !== 1) return;
    const sc = window.pageYOffset || document.documentElement.scrollTop || 0;
    const currentY = e.touches[0].clientY;
    const dy = touchStartY - currentY;

    if (Math.abs(dy) > 10) {
      dismissReadyHint();
    }

    // If user swipes downward during auto-countdown, cancel the auto-scroll without jumping backwards
    if (dy < -35 && (isAutoScrolling || countdownTimer)) {
      cancelAutoScroll();
    }

    // While in the initial countdown (Ready -> 3 -> 2 -> 1 -> Rocket), prevent inertial fling past the stages
    if (sc < STAGE_SCROLLS[4] && !isAutoScrolling) {
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    const sc = window.pageYOffset || document.documentElement.scrollTop || 0;

    // Once past the countdown stages, do NOT intercept touches or force reverse scroll!
    if (sc >= STAGE_SCROLLS[4]) {
      return;
    }

    const touchEndY = e.changedTouches[0].clientY;
    const dy = touchStartY - touchEndY; // positive = swipe up = scroll down

    const now = performance.now();
    if (now - lastTouchActionTime < 450 || isTransitioning) {
      return;
    }

    // Require intentional swipe distance (50px) to prevent accidental micro-movements
    if (Math.abs(dy) > 50) {
      lastTouchActionTime = now;
      if (dy > 0) {
        goToNextStage();
      } else if (sc > 30) {
        goToPrevStage();
      }
    }
  }, { passive: true });

  // Mouse wheel handling on desktop (debounced stage stepping in intro)
  let lastWheelTime = 0;
  window.addEventListener('wheel', (e) => {
    dismissReadyHint();
    const sc = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (sc < STAGE_SCROLLS[4]) {
      e.preventDefault();
      const now = performance.now();

      // Reverse scroll (upwards wheel): cancel auto-countdown immediately and step back
      if (e.deltaY < -10) {
        if (now - lastWheelTime < 280) return;
        lastWheelTime = now;
        goToPrevStage();
        return;
      }

      // Forward scroll (downwards wheel)
      if (e.deltaY > 10) {
        if (now - lastWheelTime < 380) return;
        lastWheelTime = now;
        goToNextStage();
      }
    } else {
      // In main site: allow scrolling back up into intro if at the very top
      if (e.deltaY < -18 && sc <= maxS + 25) {
        const now = performance.now();
        if (now - lastWheelTime >= 350) {
          lastWheelTime = now;
          goToPrevStage();
        }
      }
    }
  }, { passive: false });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    dismissReadyHint();
    const sc = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (sc < maxS - 15) {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNextStage();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevStage();
      }
    }
  });

  // Ready? screen idle scroll hint interaction
  if (readyHint) {
    readyHint.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismissReadyHint();
      goToNextStage();
    });
    readyHint.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dismissReadyHint();
        goToNextStage();
      }
    });
  }

  // Clicking "SCROLL" hint smoothly guides to departments
  if (hint) {
    hint.style.cursor = 'pointer';
    hint.addEventListener('click', () => {
      const depts = document.querySelector('#depts');
      if (depts) depts.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Clone Tantra SVG into footer logo
  const fl = $('#foot-logo');
  if (fl) {
    const cl = $('#tantra-svg').cloneNode(true);
    cl.removeAttribute('id'); cl.removeAttribute('style');
    [...cl.querySelectorAll('[id]')].forEach((n) => n.removeAttribute('id'));
    [...cl.querySelectorAll('.logo-let')].forEach((n) => { n.removeAttribute('transform'); n.style.opacity = 1; });
    const g = cl.lastElementChild;
    g.removeAttribute('opacity'); g.setAttribute('opacity', 1);
    fl.appendChild(cl);
  }

  function loop() {
    const sc = window.pageYOffset || document.documentElement.scrollTop || 0;
    const target = Math.min(sc / (maxS || 6360), 1) * T;
    cur += (target - cur) * 0.18;
    if (Math.abs(target - cur) < 0.5) cur = target;
    sc0 = Math.max(0, sc - maxS - baseVh * 0.7);
    const pp = Math.min(sc0 / baseVh, 1);
    fin.style.opacity = 1 - pp * 0.75;
    if (logoEl) logoEl.style.transform = pp > 0.01 ? `scale(${1 - pp * 0.12})` : 'none';
    render(cur);

    // Ready screen scroll hint: dismiss when user leaves screen 0, re-schedule if returning to top
    if (sc > 10 || cur > 80) {
      if (readyHintVisible) {
        dismissReadyHint();
      } else if (readyHintTimer) {
        clearTimeout(readyHintTimer);
        readyHintTimer = null;
      }
    } else if (sc <= 2 && cur < 40 && !readyHintVisible && !readyHintTimer) {
      scheduleReadyHint();
    }

    requestAnimationFrame(loop);
  }

  scrollTo(0, 0);
  render(0);
  scheduleReadyHint();
  requestAnimationFrame(loop);
}
