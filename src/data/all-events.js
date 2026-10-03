/**
 * all-events.js — Consolidated events catalog for Tantra 26.
 * Provides instant metadata lookup for any event by ID or title across all 10 departments.
 */

import { EVENTS as CSE_EVENTS } from './events/cse.js';
import { EVENTS as AI_EVENTS } from './events/ai.js';
import { EVENTS as CSD_EVENTS } from './events/csd.js';
import { EVENTS as CSBS_EVENTS } from './events/csbs.js';
import { EVENTS as EEE_EVENTS } from './events/eee.js';
import { EVENTS as ECE_EVENTS } from './events/ece.js';
import { EVENTS as AEI_EVENTS } from './events/aei.js';
import { EVENTS as CIVIL_EVENTS } from './events/civil.js';
import { EVENTS as MECH_EVENTS } from './events/mech.js';
import { EVENTS as CSCY_EVENTS } from './events/cscy.js';

const DEPT_MAP = {
  cse:   { name: 'Computer Science & Engineering', events: CSE_EVENTS },
  cscy:  { name: 'Cyber Security', events: CSCY_EVENTS },
  ai:    { name: 'Artificial Intelligence & Data Science', events: AI_EVENTS },
  csd:   { name: 'Computer Science & Design', events: CSD_EVENTS },
  csbs:  { name: 'Computer Science & Business Systems', events: CSBS_EVENTS },
  eee:   { name: 'Electrical & Electronics Engineering', events: EEE_EVENTS },
  ece:   { name: 'Electronics & Communication Engineering', events: ECE_EVENTS },
  aei:   { name: 'Applied Electronics & Instrumentation', events: AEI_EVENTS },
  civil: { name: 'Civil Engineering', events: CIVIL_EVENTS },
  mech:  { name: 'Mechanical Engineering', events: MECH_EVENTS },
};

const ALL_EVENTS = [];
const EVENTS_BY_ID = {};
const EVENTS_BY_TITLE = {};

Object.entries(DEPT_MAP).forEach(([slug, dept]) => {
  dept.events.forEach((ev) => {
    const item = {
      ...ev,
      slug,
      dept: dept.name,
      date: ev.date || '7 Oct',
      time: ev.time || '10:00 AM',
      duration: ev.duration ? Math.max(10, parseInt(ev.duration, 10)) : 120,
      venue: ev.venue || 'Campus',
      type: ev.type || 'Event',
      team: ev.team || 1,
      fee: ev.fee || 'Free',
    };
    ALL_EVENTS.push(item);
    EVENTS_BY_ID[item.id] = item;
    EVENTS_BY_TITLE[item.title.toLowerCase().trim()] = item;
  });
});

export function getEventMetadata(id = '', title = '', slug = '') {
  const cleanId = String(id || '').trim();
  const cleanTitle = String(title || '').trim();
  if (cleanId && EVENTS_BY_ID[cleanId]) return EVENTS_BY_ID[cleanId];
  if (cleanTitle && EVENTS_BY_TITLE[cleanTitle.toLowerCase()]) return EVENTS_BY_TITLE[cleanTitle.toLowerCase()];

  // Unicode-aware key generation (preserving letters/numbers, equating µ/μ with mu)
  const toKey = (s) => String(s || '').toLowerCase()
    .replace(/[µμ]/g, 'mu')
    .replace(/[^\p{L}\p{N}]/gu, '');

  const normId = toKey(cleanId);
  const normTitle = toKey(cleanTitle);

  if (normId || normTitle) {
    const match = ALL_EVENTS.find((e) => {
      const eNormId = toKey(e.id);
      const eNormTitle = toKey(e.title);
      return (normId && (eNormId === normId || eNormTitle === normId)) ||
             (normTitle && (eNormTitle === normTitle || eNormId === normTitle));
    });
    if (match) return match;
  }

  // Check dynamic admin-created events from localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const adminStore = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
      const delStore = JSON.parse(localStorage.getItem('tantra26:admin:deleted_events') || '{}');
      for (const dSlug in adminStore) {
        if (slug && dSlug !== slug.toLowerCase()) continue;
        const list = adminStore[dSlug] || [];
        const dels = delStore[dSlug] || [];
        for (const ev of list) {
          if (dels.includes(ev.id)) continue;
          if (cleanId && (ev.id === cleanId || toKey(ev.id) === normId)) {
            return { ...ev, slug: dSlug, dept: DEPT_MAP[dSlug]?.name || dSlug.toUpperCase() };
          }
          if (cleanTitle && (ev.title.toLowerCase() === cleanTitle.toLowerCase() || toKey(ev.title) === normTitle)) {
            return { ...ev, slug: dSlug, dept: DEPT_MAP[dSlug]?.name || dSlug.toUpperCase() };
          }
        }
      }
    } catch {}
  }

  if (slug && DEPT_MAP[slug.toLowerCase()]) {
    const deptEvents = DEPT_MAP[slug.toLowerCase()].events;
    const match = deptEvents.find((e) => e.id === cleanId || e.title.toLowerCase() === cleanTitle.toLowerCase() || toKey(e.title) === normTitle);
    if (match) return { ...match, slug: slug.toLowerCase(), dept: DEPT_MAP[slug.toLowerCase()].name };
  }
  return null;
}

export function getAllEvents() {
  return ALL_EVENTS;
}
