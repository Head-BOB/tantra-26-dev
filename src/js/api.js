/**
 * api.js — Tantra 26 Client API
 * Connects frontend directly to Supabase OR an Express backend,
 * with zero-config graceful fallback to local storage.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✓ Supabase direct client connected.');
  } catch (err) {
    console.warn('⚠️ Could not initialize Supabase client:', err);
  }
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
 * Fetch active events for a department
 */
export async function fetchDeptEvents(slug) {
  // 1. Try Direct Supabase (Vercel + Supabase mode)
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('dept_slug', slug.toLowerCase())
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (!error && data && data.length > 0) return data;
    } catch {}
  }

  // 2. Try Backend API (Render mode)
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/departments/${slug}/events`);
      if (res.ok) return await res.json();
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
    } catch {}
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
        .single();
      if (!error && data) return data;
    } catch {}
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
 * Submit student registration
 */
export async function submitRegistration(payload) {
  // 1. Direct Supabase Submission (Zero-server Vercel mode)
  if (supabaseClient) {
    try {
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

      // Generate Pass ID
      const regId = 'T26-' + payload.dept_slug.toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
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
        txn_id: payload.txn_id || 'FREE-REGISTRATION',
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
      if (err.message && err.message.includes('already registered')) {
        throw err;
      }
      console.warn('Supabase direct insert issue, trying fallback:', err);
    }
  }

  // 2. Custom API Backend Submission
  if (API_BASE) {
    const res = await fetch(`${API_BASE}/api/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Registration failed with code ${res.status}`);
    }
    return await res.json();
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
  if (supabaseClient) {
    try {
      const record = {
        id: eventData.id,
        dept_slug: eventData.dept_slug,
        type: eventData.type,
        title: eventData.title,
        date: '7 Oct',
        time: eventData.time,
        venue: eventData.venue,
        team_size: eventData.team_size || eventData.team || 1,
        fee: eventData.fee,
        description: eventData.desc || eventData.description,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseClient.from('events').upsert([record]).select().single();
      if (!error) return data;
    } catch {}
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
        body: JSON.stringify(eventData),
      });
      if (res.ok) return await res.json();
    } catch {}
  }

  return null;
}

export async function apiDeleteEvent(id) {
  if (supabaseClient) {
    try {
      await supabaseClient.from('events').delete().eq('id', id);
      return true;
    } catch {}
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

export async function apiSaveCoord(coordData, id = null) {
  if (supabaseClient) {
    try {
      const record = {
        dept_slug: coordData.dept_slug,
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
      await supabaseClient.from('department_payments').upsert([{
        dept_slug: paymentData.dept_slug,
        upi_id: paymentData.upi_id,
        qr_image_url: paymentData.qr_image_url,
        updated_at: new Date().toISOString(),
      }]);
      return true;
    } catch {}
  }
  return null;
}
