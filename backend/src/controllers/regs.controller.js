import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(__dirname, '../../db/registrations.json');

function loadLocalRegs() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading local registrations:', err);
  }
  return [];
}

function saveLocalRegs(regs) {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(regs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local registrations:', err);
  }
}

// Helper to generate a sleek, unique pass ID with 4 characters on the right side
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateRegId(deptSlug, existingSet = null) {
  const code = (deptSlug || 'GEN').toUpperCase();
  for (let attempt = 0; attempt < 100; attempt++) {
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    const candidate = `T26-${code}-${rand}`;
    if (!existingSet || !existingSet.has(candidate)) {
      if (existingSet) existingSet.add(candidate);
      return candidate;
    }
  }
  const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase();
  return `T26-${code}-${hex}`;
}

// POST /api/registrations (Public registration submission)
export async function createRegistration(req, res) {
  try {
    const {
      dept_slug,
      event_id,
      event_title,
      name,
      email,
      phone,
      college,
      team_members,
      fee,
      txn_id,
    } = req.body;

    // 1. Validation
    if (!dept_slug || !event_id || !name || !email || !phone || !college) {
      return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/\D/g, '');

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number. Must be at least 10 digits.' });
    }

    const cleanTxnId = (txn_id || 'FREE-REGISTRATION').trim();

    if (!supabase) {
      const localRegs = loadLocalRegs();
      const existing = localRegs.find(
        (r) => r.event_id === event_id && r.email.toLowerCase() === cleanEmail
      );
      if (existing) {
        return res.status(409).json({ error: 'This email address is already registered for this event.' });
      }

      // Check duplicate UPI transaction ID / UTR
      if (cleanTxnId && cleanTxnId.toUpperCase() !== 'FREE-REGISTRATION') {
        const txnExists = localRegs.find(
          (r) => r.txn_id &&
          r.txn_id.toUpperCase() !== 'FREE-REGISTRATION' &&
          r.txn_id.toLowerCase().trim() === cleanTxnId.toLowerCase()
        );
        if (txnExists) {
          return res.status(409).json({
            error: 'This UPI Transaction ID / UTR number has already been used for another registration.'
          });
        }
      }

      const regId = generateRegId(dept_slug);
      const newRecord = {
        id: localRegs.length + 1,
        reg_id: regId,
        dept_slug: dept_slug.toLowerCase(),
        event_id,
        event_title: (event_title || event_id).trim(),
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        college: college.trim(),
        team_members: team_members ? String(team_members).trim() : null,
        fee: fee ? fee.trim() : 'Free',
        txn_id: cleanTxnId,
        created_at: new Date().toISOString(),
      };

      localRegs.unshift(newRecord);
      saveLocalRegs(localRegs);

      return res.status(201).json({
        success: true,
        message: 'Registration confirmed!',
        pass: {
          regId: newRecord.reg_id,
          name: newRecord.name,
          email: newRecord.email,
          college: newRecord.college,
          event: newRecord.event_title,
          fee: newRecord.fee,
          txnId: newRecord.txn_id,
          time: newRecord.created_at,
        },
      });
    }

    // 2. Check for duplicate registration on this event (Supabase)
    const { data: existing } = await supabase
      .from('registrations')
      .select('id')
      .eq('event_id', event_id)
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'This email address is already registered for this event.' });
    }

    // Check duplicate UPI transaction ID / UTR (Supabase)
    if (cleanTxnId && cleanTxnId.toUpperCase() !== 'FREE-REGISTRATION') {
      const { data: existingTxn } = await supabase
        .from('registrations')
        .select('id')
        .eq('txn_id', cleanTxnId)
        .maybeSingle();

      if (existingTxn) {
        return res.status(409).json({
          error: 'This UPI Transaction ID / UTR number has already been used for another registration.'
        });
      }
    }

    // 3. Generate Pass ID with real-time collision check & Insert record
    let regId = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateRegId(dept_slug);
      const { data: dup } = await supabase
        .from('registrations')
        .select('id')
        .eq('reg_id', candidate)
        .maybeSingle();
      if (!dup) {
        regId = candidate;
        break;
      }
    }
    if (!regId) regId = generateRegId(dept_slug);

    const newRecord = {
      reg_id: regId,
      dept_slug: dept_slug.toLowerCase(),
      event_id,
      event_title: (event_title || event_id).trim(),
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      college: college.trim(),
      team_members: team_members ? String(team_members).trim() : null,
      fee: fee ? fee.trim() : 'Free',
      txn_id: cleanTxnId,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('registrations')
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Postgres unique constraint violation
        return res.status(409).json({ error: 'This email address is already registered for this event.' });
      }
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: 'Registration confirmed!',
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
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message || 'Failed to submit registration.' });
  }
}

// GET /api/admin/registrations (Protected)
export async function getRegistrations(req, res) {
  try {
    if (!supabase) {
      let data = loadLocalRegs();
      if (req.user.role === 'dept_admin') {
        data = data.filter(r => r.dept_slug === req.user.dept);
      } else if (req.query.dept && req.query.dept !== 'all') {
        data = data.filter(r => r.dept_slug === req.query.dept.toLowerCase());
      }
      return res.json(data);
    }

    let query = supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    // Department admin can only view their own department registrations
    if (req.user.role === 'dept_admin') {
      query = query.eq('dept_slug', req.user.dept);
    } else if (req.query.dept && req.query.dept !== 'all') {
      query = query.eq('dept_slug', req.query.dept.toLowerCase());
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    return res.status(500).json({ error: 'Failed to fetch registrations.' });
  }
}

// GET /api/admin/export/excel (Protected spreadsheet stream)
export async function exportExcel(req, res) {
  try {
    if (!supabase) {
      let regs = loadLocalRegs();
      let targetDept = null;
      if (req.user.role === 'dept_admin') {
        targetDept = req.user.dept;
        regs = regs.filter(r => r.dept_slug === targetDept);
      } else if (req.query.dept && req.query.dept !== 'all') {
        targetDept = req.query.dept.toLowerCase();
        regs = regs.filter(r => r.dept_slug === targetDept);
      }

      if (!regs || regs.length === 0) {
        return res.status(404).json({ error: 'No registrations found to export.' });
      }

      const excelData = regs.map((r, i) => ({
        'Sl No': i + 1,
        'Registration ID': r.reg_id,
        'Participant Name': r.name,
        'College / Institution': r.college,
        'Email Address': r.email,
        'Phone Number': r.phone,
        'Department': r.dept_slug.toUpperCase(),
        'Event Title': r.event_title,
        'Entry Fee': r.fee,
        'Team Members': r.team_members || 'Individual',
        'UPI Transaction ID / UTR': r.txn_id,
        'Registration Time': new Date(r.created_at).toLocaleString('en-IN'),
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      ws['!cols'] = [
        { wch: 8 },  { wch: 18 }, { wch: 22 }, { wch: 30 },
        { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 24 },
        { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
      ];
      const wb = XLSX.utils.book_new();
      const sheetName = targetDept ? targetDept.toUpperCase() : 'All Registrations';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = targetDept
        ? `Tantra26_${targetDept.toUpperCase()}_Registrations.xlsx`
        : `Tantra26_Master_Registrations.xlsx`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    let query = supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: true });

    let targetDept = null;
    if (req.user.role === 'dept_admin') {
      targetDept = req.user.dept;
      query = query.eq('dept_slug', targetDept);
    } else if (req.query.dept && req.query.dept !== 'all') {
      targetDept = req.query.dept.toLowerCase();
      query = query.eq('dept_slug', targetDept);
    }

    const { data: regs, error } = await query;
    if (error) throw error;

    if (!regs || regs.length === 0) {
      return res.status(404).json({ error: 'No registrations found to export.' });
    }

    // Format rows
    const excelData = regs.map((r, i) => ({
      'Sl No': i + 1,
      'Registration ID': r.reg_id,
      'Participant Name': r.name,
      'College / Institution': r.college,
      'Email Address': r.email,
      'Phone Number': r.phone,
      'Department': r.dept_slug.toUpperCase(),
      'Event Title': r.event_title,
      'Entry Fee': r.fee,
      'Team Members': r.team_members || 'Individual',
      'UPI Transaction ID / UTR': r.txn_id,
      'Registration Time': new Date(r.created_at).toLocaleString('en-IN'),
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 8 },  // Sl No
      { wch: 18 }, // Reg ID
      { wch: 22 }, // Name
      { wch: 30 }, // College
      { wch: 26 }, // Email
      { wch: 16 }, // Phone
      { wch: 14 }, // Dept
      { wch: 24 }, // Event
      { wch: 12 }, // Fee
      { wch: 24 }, // Team
      { wch: 24 }, // Txn ID
      { wch: 24 }, // Time
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = targetDept ? targetDept.toUpperCase() : 'All Registrations';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = targetDept
      ? `Tantra26_${targetDept.toUpperCase()}_Registrations.xlsx`
      : `Tantra26_Master_Registrations.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch (err) {
    console.error('Error exporting Excel:', err);
    return res.status(500).json({ error: 'Failed to generate Excel file.' });
  }
}
