import { Router } from 'express';
import {
  getPaymentConfig,
  getAllPaymentConfigs,
  updatePaymentConfig,
} from '../controllers/payment.controller.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Public: get department payment QR and UPI ID
router.get('/departments/:dept/payment', getPaymentConfig);

// Protected: Super admin manages all department QRs & UPI IDs
router.get('/admin/payment', authenticate, requireSuperAdmin, getAllPaymentConfigs);
router.post('/admin/payment', authenticate, requireSuperAdmin, updatePaymentConfig);

export default router;
