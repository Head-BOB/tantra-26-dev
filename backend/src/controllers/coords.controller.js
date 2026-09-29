import { supabase } from '../config/supabase.js';

// GET /api/departments/:dept/coords
export async function getCoordsByDept(req, res) {
  try {
    const dept = req.params.dept.toLowerCase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data, error } = await supabase
      .from('coordinators')
      .select('*')
      .eq('dept_slug', dept)
      .order('display_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('Error fetching coordinators:', err);
    return res.status(500).json({ error: 'Failed to fetch coordinators.' });
  }
}

// POST /api/admin/coords
export async function createCoord(req, res) {
  try {
    const { dept_slug, name, phone } = req.body;
    const targetDept = (dept_slug || '').toLowerCase();

    if (req.user.role === 'dept_admin' && req.user.dept !== targetDept) {
      return res.status(403).json({ error: 'Cannot add coordinators for another department.' });
    }

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required.' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data, error } = await supabase
      .from('coordinators')
      .insert([{ dept_slug: targetDept, name: name.trim(), phone: phone.trim() }])
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ success: true, coordinator: data });
  } catch (err) {
    console.error('Error creating coordinator:', err);
    return res.status(500).json({ error: 'Failed to create coordinator.' });
  }
}

// PUT /api/admin/coords/:id
export async function updateCoord(req, res) {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('coordinators')
      .select('dept_slug')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Coordinator not found.' });
    }

    if (req.user.role === 'dept_admin' && req.user.dept !== existing.dept_slug) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();

    const { data, error } = await supabase
      .from('coordinators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, coordinator: data });
  } catch (err) {
    console.error('Error updating coordinator:', err);
    return res.status(500).json({ error: 'Failed to update coordinator.' });
  }
}

// DELETE /api/admin/coords/:id
export async function deleteCoord(req, res) {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('coordinators')
      .select('dept_slug')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Coordinator not found.' });
    }

    if (req.user.role === 'dept_admin' && req.user.dept !== existing.dept_slug) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { error } = await supabase.from('coordinators').delete().eq('id', id);
    if (error) throw error;

    return res.json({ success: true, message: 'Coordinator deleted.' });
  } catch (err) {
    console.error('Error deleting coordinator:', err);
    return res.status(500).json({ error: 'Failed to delete coordinator.' });
  }
}
