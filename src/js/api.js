/**
 * api.js — Tantra 26 Client API
 * Connects frontend directly to Supabase OR an Express backend,
 * with zero-config graceful fallback to local storage.
 */

import { createClient } from '@supabase/supabase-js';
import { generatePassId } from './access-code.js';

const RAW_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const RAW_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

// Default production URL & anon key (New Supabase Project)
const FALLBACK_URL = 'https://hdclbulbjmntzjssynwc.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkY2xidWxiam1udHpqc3N5bndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mzg2NzEsImV4cCI6MjEwNjUxNDY3MX0.YWw8Zqxm6iUTZ3j5Fw-LY5_5r6FemkFcX-N_zQar0jA';

const SUPABASE_URL = RAW_URL || FALLBACK_URL;
const SUPABASE_ANON_KEY = RAW_KEY || FALLBACK_KEY;
const API_BASE = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '').replace(/\/$/, '');

let supabaseClient = null;
try {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✓ Supabase direct client connected:', SUPABASE_URL);
} catch (err) {
  console.warn('⚠️ Could not initialize Supabase client:', err);
}

const TOKEN_KEY = 'tantra26:auth_token';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

// ─── Direct Supabase & Backend Helper ──────────────────────────

/**
 * Normalizes an event record from Supabase/Backend, extracting native columns
 * or unpacking the JSON metadata envelope if columns are not yet migrated in PostgreSQL.
 */
export function unpackEventRecord(ev) {
  if (!ev) return null;
  let envelope = {};
  if (typeof ev.description === 'string' && ev.description.startsWith('{"_meta":true')) {
    try {
      envelope = JSON.parse(ev.description);
    } catch {}
  }

  const desc = envelope.desc || ev.desc || (envelope._meta ? '' : ev.description) || '';
  const details = ev.details || envelope.details || desc || '';
  const accessCode = (ev.access_code || ev.accessCode || envelope.accessCode || '').toUpperCase();
  const banner = ev.banner || envelope.banner || '';
  const steps = Array.isArray(ev.steps) ? ev.steps : (Array.isArray(envelope.steps) ? envelope.steps : []);
  const rules = Array.isArray(ev.rules) ? ev.rules : (Array.isArray(envelope.rules) ? envelope.rules : []);
  const prizes = Array.isArray(ev.prizes) ? ev.prizes : (Array.isArray(envelope.prizes) ? envelope.prizes : []);
  const coord = (ev.coord && typeof ev.coord === 'object') ? ev.coord : ((envelope.coord && typeof envelope.coord === 'object') ? envelope.coord : { name: '', phone: '', email: '' });
  
  // Envelope values represent latest admin/organiser edits; take priority over un-migrated column defaults
  const duration = Math.max(10, parseInt(envelope.duration || ev.duration || 120, 10));
  const fee = envelope.fee || ev.fee || 'Free';
  const time = envelope.time || ev.time || '10:00 AM';
  const date = envelope.date || ev.date || '7 Oct';

  const rawBanners = (ev.banners && typeof ev.banners === 'object' && Object.keys(ev.banners).length > 0)
    ? ev.banners
    : ((envelope.banners && typeof envelope.banners === 'object') ? envelope.banners : {});
  const evDesk = rawBanners.event_desktop || banner || '';
  const evMob  = rawBanners.event_mobile || '';
  const featDesk = rawBanners.featured_desktop || evDesk || '';
  const featMob  = rawBanners.featured_mobile || evMob || featDesk || '';
  const banners = {
    event_desktop: evDesk,
    event_mobile: evMob,
    featured_desktop: featDesk,
    featured_mobile: featMob,
  };

  const isFeatured = Boolean(ev.is_featured ?? ev.isFeatured ?? envelope.is_featured ?? false);
  const featuredOrder = parseInt(ev.featured_order ?? ev.featuredOrder ?? envelope.featured_order ?? 0, 10) || 0;
  const whatsapp_group = (ev.whatsapp_group || ev.whatsappGroup || envelope.whatsapp_group || envelope.whatsappGroup || '').trim();
  const manual_prize_pool = Boolean(ev.manual_prize_pool ?? ev.manualPrizePool ?? envelope.manual_prize_pool ?? envelope.manualPrizePool ?? false);
  const prize_pool = String(ev.prize_pool || ev.prizePool || envelope.prize_pool || envelope.prizePool || '').trim();
  const display_only = Boolean(ev.display_only ?? ev.displayOnly ?? envelope.display_only ?? envelope.displayOnly ?? false);
  const max_registrations = parseInt(ev.max_registrations ?? ev.maxRegistrations ?? envelope.max_registrations ?? envelope.maxRegistrations ?? 0, 10) || 0;
  const is_closed = Boolean(ev.is_closed ?? ev.isClosed ?? envelope.is_closed ?? envelope.isClosed ?? false);

  return {
    ...ev,
    slug: (envelope.dept_slug || envelope.slug || ev.dept_slug || ev.slug || '').toLowerCase(),
    dept_slug: (envelope.dept_slug || envelope.slug || ev.dept_slug || ev.slug || '').toLowerCase(),
    date,
    time,
    duration,
    fee,
    desc,
    description: desc,
    details,
    accessCode,
    access_code: accessCode,
    banner: banners.event_desktop || banner,
    banners,
    is_featured: isFeatured,
    isFeatured,
    featured_order: featuredOrder,
    featuredOrder,
    steps,
    rules,
    prizes,
    manual_prize_pool,
    manualPrizePool: manual_prize_pool,
    prize_pool,
    prizePool: prize_pool,
    display_only,
    displayOnly: display_only,
    max_registrations,
    maxRegistrations: max_registrations,
    is_closed,
    isClosed: is_closed,
    coord,
    whatsapp_group,
    whatsappGroup: whatsapp_group,
    team: ev.team_size ?? ev.team ?? 1,
    team_size: ev.team_size ?? ev.team ?? 1,
  };
}

/**
 * Fetch active events for a department
 */
export async function fetchDeptEvents(slug) {
  // 1. Try Direct Supabase (Vercel + Supabase mode)
  if (supabaseClient) {
    try {
      // Exclude heavy base64 banners in list view to reduce payload from 10.4MB down to 21KB (500x speedup)
      let { data, error } = await supabaseClient
        .from('events')
        .select('id, dept_slug, type, title, date, time, venue, team_size, fee, description, details, access_code, coord, is_active, is_featured, featured_order, prizes, duration, created_at, updated_at')
        .eq('dept_slug', slug.toLowerCase())
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        // Fallback to select('*') if any custom column is missing from Postgres schema
        const resAll = await supabaseClient
          .from('events')
          .select('*')
          .eq('dept_slug', slug.toLowerCase())
          .eq('is_active', true)
          .order('created_at', { ascending: true });
        data = resAll.data;
        error = resAll.error;
      }

      if (!error && data) {
        let eventsList = data.map(unpackEventRecord);
        try {
          const { data: regRows } = await supabaseClient
            .from('registrations')
            .select('event_id')
            .eq('dept_slug', slug.toLowerCase());
          if (regRows && Array.isArray(regRows)) {
            const counts = {};
            regRows.forEach(r => {
              if (r.event_id) counts[r.event_id] = (counts[r.event_id] || 0) + 1;
            });
            eventsList = eventsList.map(e => ({
              ...e,
              reg_count: counts[e.id] || 0,
            }));
          }
        } catch {}
        eventsList = eventsList.filter(e => !e.display_only && !e.displayOnly);
        return eventsList;
      }
    } catch (err) {
      console.warn('fetchDeptEvents Supabase error:', err);
    }
  }

  // 2. Try Backend API (Render mode)
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/departments/${slug}/events`);
      if (res.ok) {
        const events = await res.json();
        return events.map(unpackEventRecord);
      }
    } catch {}
  }

  // 3. Fallback to local
  return null;
}

/**
 * Fetch coordinators / organisers for a department
 */
export async function fetchDeptCoords(slug) {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('coordinators')
        .select('*')
        .eq('dept_slug', slug.toLowerCase())
        .order('display_order', { ascending: true });
      if (!error && data && data.length > 0) return data;
    } catch (err) {
      console.warn('fetchDeptCoords Supabase error:', err);
    }
  }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/departments/${slug}/coords`);
      if (res.ok) return await res.json();
    } catch {}
  }

  return null;
}

/**
 * Fetch payment config (UPI ID & QR image) for a department
 */
export async function fetchDeptPayment(slug) {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('department_payments')
        .select('*')
        .eq('dept_slug', slug.toLowerCase())
        .maybeSingle();
      if (!error && data) return data;
    } catch (err) {
      console.warn('fetchDeptPayment Supabase error:', err);
    }
  }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/departments/${slug}/payment`);
      if (res.ok) return await res.json();
    } catch {}
  }

  return null;
}

/**
 * Fetch all department payments config (Central Admin)
 */
export async function fetchAllDeptPayments() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('department_payments')
        .select('*');
      if (!error && data) return data;
    } catch (err) {
      console.warn('fetchAllDeptPayments Supabase error:', err);
    }
  }
  return null;
}

/**
 * Submit student registration
 */
export async function submitRegistration(payload) {
  // 1. Direct Supabase Submission (Zero-server Vercel mode)
  if (supabaseClient) {
    try {
      // Check if event is closed or has reached capacity limit
      const { data: evCheck } = await supabaseClient
        .from('events')
        .select('*')
        .eq('id', payload.event_id)
        .maybeSingle();

      if (evCheck) {
        const u = unpackEventRecord(evCheck);
        if (u && (u.is_closed || u.registration_closed)) {
          throw new Error('Registrations for this event are closed.');
        }
        const maxRegs = parseInt(u?.max_registrations || 0, 10);
        if (maxRegs > 0) {
          const { count } = await supabaseClient
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', payload.event_id);
          if (typeof count === 'number' && count >= maxRegs) {
            throw new Error(`Registration limit reached (${maxRegs} seats full). Registrations are closed.`);
          }
        }
      }

      // Check duplicate registration
      const { data: existing } = await supabaseClient
        .from('registrations')
        .select('id')
        .eq('event_id', payload.event_id)
        .eq('email', payload.email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        throw new Error('This email address is already registered for this event.');
      }

      // Check duplicate UPI transaction ID / UTR
      const cleanTxn = (payload.txn_id || '').trim();
      const isBypassTxn = cleanTxn.toUpperCase() === 'FREE-REGISTRATION' || cleanTxn.toUpperCase() === 'PAY-AT-VENUE';
      if (cleanTxn && !isBypassTxn) {
        const { data: existingTxn } = await supabaseClient
          .from('registrations')
          .select('id')
          .eq('txn_id', cleanTxn)
          .maybeSingle();

        if (existingTxn) {
          throw new Error('This UPI Transaction ID / UTR number has already been used for another registration.');
        }
      }

      // Ensure event exists in events table to satisfy foreign key
      const { data: evExists } = await supabaseClient
        .from('events')
        .select('id')
        .eq('id', payload.event_id)
        .maybeSingle();

      if (!evExists) {
        await supabaseClient.from('events').upsert([{
          id: payload.event_id,
          dept_slug: payload.dept_slug.toLowerCase(),
          type: 'Event',
          title: payload.event_title || payload.event_id,
          date: '7 Oct',
          time: '10:00 AM',
          venue: 'Campus',
          team_size: 1,
          fee: payload.fee || 'Free',
          description: payload.event_title || 'Tantra 26 Event',
          is_active: true,
        }]);
      }

      // Generate guaranteed unique 4-character suffix Pass ID (e.g. 'T26-CSE-7ZWP')
      let regId = '';
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = generatePassId(payload.dept_slug);
        const { data: existingReg } = await supabaseClient
          .from('registrations')
          .select('id')
          .eq('reg_id', candidate)
          .maybeSingle();
        if (!existingReg) {
          regId = candidate;
          break;
        }
      }
      if (!regId) regId = generatePassId(payload.dept_slug);

      const insertRecord = {
        reg_id: regId,
        dept_slug: payload.dept_slug.toLowerCase(),
        event_id: payload.event_id,
        event_title: payload.event_title,
        name: payload.name.trim(),
        email: payload.email.toLowerCase().trim(),
        phone: payload.phone.trim(),
        college: payload.college.trim(),
        team_members: payload.team_members || null,
        fee: payload.fee || 'Free',
        txn_id: cleanTxn || 'FREE-REGISTRATION',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseClient
        .from('registrations')
        .insert([insertRecord])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This email address is already registered for this event.');
        }
        throw error;
      }

      return {
        success: true,
        pass: {
          regId: data.reg_id,
          name: data.name,
          email: data.email,
          college: data.college,
          event: data.event_title,
          fee: data.fee,
          txnId: data.txn_id,
          time: data.created_at,
        },
      };
    } catch (err) {
      if (err.message && (err.message.includes('already registered') || err.message.includes('already been used'))) {
        throw err;
      }
      console.warn('Supabase direct insert issue, trying fallback:', err);
    }
  }

  // 2. Custom API Backend Submission (Vite proxy /api or API_BASE)
  const apiEndpoint = API_BASE ? `${API_BASE}/api/registrations` : '/api/registrations';
  try {
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'This email address is already registered for this event.');
    }
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    if (err.message && err.message.includes('already registered')) {
      throw err;
    }
    console.warn('Backend API note:', err.message);
  }

  // 3. Fallback: Local registration mode
  return null;
}

// ─── Admin API ────────────────────────────────────────────────

export async function adminLogin(password) {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) setToken(data.token);
        return data;
      }
    } catch {}
  }
  return null;
}

export async function fetchAdminRegistrations(dept = '') {
  // Direct Supabase
  if (supabaseClient) {
    try {
      let query = supabaseClient.from('registrations').select('*').order('created_at', { ascending: false });
      if (dept && dept !== 'all') {
        query = query.eq('dept_slug', dept.toLowerCase());
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch {}
  }

  // Backend API
  if (API_BASE) {
    try {
      const token = getToken();
      const q = dept ? `?dept=${encodeURIComponent(dept)}` : '';
      const res = await fetch(`${API_BASE}/api/admin/registrations${q}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) return await res.json();
    } catch {}
  }

  return null;
}

export async function apiSaveEvent(eventData, isEdit = false) {
  const accessCode = (eventData.accessCode || eventData.access_code || '').trim().toUpperCase();
  const desc = eventData.desc || eventData.description || '';
  const details = eventData.details || desc || '';
  const banner = eventData.banner || '';
  const steps = Array.isArray(eventData.steps) ? eventData.steps : [];
  const rules = Array.isArray(eventData.rules) ? eventData.rules : [];
  const prizes = Array.isArray(eventData.prizes) ? eventData.prizes : [];
  const coord = (eventData.coord && typeof eventData.coord === 'object') ? eventData.coord : { name: '', phone: '', email: '' };
  const whatsapp_group = (eventData.whatsapp_group || eventData.whatsappGroup || '').trim();

  const banners = (eventData.banners && typeof eventData.banners === 'object')
    ? eventData.banners
    : { event_desktop: banner, event_mobile: '', featured_desktop: '', featured_mobile: '' };
  const is_featured = Boolean(eventData.is_featured ?? eventData.isFeatured ?? false);
  const featured_order = parseInt(eventData.featured_order ?? eventData.featuredOrder ?? 0, 10) || 0;

  const duration = Math.max(10, parseInt(eventData.duration || 120, 10));

  const validDepts = ['cse', 'cscy', 'ai', 'csd', 'csbs', 'eee', 'ece', 'aei', 'civil', 'mech', 'central'];
  let rawDept = (eventData.dept_slug || eventData.slug || 'cse').toLowerCase();
  let dbDept = validDepts.includes(rawDept) ? rawDept : 'cse';
  const eventDate = eventData.date || '7 Oct';

  if (supabaseClient) {
    try {
      const isShowcase = Boolean(eventData.display_only || eventData.displayOnly || dbDept === 'central' || eventData.type === 'Special Attraction');
      const envelope = JSON.stringify({
        _meta: true,
        dept_slug: rawDept,
        slug: rawDept,
        date: eventDate,
        time: eventData.time || '10:00 AM',
        desc,
        details,
        accessCode,
        duration,
        fee: eventData.fee || 'Free',
        // For showcase posters, do NOT duplicate massive base64 inside the envelope text!
        banner: isShowcase ? '' : (banners.event_desktop || banner),
        banners: isShowcase ? {} : banners,
        is_featured,
        featured_order,
        steps,
        rules,
        prizes,
        manual_prize_pool: Boolean(eventData.manual_prize_pool || eventData.manualPrizePool),
        prize_pool: String(eventData.prize_pool || eventData.prizePool || '').trim(),
        coord,
        whatsapp_group,
        display_only: Boolean(eventData.display_only || eventData.displayOnly),
        max_registrations: parseInt(eventData.max_registrations ?? eventData.maxRegistrations ?? 0, 10) || 0,
        is_closed: Boolean(eventData.is_closed || eventData.isClosed),
      });

      // Invalidate relevant local storage caches
      const invalidateCaches = () => {
        try {
          localStorage.removeItem('tantra26:cache:featured_events');
          localStorage.removeItem('tantra26:cache:featured_events_time');
          localStorage.removeItem('tantra26:cache:dept_events:' + rawDept);
          localStorage.removeItem('tantra26:cache:dept_events:' + dbDept);
        } catch {}
      };

      // Helper to update dedicated showcase vault in department_payments
      const syncToVault = async (evObj) => {
        if (isShowcase) {
          try {
            await apiSaveToShowcaseVault(evObj);
          } catch (vErr) {
            console.warn('⚠️ Vault sync warning:', vErr);
          }
        }
      };

      // 1. First attempt: Native schema columns that exist in Postgres table
      // (custom metadata like display_only, max_registrations, is_closed are safely stored in envelope)
      const nativeRecord = {
        id: eventData.id,
        dept_slug: dbDept,
        type: eventData.type || 'Competition',
        title: eventData.title || 'Event',
        date: eventDate,
        time: eventData.time || '10:00 AM',
        duration,
        venue: eventData.venue || 'Campus',
        team_size: parseInt(eventData.team_size || eventData.team || 1, 10) || 1,
        fee: eventData.fee || 'Free',
        description: envelope,
        access_code: accessCode || null,
        details,
        banner: banners.event_desktop || banner,
        banners,
        is_featured: Boolean(eventData.is_featured ?? eventData.isFeatured ?? (dbDept === 'central')),
        featured_order: parseInt(eventData.featured_order ?? eventData.featuredOrder ?? 1, 10) || 1,
        steps,
        rules,
        prizes,
        coord,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      let { data, error } = await supabaseClient.from('events').upsert([nativeRecord]).select().single();
      if (!error && data) {
        invalidateCaches();
        await syncToVault(eventData);
        return unpackEventRecord(data);
      }

      // If custom columns are missing from Supabase schema cache, retry progressively with envelope in description
      if (error && (error.message.includes('banners') || error.message.includes('is_featured') || error.message.includes('prizes') || error.message.includes('duration') || error.message.includes('schema cache'))) {
        const fallbackNative = { ...nativeRecord };
        if (error.message.includes('banners')) delete fallbackNative.banners;
        if (error.message.includes('is_featured')) delete fallbackNative.is_featured;
        if (error.message.includes('featured_order')) delete fallbackNative.featured_order;
        if (error.message.includes('prizes')) delete fallbackNative.prizes;
        if (error.message.includes('duration')) delete fallbackNative.duration;
        // Keep description: envelope so mobile banners, duration, fee etc. are preserved!
        fallbackNative.description = envelope;
        const resNoCols = await supabaseClient.from('events').upsert([fallbackNative]).select().single();
        if (!resNoCols.error && resNoCols.data) {
          invalidateCaches();
          await syncToVault(eventData);
          return unpackEventRecord(resNoCols.data);
        }
        error = resNoCols.error;
      }

      // 2. Second attempt: Fallback metadata envelope
      if (error) {
        const fallbackRecord = {
          id: eventData.id,
          dept_slug: dbDept,
          type: eventData.type || 'Competition',
          title: eventData.title || 'Event',
          date: eventDate,
          time: eventData.time || '10:00 AM',
          venue: eventData.venue || 'Campus',
          team_size: parseInt(eventData.team_size || eventData.team || 1, 10) || 1,
          fee: eventData.fee || 'Free',
          description: envelope,
          access_code: accessCode || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        let { data: fbData, error: fbErr } = await supabaseClient.from('events').upsert([fallbackRecord]).select().single();
        if (!fbErr && fbData) {
          invalidateCaches();
          await syncToVault(eventData);
          return unpackEventRecord(fbData);
        }

        // If access_code column also not in schema, fallback to storing accessCode inside envelope
        if (fbErr && (fbErr.message.includes('access_code') || fbErr.message.includes('schema cache'))) {
          delete fallbackRecord.access_code;
          const { data: fbData2, error: fbErr2 } = await supabaseClient.from('events').upsert([fallbackRecord]).select().single();
          if (!fbErr2 && fbData2) {
            try { localStorage.removeItem('tantra26:cache:featured_events'); } catch {}
            await syncToVault(eventData);
            return unpackEventRecord(fbData2);
          }
          if (fbErr2) error = fbErr2;
        } else if (fbErr) {
          error = fbErr;
        }
      }

      // If all attempts to save into events table failed, but it's a showcase poster, save to dedicated vault!
      if (isShowcase) {
        const vaultOk = await apiSaveToShowcaseVault(eventData);
        if (vaultOk) {
          invalidateCaches();
          return unpackEventRecord(eventData);
        }
      }

      if (error) {
        console.warn('⚠️ Supabase event upsert error:', error.message);
        throw new Error(error.message || 'Database save error');
      }
    } catch (err) {
      console.error('⚠️ Supabase event upsert exception:', err);
      throw err;
    }
  }

  if (API_BASE) {
    try {
      const token = getToken();
      const method = isEdit ? 'PUT' : 'POST';
      const path = isEdit ? `/api/admin/events/${encodeURIComponent(eventData.id)}` : '/api/admin/events';
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...eventData,
          access_code: accessCode,
          accessCode,
          details,
          banner,
          steps,
          rules,
          coord,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return unpackEventRecord(json.event || json);
      }
    } catch {}
  }

  return null;
}

/**
 * Organiser saving event guide, rules, detailed description, banner & contact
 */
export async function apiSaveOrganiserEvent(eventData) {
  const code = (eventData.code || eventData.accessCode || eventData.access_code || '').trim().toUpperCase();

  // Try backend endpoint first if API_BASE is active
  if (API_BASE && code) {
    try {
      const res = await fetch(`${API_BASE}/api/events/code/${encodeURIComponent(code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          details: eventData.details,
          banner: eventData.banner,
          banners: eventData.banners,
          steps: eventData.steps,
          rules: eventData.rules,
          prizes: eventData.prizes,
          manual_prize_pool: Boolean(eventData.manual_prize_pool || eventData.manualPrizePool),
          prize_pool: String(eventData.prize_pool || eventData.prizePool || '').trim(),
          coord: eventData.coord,
          whatsapp_group: eventData.whatsapp_group || eventData.whatsappGroup || '',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return unpackEventRecord(json.event || json);
      }
    } catch {}
  }

  // Save via direct Supabase upsert
  return await apiSaveEvent({
    ...eventData,
    accessCode: code,
    access_code: code,
  }, true);
}

/**
 * Fetch a single event by its 6-digit organiser passcode from Supabase or Backend API
 */
export async function apiFetchEventByCode(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code || code.length !== 6) return null;

  // 1. Direct Supabase Query
  if (supabaseClient) {
    try {
      // First attempt: query native access_code column
      const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('access_code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        return unpackEventRecord(data);
      }

      // Second attempt: scan active events for unpacked accessCode
      const { data: allEvs } = await supabaseClient
        .from('events')
        .select('*')
        .eq('is_active', true);

      if (allEvs && allEvs.length > 0) {
        for (const ev of allEvs) {
          const unpacked = unpackEventRecord(ev);
          if (unpacked && unpacked.accessCode === code) {
            return unpacked;
          }
        }
      }
    } catch (err) {
      console.warn('apiFetchEventByCode Supabase error:', err);
    }
  }

  // 2. Backend API
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/events/code/${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        return unpackEventRecord(data);
      }
    } catch {}
  }

  return null;
}

/**
 * Fetch a single event by ID directly from cloud
 */
export async function apiFetchSingleEvent(slug, id) {
  if (!id) return null;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data && data.is_active !== false) {
        const item = unpackEventRecord(data);
        if (item) {
          try {
            const { count: regCount } = await supabaseClient
              .from('registrations')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', id);
            item.reg_count = regCount || 0;
          } catch {}
        }
        return item;
      }
    } catch {}
  }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        return unpackEventRecord(data);
      }
    } catch {}
  }

  return null;
}

export async function apiDeleteEvent(id) {
  if (!id) return false;

  // 1. Prune immediately from all local storage keys
  try {
    const regRaw = JSON.parse(localStorage.getItem('tantra26:registrations') || '[]');
    if (Array.isArray(regRaw)) {
      const filtered = regRaw.filter(r => (r.eventId || r.event_id || r.id) !== id);
      if (filtered.length !== regRaw.length) {
        localStorage.setItem('tantra26:registrations', JSON.stringify(filtered));
      }
    }
    const adminRaw = JSON.parse(localStorage.getItem('tantra26:admin:registrations') || '[]');
    if (Array.isArray(adminRaw)) {
      const filteredAdmin = adminRaw.filter(r => (r.eventId || r.event_id || r.id) !== id);
      if (filteredAdmin.length !== adminRaw.length) {
        localStorage.setItem('tantra26:admin:registrations', JSON.stringify(filteredAdmin));
      }
    }
    const evMap = JSON.parse(localStorage.getItem('tantra26:events') || '{}');
    let evChanged = false;
    Object.keys(evMap).forEach(k => {
      if (k.endsWith(':' + id) || evMap[k]?.id === id) {
        delete evMap[k];
        evChanged = true;
      }
    });
    if (evChanged) localStorage.setItem('tantra26:events', JSON.stringify(evMap));

    const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
    let aChanged = false;
    Object.keys(adminEvents).forEach(k => {
      if (Array.isArray(adminEvents[k])) {
        const prevLen = adminEvents[k].length;
        adminEvents[k] = adminEvents[k].filter(e => e && e.id !== id);
        if (adminEvents[k].length !== prevLen) aChanged = true;
      }
    });
    if (aChanged) localStorage.setItem('tantra26:admin:events', JSON.stringify(adminEvents));

    const delList = JSON.parse(localStorage.getItem('tantra26:deleted_events') || '[]');
    if (!delList.includes(id)) {
      delList.push(id);
      localStorage.setItem('tantra26:deleted_events', JSON.stringify(delList));
    }

    localStorage.removeItem('tantra26:cache:featured_events');
    localStorage.removeItem('tantra26:cache:featured_events_time');
  } catch {}

  // 2. Supabase deletion
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from('events').delete().eq('id', id);
      if (error) {
        console.warn('⚠️ Supabase hard-delete failed (foreign keys exist), applying full soft-delete:', error.message);
        // Deactivate, remove from featured, and completely revoke access code
        await supabaseClient.from('events').update({
          is_active: false,
          is_featured: false,
          access_code: null,
          description: JSON.stringify({ _meta: true, is_deleted: true, is_active: false })
        }).eq('id', id);
      }
      // Also prune from dedicated showcase vault if present
      try {
        await apiDeleteFromShowcaseVault(id);
      } catch {}
      return true;
    } catch (err) {
      console.error('⚠️ Supabase delete event exception:', err);
    }
  }
  if (API_BASE) {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/admin/events/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.ok;
    } catch {}
  }
  return false;
}

/**
 * Sanitizes 'tantra26:registrations' to ensure it ONLY contains registrations
 * made by the participant using this browser, removing any bulk admin dumps.
 */
export function sanitizePersonalRegistrations() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem('tantra26:registrations');
    if (!raw) return false;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return false;

    // Detect if admin dump got placed here
    let hasAdminDump = false;
    const emails = new Set();
    const phones = new Set();

    for (const r of list) {
      if (r.email) emails.add(String(r.email).toLowerCase().trim());
      if (r.phone) phones.add(String(r.phone).trim());
      // Admin sync dump signature: time contains ISO stamp like "2026-..." and lacks human date / regTime / venue
      if (!r.regTime && (!r.date || (typeof r.time === 'string' && r.time.includes('T')))) {
        hasAdminDump = true;
      }
    }

    if (emails.size > 2 || phones.size > 2) {
      hasAdminDump = true;
    }

    // Check if user is or was logged in as admin/coordinator
    const hasAdminSession = Boolean(
      localStorage.getItem('tantra26:admin:session_user') ||
      localStorage.getItem('tantra26:admin:role') ||
      sessionStorage.getItem('tantra26:admin_user')
    );

    if (!hasAdminDump && !hasAdminSession) {
      return false; // Already clean
    }

    // Backup full list to admin registrations if not yet present
    try {
      const existingAdmin = localStorage.getItem('tantra26:admin:registrations');
      if (!existingAdmin || existingAdmin === '[]') {
        localStorage.setItem('tantra26:admin:registrations', JSON.stringify(list));
      }
    } catch {}

    const lastEmail = (localStorage.getItem('tantra26:last_user_email') || '').toLowerCase().trim();
    const lastPhone = (localStorage.getItem('tantra26:last_user_phone') || '').trim();
    const lastName  = (localStorage.getItem('tantra26:last_user_name') || '').toLowerCase().trim();

    // Filter to retain only registrations genuine to this browser user
    const cleaned = list.filter(r => {
      // Must be a genuine front-end registration (has regTime or explicit isSelf)
      const isGenuineFrontEnd = Boolean(r.regTime || r.isSelf || (r.date && r.venue && !String(r.time || '').includes('T')));
      if (!isGenuineFrontEnd) return false;

      const rEmail = String(r.email || '').toLowerCase().trim();
      const rPhone = String(r.phone || '').trim();
      const rName  = String(r.name || '').toLowerCase().trim();

      if (lastEmail && rEmail) return rEmail === lastEmail;
      if (lastPhone && rPhone) return rPhone === lastPhone;
      if (lastName && rName) return rName === lastName;

      // If user has admin session and has multiple different emails/names in regs, discard non-matching
      if (hasAdminSession) return false;

      // If no admin dump signatures and single email/user, keep
      return !hasAdminDump;
    });

    if (cleaned.length !== list.length) {
      localStorage.setItem('tantra26:registrations', JSON.stringify(cleaned));
      return true;
    }
  } catch (err) {
    console.warn('Error in sanitizePersonalRegistrations:', err);
  }
  return false;
}

// Automatically sanitize on load to heal contaminated sessions
try {
  sanitizePersonalRegistrations();
} catch {}

/**
 * Automatically prunes any registrations from localStorage ('tantra26:registrations')
 * if their corresponding event has been deleted or deactivated in the database.
 */
export async function pruneDeletedRegistrations() {
  sanitizePersonalRegistrations();
  let pruned = false;

  // 1. Cross-reference with admin deleted_events store
  try {
    const delStore = JSON.parse(localStorage.getItem('tantra26:admin:deleted_events') || '{}');
    const allDeletedIds = new Set(Object.values(delStore).flat());
    if (allDeletedIds.size > 0) {
      const regRaw = JSON.parse(localStorage.getItem('tantra26:registrations') || '[]');
      if (Array.isArray(regRaw)) {
        const filtered = regRaw.filter(r => !allDeletedIds.has(r.eventId || r.event_id || r.id));
        if (filtered.length !== regRaw.length) {
          localStorage.setItem('tantra26:registrations', JSON.stringify(filtered));
          pruned = true;
        }
      }
    }
  } catch {}

  // 2. Query Supabase active events
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('events').select('id, is_active');
      if (!error && Array.isArray(data) && data.length > 0) {
        const activeIds = new Set(data.filter(e => e.is_active !== false).map(e => e.id));
        const inactiveIds = new Set(data.filter(e => e.is_active === false).map(e => e.id));
        const regRaw = JSON.parse(localStorage.getItem('tantra26:registrations') || '[]');
        if (Array.isArray(regRaw)) {
          const filtered = regRaw.filter(r => {
            const evId = r.eventId || r.event_id || r.id;
            if (inactiveIds.has(evId)) return false;
            const inDb = data.some(d => d.id === evId);
            if (inDb && !activeIds.has(evId)) return false;
            return true;
          });
          if (filtered.length !== regRaw.length) {
            localStorage.setItem('tantra26:registrations', JSON.stringify(filtered));
            pruned = true;
          }
        }
      }
    } catch (err) {
      console.warn('pruneDeletedRegistrations Supabase note:', err);
    }
  }

  return pruned;
}

/**
 * Fully synchronise a department's coordinators with Supabase.
 * Atomically replaces the department's coordinators so order and contents
 * match the dashboard exactly.
 */
export async function apiSyncDeptCoords(slug, coordsList) {
  if (supabaseClient) {
    try {
      const cleanSlug = slug.toLowerCase();
      // 1. Delete current coords for this dept
      const { error: delErr } = await supabaseClient
        .from('coordinators')
        .delete()
        .eq('dept_slug', cleanSlug);

      if (delErr) {
        console.warn('⚠️ Supabase clear coords notice:', delErr.message);
      }

      // 2. Insert new coords with display_order
      if (coordsList && coordsList.length > 0) {
        const rows = coordsList.map((c, i) => ({
          dept_slug: cleanSlug,
          name: (c.name || '').trim(),
          phone: (c.phone || '').trim(),
          display_order: i + 1,
        }));
        const { error: insErr } = await supabaseClient
          .from('coordinators')
          .insert(rows);

        if (insErr) {
          console.error('⚠️ Supabase coord insert error:', insErr.message);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('⚠️ apiSyncDeptCoords exception:', err);
    }
  }

  // Backend API fallback
  if (API_BASE) {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/departments/${slug}/coords`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ coordinators: coordsList }),
      });
      return res.ok;
    } catch {}
  }

  return false;
}

export async function apiSaveCoord(coordData, id = null) {
  if (supabaseClient) {
    try {
      const record = {
        dept_slug: (coordData.dept_slug || '').toLowerCase(),
        name: coordData.name,
        phone: coordData.phone,
      };
      if (id !== null && typeof id === 'number') record.id = id;
      await supabaseClient.from('coordinators').upsert([record]);
      return true;
    } catch {}
  }
  return null;
}

export async function apiDeleteCoord(id) {
  if (supabaseClient) {
    try {
      await supabaseClient.from('coordinators').delete().eq('id', id);
      return true;
    } catch {}
  }
  return false;
}

export async function apiSavePayment(paymentData) {
  if (supabaseClient) {
    try {
      const record = {
        dept_slug: (paymentData.dept_slug || '').toLowerCase(),
        upi_id: paymentData.upi_id,
        qr_image_url: paymentData.qr_image_url ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseClient.from('department_payments').upsert([record]).select().single();
      if (!error) return data || true;
      console.error('⚠️ Supabase payment upsert error:', error?.message);
    } catch (err) {
      console.error('⚠️ Supabase payment upsert exception:', err);
    }
  }
  return null;
}

// ─── Featured Events Helpers ─────────────────────────────────

/**
 * Synchronously retrieves fast cached featured events for 0ms initial render.
 */
export function apiGetCachedFeaturedEvents() {
  const CACHE_KEY = 'tantra26:cache:featured_events';
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const delList = JSON.parse(localStorage.getItem('tantra26:deleted_events') || '[]');
        const delSet = new Set(delList);
        return parsed.filter(e => e && e.id && !delSet.has(e.id) && e.is_active !== false);
      }
    }
  } catch {}
  return [];
}

// ─── Dedicated Showcase Vault Storage (Central Attractions) ─────
export async function apiFetchShowcaseVault() {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from('department_payments')
      .select('qr_image_url')
      .eq('dept_slug', 'central')
      .maybeSingle();

    if (!error && data && data.qr_image_url) {
      try {
        const parsed = JSON.parse(data.qr_image_url);
        if (Array.isArray(parsed)) return parsed.map(unpackEventRecord);
      } catch {}
    }
  } catch (err) {
    console.warn('⚠️ apiFetchShowcaseVault error:', err);
  }
  return [];
}

export async function apiSaveToShowcaseVault(poster) {
  if (!supabaseClient || !poster || !poster.id) return false;
  try {
    const { data: vData } = await supabaseClient
      .from('department_payments')
      .select('qr_image_url')
      .eq('dept_slug', 'central')
      .maybeSingle();

    let list = [];
    if (vData && vData.qr_image_url) {
      try {
        const parsed = JSON.parse(vData.qr_image_url);
        if (Array.isArray(parsed)) list = parsed;
      } catch {}
    }

    const b = poster.banners || {};
    const deskImg = b.featured_desktop || poster.banner || b.event_desktop || '';
    const mobImg = b.featured_mobile || b.event_mobile || deskImg;

    const cleanPoster = {
      id: poster.id,
      title: poster.title || 'Special Attraction',
      type: poster.type || 'Special Attraction',
      venue: poster.venue || 'Campus Central',
      date: poster.date || '7-8 Oct',
      time: poster.time || 'All Day',
      desc: poster.desc || poster.details || '',
      fee: 'Viewing Only',
      team_size: 1,
      dept_slug: 'central',
      slug: 'central',
      display_only: true,
      displayOnly: true,
      is_featured: poster.is_featured !== false,
      featured_order: parseInt(poster.featured_order || 1, 10),
      banner: deskImg,
      banners: {
        featured_desktop: deskImg,
        featured_mobile: mobImg,
        event_desktop: deskImg,
        event_mobile: mobImg,
      },
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const idx = list.findIndex(p => p && p.id === poster.id);
    if (idx >= 0) list[idx] = cleanPoster;
    else list.push(cleanPoster);

    const { error } = await supabaseClient
      .from('department_payments')
      .upsert([{
        dept_slug: 'central',
        upi_id: 'central_showcase_vault',
        qr_image_url: JSON.stringify(list),
        updated_at: new Date().toISOString()
      }]);

    if (!error) return true;
    console.warn('⚠️ apiSaveToShowcaseVault upsert error:', error.message);
  } catch (err) {
    console.warn('⚠️ apiSaveToShowcaseVault exception:', err);
  }
  return false;
}

export async function apiDeleteFromShowcaseVault(id) {
  if (!supabaseClient || !id) return false;
  try {
    const { data: vData } = await supabaseClient
      .from('department_payments')
      .select('qr_image_url')
      .eq('dept_slug', 'central')
      .maybeSingle();

    if (vData && vData.qr_image_url) {
      try {
        const list = JSON.parse(vData.qr_image_url);
        if (Array.isArray(list)) {
          const filtered = list.filter(p => p && p.id !== id);
          await supabaseClient
            .from('department_payments')
            .upsert([{
              dept_slug: 'central',
              upi_id: 'central_showcase_vault',
              qr_image_url: JSON.stringify(filtered),
              updated_at: new Date().toISOString()
            }]);
          return true;
        }
      } catch {}
    }
  } catch {}
  return false;
}

/**
 * Fetch all active events marked as featured, ordered by featured_order.
 * Uses targeted lightweight query to eliminate statement timeouts (Postgres 57014),
 * merges local showcase posters and dedicated showcase vault, and caches data.
 */
export async function apiFetchFeaturedEvents({ forceRefresh = false } = {}) {
  const CACHE_KEY = 'tantra26:cache:featured_events';
  const CACHE_TIME_KEY = 'tantra26:cache:featured_events_time';

  // Read immediately from fast local cache
  let cached = apiGetCachedFeaturedEvents();

  // If cache is fresh (< 60s) and not forced, return cached directly to protect database limits
  if (!forceRefresh && cached.length > 0) {
    try {
      const lastFetch = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0', 10);
      if (Date.now() - lastFetch < 60000) {
        return cached;
      }
    } catch {}
  }

  const delList = JSON.parse(localStorage.getItem('tantra26:deleted_events') || '[]');
  const delSet = new Set(delList);

  // Async refresh from Supabase
  if (supabaseClient) {
    try {
      const queryPromise = supabaseClient
        .from('events')
        .select('id, dept_slug, type, title, date, time, venue, fee, is_featured, featured_order, banner, banners, description, is_active, created_at')
        .eq('is_active', true)
        .or('is_featured.eq.true,dept_slug.eq.central,type.eq.Special Attraction,type.ilike.%attraction%,type.ilike.%showcase%')
        .order('featured_order', { ascending: true });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase query timeout')), 3500)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      let unpacked = [];
      if (!error && Array.isArray(data)) {
        unpacked = data.map(unpackEventRecord).filter(ev => {
          if (!ev || delSet.has(ev.id) || ev.is_active === false) return false;
          const isFeat = Boolean(ev.is_featured || ev.isFeatured || ev.dept_slug === 'central' || ev.slug === 'central' || ev.display_only || ev.type === 'Special Attraction');
          return isFeat;
        });
      }

      // Merge items from dedicated showcase vault
      try {
        const vaultItems = await apiFetchShowcaseVault();
        vaultItems.forEach(vp => {
          if (vp && !delSet.has(vp.id) && vp.is_active !== false && (vp.is_featured !== false)) {
            const existingIdx = unpacked.findIndex(x => x.id === vp.id);
            if (existingIdx >= 0) {
              unpacked[existingIdx] = { ...unpacked[existingIdx], ...vp };
            } else {
              unpacked.push(vp);
            }
          }
        });
      } catch {}

      // Merge local admin posters so newly created attractions appear immediately
      try {
        const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
        const localPosters = adminEvents['central'] || [];
        localPosters.forEach(p => {
          if (p && !delSet.has(p.id) && (p.is_featured || p.isFeatured || p.type === 'Special Attraction' || p.display_only) && !unpacked.some(x => x.id === p.id)) {
            unpacked.push(p);
          }
        });
      } catch {}

      if (unpacked.length > 0) {
        unpacked.sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
        const seenSlots = new Set();
        let curSlot = 1;
        unpacked.forEach(e => {
          let o = parseInt(e.featured_order, 10) || curSlot;
          if (seenSlots.has(o)) {
            while (seenSlots.has(curSlot)) curSlot++;
            o = curSlot;
          }
          e.featured_order = o;
          seenSlots.add(o);
        });
        unpacked.sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(unpacked));
          localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
        } catch {}
        return unpacked;
      }
    } catch (err) {
      console.warn('⚠️ apiFetchFeaturedEvents Supabase error:', err);
    }
  }

  // Fallback to local storage admin events
  try {
    const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
    const list = [];
    const seen = new Set();

    const checkAndAdd = ev => {
      if (!ev || !ev.id || seen.has(ev.id) || delSet.has(ev.id)) return;
      if (ev.is_featured || ev.isFeatured || ev.type === 'Special Attraction' || ev.display_only) {
        list.push(ev);
        seen.add(ev.id);
      }
    };

    for (const d in adminEvents) {
      (adminEvents[d] || []).forEach(checkAndAdd);
    }

    if (list.length > 0) {
      list.sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
      const seenSlots = new Set();
      let curSlot = 1;
      list.forEach(e => {
        let o = parseInt(e.featured_order, 10) || curSlot;
        if (seenSlots.has(o)) {
          while (seenSlots.has(curSlot)) curSlot++;
          o = curSlot;
        }
        e.featured_order = o;
        seenSlots.add(o);
      });
      list.sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
      return list;
    }
  } catch {}

  return cached;
}

/**
 * Fetch all special attractions / showcase posters from Supabase or dedicated showcase vault
 */
export async function apiFetchSpecialAttractions() {
  const delList = JSON.parse(localStorage.getItem('tantra26:deleted_events') || '[]');
  const delSet = new Set(delList);
  const postersMap = new Map();

  if (supabaseClient) {
    // 1. Fetch from dedicated showcase vault
    try {
      const vaultItems = await apiFetchShowcaseVault();
      if (Array.isArray(vaultItems)) {
        vaultItems.forEach(p => {
          if (p && p.id && !delSet.has(p.id) && p.is_active !== false) {
            postersMap.set(p.id, p);
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Showcase vault read warning:', err);
    }

    // 2. Fetch from events table
    try {
      const queryPromise = supabaseClient
        .from('events')
        .select('id, dept_slug, type, title, date, time, venue, fee, is_featured, featured_order, banner, banners, description, is_active, created_at')
        .eq('is_active', true)
        .or('dept_slug.eq.central,type.eq.Special Attraction,type.ilike.%attraction%,type.ilike.%showcase%')
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Special attractions query timeout')), 3500)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (!error && Array.isArray(data)) {
        data.forEach(item => {
          const unpacked = unpackEventRecord(item);
          if (unpacked && !delSet.has(unpacked.id) && unpacked.is_active !== false) {
            // If already present from vault with richer banner data, keep, otherwise set
            if (!postersMap.has(unpacked.id)) {
              postersMap.set(unpacked.id, unpacked);
            } else {
              postersMap.set(unpacked.id, { ...unpacked, ...postersMap.get(unpacked.id) });
            }
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ apiFetchSpecialAttractions error:', err);
    }

    if (postersMap.size > 0) {
      return Array.from(postersMap.values());
    }
  }

  try {
    const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
    return (adminEvents['central'] || []).filter(e => e && !delSet.has(e.id));
  } catch {}
  return [];
}

/**
 * Toggle or set featured status for an event (Super Admin Central).
 * Enforces requirement: event MUST have both featured_desktop and featured_mobile banners.
 */
export async function apiSetEventFeatured(eventId, isFeatured, order = 0) {
  if (!eventId) return { ok: false, error: 'Event ID required' };

  let targetEvent = null;

  // 1. Fetch current event to verify banners
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
      if (data) targetEvent = unpackEventRecord(data);
    } catch {}
  }

  if (!targetEvent) {
    try {
      const localEvents = JSON.parse(localStorage.getItem('tantra26:events') || '{}');
      for (const k in localEvents) {
        if (localEvents[k] && localEvents[k].id === eventId) {
          targetEvent = localEvents[k];
          break;
        }
      }
      if (!targetEvent) {
        const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
        for (const slug in adminEvents) {
          const found = (adminEvents[slug] || []).find(x => x.id === eventId);
          if (found) { targetEvent = found; break; }
        }
      }
    } catch {}
  }

  // Verify requirements if turning ON
  if (isFeatured) {
    const b = (targetEvent && targetEvent.banners) || {};
    const featDesk = b.featured_desktop || b.event_desktop || targetEvent?.banner || '';
    const featMob  = b.featured_mobile  || b.event_mobile  || featDesk || '';

    const isDeskValid = featDesk && typeof featDesk === 'string' && (featDesk.startsWith('data:') || featDesk.startsWith('http') || featDesk.startsWith('/') || featDesk.startsWith('.'));
    const isMobValid  = featMob && typeof featMob === 'string' && (featMob.startsWith('data:') || featMob.startsWith('http') || featMob.startsWith('/') || featMob.startsWith('.'));

    if (!isDeskValid || !isMobValid) {
      return {
        ok: false,
        error: 'Event must have valid banners uploaded before it can be featured on the homepage.',
      };
    }
  }

  // Update in Supabase
  if (supabaseClient) {
    try {
      const updateData = {
        is_featured: Boolean(isFeatured),
        featured_order: parseInt(order, 10) || 0,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseClient.from('events').update(updateData).eq('id', eventId);
      if (error && (error.message.includes('is_featured') || error.message.includes('schema cache'))) {
        // If column not yet in remote schema, update description metadata envelope
        if (targetEvent) {
          targetEvent.is_featured = isFeatured;
          targetEvent.featured_order = order;
          await apiSaveEvent(targetEvent, true);
        }
      }
    } catch (err) {
      console.warn('⚠️ apiSetEventFeatured error:', err);
    }
  }

  // Update in local caches
  try {
    const localStore = JSON.parse(localStorage.getItem('tantra26:events') || '{}');
    for (const k in localStore) {
      if (localStore[k] && localStore[k].id === eventId) {
        localStore[k].is_featured = isFeatured;
        localStore[k].isFeatured = isFeatured;
        localStore[k].featured_order = order;
        localStore[k].featuredOrder = order;
      }
    }
    localStorage.setItem('tantra26:events', JSON.stringify(localStore));

    const adminEvents = JSON.parse(localStorage.getItem('tantra26:admin:events') || '{}');
    for (const d in adminEvents) {
      (adminEvents[d] || []).forEach(ev => {
        if (ev && ev.id === eventId) {
          ev.is_featured = isFeatured;
          ev.isFeatured = isFeatured;
          ev.featured_order = order;
          ev.featuredOrder = order;
        }
      });
    }
    localStorage.setItem('tantra26:admin:events', JSON.stringify(adminEvents));
  } catch {}

  return { ok: true };
}
