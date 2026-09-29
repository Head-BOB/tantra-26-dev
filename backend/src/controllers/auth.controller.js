import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

const AUTH_MAP = {
  // Super Admin
  'tantra26':       { role: 'superadmin', name: 'Central Admin' },
  'tantra26-admin': { role: 'superadmin', name: 'Central Admin' },
  'admin26':        { role: 'superadmin', name: 'Central Admin' },

  // Computer Science
  'cse26':        { role: 'dept_admin', dept: 'cse', name: 'Computer Science' },
  'tantra-cse':   { role: 'dept_admin', dept: 'cse', name: 'Computer Science' },
  'tantra26-cse': { role: 'dept_admin', dept: 'cse', name: 'Computer Science' },

  // Artificial Intelligence
  'ai26':         { role: 'dept_admin', dept: 'ai', name: 'Artificial Intelligence' },
  'tantra-ai':    { role: 'dept_admin', dept: 'ai', name: 'Artificial Intelligence' },
  'tantra26-ai':  { role: 'dept_admin', dept: 'ai', name: 'Artificial Intelligence' },

  // Civil Engineering
  'civil26':        { role: 'dept_admin', dept: 'civil', name: 'Civil Engineering' },
  'tantra-civil':   { role: 'dept_admin', dept: 'civil', name: 'Civil Engineering' },
  'tantra26-civil': { role: 'dept_admin', dept: 'civil', name: 'Civil Engineering' },

  // Mechanical Engineering
  'mech26':        { role: 'dept_admin', dept: 'mech', name: 'Mechanical' },
  'tantra-mech':   { role: 'dept_admin', dept: 'mech', name: 'Mechanical' },
  'tantra26-mech': { role: 'dept_admin', dept: 'mech', name: 'Mechanical' },

  // Electrical & Electronics
  'eee26':        { role: 'dept_admin', dept: 'eee', name: 'Electrical & Electronics' },
  'tantra-eee':   { role: 'dept_admin', dept: 'eee', name: 'Electrical & Electronics' },
  'tantra26-eee': { role: 'dept_admin', dept: 'eee', name: 'Electrical & Electronics' },
};

export async function login(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const cleanPw = String(password).trim().toLowerCase();
    const user = AUTH_MAP[cleanPw];

    if (!user) {
      return res.status(401).json({ error: 'Invalid password. Check your department code or central admin password.' });
    }

    // Sign JWT valid for 7 days
    const token = jwt.sign(
      {
        role: user.role,
        dept: user.dept || null,
        name: user.name,
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        role: user.role,
        dept: user.dept || null,
        name: user.name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

export function verifySession(req, res) {
  // If authenticate middleware passed, req.user is valid
  return res.json({
    valid: true,
    user: req.user,
  });
}
