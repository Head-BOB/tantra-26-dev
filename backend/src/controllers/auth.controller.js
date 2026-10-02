import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

const AUTH_MAP = {
  // Super Admin (Central Admin)
  'u9rcDp': { role: 'superadmin', name: 'Central Admin' },

  // Computer Science & Engineering
  'zWHCaX': { role: 'dept_admin', dept: 'cse', name: 'Computer Science & Engineering' },

  // Cyber Security
  'kY8sNw': { role: 'dept_admin', dept: 'cscy', name: 'Cyber Security' },

  // Artificial Intelligence & Data Science
  'MhFbxq': { role: 'dept_admin', dept: 'ai', name: 'Artificial Intelligence & Data Science' },

  // Computer Science & Design
  'gsGL3t': { role: 'dept_admin', dept: 'csd', name: 'Computer Science & Design' },

  // Computer Science & Business Systems
  'p6kjHf': { role: 'dept_admin', dept: 'csbs', name: 'Computer Science & Business Systems' },

  // Electrical & Electronics Engineering
  'RQKRk2': { role: 'dept_admin', dept: 'eee', name: 'Electrical & Electronics Engineering' },

  // Electronics & Communication Engineering
  'BXJ8eu': { role: 'dept_admin', dept: 'ece', name: 'Electronics & Communication Engineering' },

  // Applied Electronics & Instrumentation
  'fRLYKh': { role: 'dept_admin', dept: 'aei', name: 'Applied Electronics & Instrumentation' },

  // Civil Engineering
  'F5TwfY': { role: 'dept_admin', dept: 'civil', name: 'Civil Engineering' },

  // Mechanical Engineering
  'zEzU6v': { role: 'dept_admin', dept: 'mech', name: 'Mechanical Engineering' },
};

export async function login(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const cleanPw = String(password).trim();
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
