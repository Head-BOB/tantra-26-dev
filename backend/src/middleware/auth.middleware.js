import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied. Central super-admin privileges required.' });
  }
  next();
}

export function requireDeptOrSuperAdmin(req, res, next) {
  const targetDept = req.params.dept || req.body.dept_slug || req.query.dept;
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role === 'superadmin') {
    return next();
  }
  if (req.user.role === 'dept_admin' && req.user.dept === targetDept) {
    return next();
  }
  return res.status(403).json({ error: `Access denied. You only have management access for department: ${req.user.dept}` });
}
