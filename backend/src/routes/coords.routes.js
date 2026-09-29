import { Router } from 'express';
import {
  getCoordsByDept,
  createCoord,
  updateCoord,
  deleteCoord,
} from '../controllers/coords.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Public: get organisers for department
router.get('/departments/:dept/coords', getCoordsByDept);

// Protected: manage organisers
router.post('/admin/coords', authenticate, createCoord);
router.put('/admin/coords/:id', authenticate, updateCoord);
router.delete('/admin/coords/:id', authenticate, deleteCoord);

export default router;
