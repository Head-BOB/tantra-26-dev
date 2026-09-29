/**
 * clock-sound.js — Premium atmospheric mechanical clock ticking sound effect for the Launch Countdown section (#launch).
 *
 * Exact sound synthesis from Step 1852 with rich, audible, clear volume:
 * - Warm, organic wood-and-felt mechanical escapement tick (pleasing, authentic, non-piercing).
 * - Warm bandpass-filtered noise tap + acoustic body resonance.
 * - Alternates between warm tick (~490Hz) and deeper tock (~380Hz).
 * - Full, comfortable, clearly audible volume (~0.75 master gain).
 * - Smoothly fades in as #launch enters the viewport.
 * - Perfectly synchronized with countdown seconds decrements.
 * - Flowingly fades out to absolute silence when scrolling past #launch into the footer.
 * - Robust auto-unlocking across all mobile & desktop browsers.
 */

// #TECHNOBLADENEVERDIES

export function initLaunchCountdownAudio() {
  const launchEl = document.getElementById('launch') || document.getElementById('cd');
  if (!launchEl) return { onSecondTick: () => {}, updateVolume: () => {}, destroy: () => {} };

  let audioCtx = null;
  let masterGain = null;
  let isTock = false;
  let currentVolume = 0;
  let isUnlocked = false;

  function getAudioContext() {
    if (!audioCtx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          masterGain = audioCtx.createGain();
          masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
          masterGain.connect(audioCtx.destination);
        }
      } catch {
        audioCtx = null;
      }
    }
    return audioCtx;
  }

  function unlock() {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (!isUnlocked) {
      try {
        // Silent 1-sample buffer activation for iOS Safari & mobile devices
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        isUnlocked = true;
      } catch {
        // Buffer error safe ignore
      }
    }
  }

  // Auto-unlock on any user interaction (touch, scroll, wheel, pointer, click, key)
  const GESTURE_EVENTS = ['touchstart', 'touchend', 'touchmove', 'pointerdown', 'mousedown', 'wheel', 'scroll', 'keydown', 'click'];
  function onGesture() {
    unlock();
    if (audioCtx && audioCtx.state === 'running' && isUnlocked) {
      GESTURE_EVENTS.forEach((e) => window.removeEventListener(e, onGesture, true));
    }
  }
  GESTURE_EVENTS.forEach((e) => {
    window.addEventListener(e, onGesture, { passive: true, capture: true });
  });

  unlock();
  launchEl.addEventListener('pointerdown', unlock, { passive: true });

  /**
   * Premium organic mechanical clock tick (exact Step 1852 synthesis).
   * Warm bandpass-filtered noise transient + acoustic body resonance.
   * Mastered at a full, clearly audible volume.
   */
  function playTickSound(tock = false) {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playTickSound(tock)).catch(() => {});
      return;
    }

    if (!masterGain || currentVolume <= 0.01) return;

    try {
      const now = ctx.currentTime;
      const baseFreq = tock ? 380 : 490;
      const gainScale = tock ? 0.88 : 1.0;

      // 1. Soft mechanical transient (escapement tooth tap)
      const bufferLength = Math.floor(ctx.sampleRate * 0.024);
      const noiseBuffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
      const channelData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLength; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(baseFreq * 1.6, now);
      bandpass.Q.setValueAtTime(2.6, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.65 * gainScale, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      noiseSource.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start(now);

      // 2. Warm wooden body resonance (smooth, muted sine tone)
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(baseFreq, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.84, now + 0.05);

      bodyGain.gain.setValueAtTime(0.70 * gainScale, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(masterGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.055);
    } catch {
      // Audio synthesis error safe ignore
    }
  }

  /**
   * Called on every second tick of the countdown.
   */
  function onSecondTick() {
    updateVolume();
    if (currentVolume > 0.01) {
      unlock();
      playTickSound(isTock);
      isTock = !isTock; // Alternates: Tick -> Tock -> Tick -> Tock
    }
  }

  /**
   * Smooth, flowing volume fading based on viewport position.
   * - Clearly audible while viewing the countdown.
   * - Flowingly fades out to absolute silence when scrolling past #launch into footer.
   */
  function updateVolume() {
    const launch = document.getElementById('launch') || document.getElementById('cd');
    if (!launch) return;

    const rect = launch.getBoundingClientRect();
    const vh = window.innerHeight || 800;

    let targetVol = 0;

    if (rect.top <= vh && rect.bottom >= 0) {
      // When visible on screen: full volume
      targetVol = 1.0;

      // 1. Smooth fade-in when scrolling down into #launch
      if (rect.top > vh * 0.25) {
        targetVol = Math.max(0, (vh - rect.top) / (vh * 0.75));
      }

      // 2. Smooth fade-out when scrolling past #launch down into the footer
      if (rect.bottom < vh * 0.45) {
        targetVol = Math.max(0, rect.bottom / (vh * 0.45));
      }
    } else if (rect.top > vh && rect.top < vh + 400) {
      // Approaching from above
      targetVol = Math.max(0, 1.0 - (rect.top - vh) / 400);
    } else {
      // Offscreen: absolute silence
      targetVol = 0;
    }

    if (targetVol < 0.01) {
      targetVol = 0;
    }

    currentVolume = targetVol;

    const ctx = getAudioContext();
    if (ctx && masterGain) {
      const now = ctx.currentTime;
      // Master volume clearly audible and satisfying (~0.75)
      masterGain.gain.setTargetAtTime(targetVol * 0.75, now, 0.05);
    }

    if (targetVol > 0.02) {
      unlock();
    }
  }

  window.addEventListener('scroll', updateVolume, { passive: true });
  window.addEventListener('resize', updateVolume, { passive: true });
  updateVolume();

  return {
    onSecondTick,
    updateVolume,
    destroy() {
      window.removeEventListener('scroll', updateVolume);
      window.removeEventListener('resize', updateVolume);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    },
  };
}
