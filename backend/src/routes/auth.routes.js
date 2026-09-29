import { Router } from 'express';
import { login, verifySession } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.get('/verify', authenticate, verifySession);

export default router;
