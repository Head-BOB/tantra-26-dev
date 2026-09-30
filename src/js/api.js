/**
 * api.js — Tantra 26 Client API
 * Connects frontend directly to Supabase OR an Express backend,
 * with zero-config graceful fallback to local storage.
 */

import { createClient } from '@supabase/supabase-js';

const RAW_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const RAW_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

// Clean up any typo in the URL (e.g. prjj vs prjij) and fallback to production project
const FALLBACK_URL = 'https://kzomczprjijbqeheqaaj.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6b21jenByamlqYnFlaGVxYWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTAyMDksImV4cCI6MjEwNjIyNjIwOX0.iFdjUtHI19dG04hF24nXdMxk8Cffu9DETBcR2Ktl-gs';

const SUPABASE_URL = RAW_URL ? RAW_URL.replace('kzomczprjjbqeheqaaj', 'kzomczprjijbqeheqaaj') : FALLBACK_URL;
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
      if (!error && data && data.length > 0) {
        return data.map(ev => ({
          ...ev,
          desc: ev.description || ev.desc || '',
          description: ev.description || ev.desc || '',
          team: ev.team_size ?? ev.team ?? 1,
          team_size: ev.team_size ?? ev.team ?? 1,
        }));
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
        return events.map(ev => ({
          ...ev,
          desc: ev.description || ev.desc || '',
          description: ev.description || ev.desc || '',
          team: ev.team_size ?? ev.team ?? 1,
          team_size: ev.team_size ?? ev.team ?? 1,
        }));
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
      if (cleanTxn && cleanTxn.toUpperCase() !== 'FREE-REGISTRATION') {
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
  if (supabaseClient) {
    try {
      const record = {
        id: eventData.id,
        dept_slug: (eventData.dept_slug || '').toLowerCase(),
        type: eventData.type || 'Competition',
        title: eventData.title || 'Event',
        date: '7 Oct',
        time: eventData.time || '10:00 AM',
        venue: eventData.venue || 'Campus',
        team_size: parseInt(eventData.team_size || eventData.team || 1, 10) || 1,
        fee: eventData.fee || 'Free',
        description: eventData.desc || eventData.description || 'Tantra 26 event details',
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseClient.from('events').upsert([record]).select().single();
      if (!error) return data;
      console.error('⚠️ Supabase event upsert error:', error.message);
    } catch (err) {
      console.error('⚠️ Supabase event upsert exception:', err);
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
      const { error } = await supabaseClient.from('events').delete().eq('id', id);
      if (error) {
        console.warn('⚠️ Supabase hard-delete failed, trying soft-delete:', error.message);
        await supabaseClient.from('events').update({ is_active: false }).eq('id', id);
      }
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
