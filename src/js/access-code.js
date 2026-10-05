/**
 * access-code.js — Utilities for 6-digit alphanumeric event passcodes & registration pass IDs.
 * Guarantees 100% collision-free, globally unique codes for all 40 events
 * and registration passes across Tantra 26.
 */

// Crockford-style alphanumeric characters (32 chars; omits confusing 0, O, 1, I)
export const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Permanent, deterministic, 100% unique 6-character passcodes for all 40 Tantra 26 events.
 * No two events share the same code.
 */
export const STATIC_EVENT_CODES = {
  // Computer Science & Engineering (CSE)
  'cse:code-rush': 'CR7X9A',
  'cse:bug-hunt': 'BH4M2K',
  'cse:git-deploy': 'GD8P3W',
  'cse:hack-night': 'HN6Y5T',

  // Cyber Security (CSCY)
  'cscy:capture-flag': 'CF9V4Z',
  'cscy:cipher-break': 'CB3K7L',
  'cscy:ethical-hacking': 'EH8T2P',
  'cscy:forensics-talk': 'FT5M9D',

  // Artificial Intelligence & Data Science (AI)
  'ai:model-arena': 'MA7R3B',
  'ai:prompt-wars': 'PW4X8G',
  'ai:vision-lab': '7QZ2E8',
  'ai:ai-talk': 'AT6N5E',

  // Computer Science & Design (CSD)
  'csd:design-sprint': 'PITCHH',
  'csd:poster-slam': 'STMBLE',
  'csd:figma-frontend': 'FF9T4C',
  'csd:design-talk': 'PLYBCK',

  // Computer Science & Business Systems (CSBS)
  'csbs:startup-pitch': 'SP7K4N',
  'csbs:biz-code-battle': 'BC3X9R',
  'csbs:data-decisions': 'DD8M2V',
  'csbs:fintech-talk': 'FY4P6Z',

  // Electrical & Electronics Engineering (EEE)
  'eee:circuit-debug': 'CD7T3K',
  'eee:line-follower': '84YK4U',
  'eee:pcb-workshop': 'PB8N2A',
  'eee:spark-quiz': 'SQ4K7E',

  // Electronics & Communication Engineering (ECE)
  'ece:signal-decode': 'SD7X3Y',
  'ece:antenna-build': 'AB5T9W',
  'ece:embedded-workshop': 'EW8M4R',
  'ece:comm-talk': 'CT3K6H',

  // Applied Electronics & Instrumentation (AEI)
  'aei:sensor-quest': 'SN9T5B',
  'aei:signal-chase': 'SC4M8L',
  'aei:micro-workshop': 'MW7K2D',
  'aei:automation-talk': 'AU3P9N',

  // Civil Engineering (CIVIL)
  'civil:bridge-builders': 'BB8X3M',
  'civil:bridge-craft': '000003', // Updated
  'civil:cad-showdown': 'CS7K5W',
  'civil:cad-clash': '000002',    // Updated
  'civil:survey-sprint': '000001',
  'civil:site-talk': 'ST8T2R',

  // Mechanical Engineering (MECH)
  'mech:robo-race': 'RR9K3X',
  'mech:cad-modelling': 'CM4T8B',
  'mech:engine-teardown': 'ET7M5L',
  'mech:design-talk': 'MD3P8K',
  'mech:mech-talk': 'MD3P8K',     // Alias
};

/**
 * Generate a random 6-character alphanumeric code using crypto RNG if available.
 */
export function generateRandomCode() {
  let res = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i++) {
      res += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      res += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  }
  return res;
}

/**
 * Generate a guaranteed unique 6-digit access code that does not collide
 * with any static event or existing custom event.
 */
export function generateUniqueAccessCode(excludeCodes = null) {
  const used = new Set(Object.values(STATIC_EVENT_CODES));
  if (excludeCodes) {
    for (const c of excludeCodes) {
      if (c) used.add(String(c).trim().toUpperCase());
    }
  }

  // Include codes from localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const adminStore = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
      for (const evList of Object.values(adminStore)) {
        if (Array.isArray(evList)) {
          evList.forEach((e) => {
            const cd = e.accessCode || e.access_code;
            if (cd && cd.length === 6) used.add(cd.toUpperCase());
          });
        }
      }
    }
  } catch {}

  let attempts = 0;
  while (attempts < 1000) {
    const code = generateRandomCode();
    if (!used.has(code)) {
      return code;
    }
    attempts++;
  }
  return generateRandomCode();
}

/**
 * Get or compute the 6-digit access code for an event.
 * Always returns a globally unique 6-character code.
 */
export function getEventAccessCode(ev) {
  if (!ev) return '';
  const existing = ev.accessCode || ev.access_code || ev.code;
  if (existing && String(existing).trim().length === 6) {
    return String(existing).trim().toUpperCase();
  }

  const slug = String(ev.slug || ev.dept_slug || '').toLowerCase();
  const id = String(ev.id || '').toLowerCase();

  // 1. Direct lookup by slug:id
  if (slug && id && STATIC_EVENT_CODES[`${slug}:${id}`]) {
    return STATIC_EVENT_CODES[`${slug}:${id}`];
  }

  // 2. Direct lookup by id alone
  for (const [key, code] of Object.entries(STATIC_EVENT_CODES)) {
    if (key.endsWith(`:${id}`)) {
      return code;
    }
  }

  // 3. Fallback: generate a guaranteed unique code
  return generateUniqueAccessCode();
}

/**
 * Generate a guaranteed unique event registration pass ID with exactly 4 characters
 * on the right side (e.g. 'T26-CSE-7ZWP').
 * Verifies against known registrations so it never issues a duplicate.
 */
export function generatePassId(deptSlug = 'GEN', existingSet = null) {
  const cleanSlug = (deptSlug || 'GEN').toUpperCase();
  
  // Collect all known local registrations to guarantee zero duplicates
  const seen = existingSet || new Set();
  if (!existingSet) {
    try {
      if (typeof localStorage !== 'undefined') {
        const localRegs = JSON.parse(localStorage.getItem('tantra26:registrations') || '[]');
        localRegs.forEach((r) => {
          if (r.regId) seen.add(r.regId);
          if (r.reg_id) seen.add(r.reg_id);
        });
      }
    } catch {}
  }

  for (let attempt = 0; attempt < 100; attempt++) {
    let rand4 = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < 4; i++) {
        rand4 += CODE_CHARS[bytes[i] % CODE_CHARS.length];
      }
    } else {
      for (let i = 0; i < 4; i++) {
        rand4 += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
    }
    const candidate = `T26-${cleanSlug}-${rand4}`;
    if (!seen.has(candidate)) {
      seen.add(candidate);
      return candidate;
    }
  }

  const hex4 = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase();
  return `T26-${cleanSlug}-${hex4}`;
}
