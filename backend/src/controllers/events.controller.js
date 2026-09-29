import { supabase } from '../config/supabase.js';

// Simple in-memory cache for high-concurrency read efficiency (TTL 60s)
const CACHE = {
  data: {},
  expiry: {},
};

function getCache(key) {
  if (CACHE.expiry[key] && Date.now() < CACHE.expiry[key]) {
    return CACHE.data[key];
  }
  return null;
}

function setCache(key, val, ttlSeconds = 60) {
  CACHE.data[key] = val;
  CACHE.expiry[key] = Date.now() + ttlSeconds * 1000;
}

export function clearEventsCache() {
  CACHE.data = {};
  CACHE.expiry = {};
}

// GET /api/departments/:dept/events
export async function getEventsByDept(req, res) {
  try {
    const dept = req.params.dept.toLowerCase();
    const cacheKey = `events_${dept}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('dept_slug', dept)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    setCache(cacheKey, data, 60);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching events:', err);
    return res.status(500).json({ error: 'Failed to fetch events.' });
  }
}

// GET /api/admin/events
export async function getAllEventsAdmin(req, res) {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    let query = supabase.from('events').select('*').order('created_at', { ascending: true });

    // If department admin, restrict to their department
    if (req.user && req.user.role === 'dept_admin') {
      query = query.eq('dept_slug', req.user.dept);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('Error fetching admin events:', err);
    return res.status(500).json({ error: 'Failed to fetch admin events.' });
  }
}

// POST /api/admin/events
export async function createEvent(req, res) {
  try {
    const { id, dept_slug, type, title, time, venue, team_size, fee, description } = req.body;

    // Validate department access
    const targetDept = (dept_slug || '').toLowerCase();
    if (req.user.role === 'dept_admin' && req.user.dept !== targetDept) {
      return res.status(403).json({ error: 'Cannot create events for another department.' });
    }

    if (!title || !time || !venue || !description) {
      return res.status(400).json({ error: 'Missing required event fields.' });
    }

    const eventId = id || (title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6));

    const newEvent = {
      id: eventId,
      dept_slug: targetDept,
      type: type || 'Competition',
      title: title.trim(),
      date: '7 Oct', // Strict fest date requirement
      time: time.trim(),
      venue: venue.trim(),
      team_size: parseInt(team_size, 10) || 1,
      fee: fee ? fee.trim() : 'Free',
      description: description.trim(),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data, error } = await supabase.from('events').insert([newEvent]).select().single();
    if (error) throw error;

    clearEventsCache();
    return res.status(201).json({ success: true, event: data });
  } catch (err) {
    console.error('Error creating event:', err);
    return res.status(500).json({ error: err.message || 'Failed to create event.' });
  }
}

// PUT /api/admin/events/:id
export async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const { type, title, time, venue, team_size, fee, description } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('events')
      .select('dept_slug')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    if (req.user.role === 'dept_admin' && req.user.dept !== existing.dept_slug) {
      return res.status(403).json({ error: 'Cannot edit event belonging to another department.' });
    }

    const updates = {
      date: '7 Oct', // Always 7 Oct
      updated_at: new Date().toISOString(),
    };
    if (type !== undefined) updates.type = type;
    if (title !== undefined) updates.title = title.trim();
    if (time !== undefined) updates.time = time.trim();
    if (venue !== undefined) updates.venue = venue.trim();
    if (team_size !== undefined) updates.team_size = parseInt(team_size, 10) || 1;
    if (fee !== undefined) updates.fee = fee.trim();
    if (description !== undefined) updates.description = description.trim();

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    clearEventsCache();
    return res.json({ success: true, event: data });
  } catch (err) {
    console.error('Error updating event:', err);
    return res.status(500).json({ error: err.message || 'Failed to update event.' });
  }
}

// DELETE /api/admin/events/:id
export async function deleteEvent(req, res) {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('events')
      .select('dept_slug')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    if (req.user.role === 'dept_admin' && req.user.dept !== existing.dept_slug) {
      return res.status(403).json({ error: 'Cannot delete event belonging to another department.' });
    }

    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;

    clearEventsCache();
    return res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) {
    console.error('Error deleting event:', err);
    return res.status(500).json({ error: 'Failed to delete event.' });
  }
}
