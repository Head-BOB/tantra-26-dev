import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createRegistration,
  getRegistrations,
  exportExcel,
} from '../controllers/regs.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Protect registration endpoint from spamming/bots: max 30 registrations per 5 mins per IP
const registrationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Too many registration requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public: student submit registration
router.post('/registrations', registrationLimiter, createRegistration);

// Protected: admin view registrations & export excel
router.get('/admin/registrations', authenticate, getRegistrations);
router.get('/admin/export/excel', authenticate, exportExcel);

export default router;
