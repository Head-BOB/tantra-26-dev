import { supabase } from '../config/supabase.js';

// GET /api/departments/:dept/payment
export async function getPaymentConfig(req, res) {
  try {
    const dept = req.params.dept.toLowerCase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data, error } = await supabase
      .from('department_payments')
      .select('*')
      .eq('dept_slug', dept)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return res.json(data || {
      dept_slug: dept,
      upi_id: `tantra26.${dept}@okhdfcbank`,
      qr_image_url: null,
    });
  } catch (err) {
    console.error('Error fetching payment config:', err);
    return res.status(500).json({ error: 'Failed to fetch payment config.' });
  }
}

// GET /api/admin/payment (Super Admin)
export async function getAllPaymentConfigs(req, res) {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const { data, error } = await supabase
      .from('department_payments')
      .select('*');

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error fetching all payment configs:', err);
    return res.status(500).json({ error: 'Failed to fetch payment configs.' });
  }
}

// POST /api/admin/payment (Super Admin)
export async function updatePaymentConfig(req, res) {
  try {
    const { dept_slug, upi_id, qr_image_url } = req.body;
    const targetDept = (dept_slug || '').toLowerCase();

    if (!targetDept) {
      return res.status(400).json({ error: 'Department slug is required.' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database service not configured.' });
    }

    const payload = {
      dept_slug: targetDept,
      updated_at: new Date().toISOString(),
    };
    if (upi_id !== undefined) payload.upi_id = upi_id.trim();
    if (qr_image_url !== undefined) payload.qr_image_url = qr_image_url;

    const { data, error } = await supabase
      .from('department_payments')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, payment: data });
  } catch (err) {
    console.error('Error updating payment config:', err);
    return res.status(500).json({ error: 'Failed to update payment config.' });
  }
}
