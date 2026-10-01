/**
 * all-events.js — Consolidated events catalog for Tantra 26.
 * Provides instant metadata lookup for any event by ID or title across all 9 departments.
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

  // Normalized matching (ignoring punctuation and whitespace)
  const normId = cleanId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normId || normTitle) {
    const match = ALL_EVENTS.find((e) => {
      const eNormId = e.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      const eNormTitle = e.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (normId && (eNormId === normId || eNormTitle === normId)) ||
             (normTitle && (eNormTitle === normTitle || eNormId === normTitle));
    });
    if (match) return match;
  }

  if (slug && DEPT_MAP[slug.toLowerCase()]) {
    const deptEvents = DEPT_MAP[slug.toLowerCase()].events;
    const match = deptEvents.find((e) => e.id === cleanId || e.title.toLowerCase() === cleanTitle.toLowerCase());
    if (match) return { ...match, slug: slug.toLowerCase(), dept: DEPT_MAP[slug.toLowerCase()].name };
  }
  return null;
}

export function getAllEvents() {
  return ALL_EVENTS;
}
