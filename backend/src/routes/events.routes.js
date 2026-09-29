import { Router } from 'express';
import {
  getEventsByDept,
  getAllEventsAdmin,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/events.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Public route for landing & department pages
router.get('/departments/:dept/events', getEventsByDept);

// Protected routes for admin dashboard
router.get('/admin/events', authenticate, getAllEventsAdmin);
router.post('/admin/events', authenticate, createEvent);
router.put('/admin/events/:id', authenticate, updateEvent);
router.delete('/admin/events/:id', authenticate, deleteEvent);

export default router;
