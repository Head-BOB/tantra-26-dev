import { Router } from 'express';
import {
  getEventsByDept,
  getAllEventsAdmin,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventByAccessCode,
  updateEventByAccessCode,
  getSingleEvent,
} from '../controllers/events.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Public route for landing & department pages
router.get('/departments/:dept/events', getEventsByDept);

// Public route for individual event details
router.get('/events/:id', getSingleEvent);

// Public routes for event organisers logging in and managing via 6-digit passcode
router.get('/events/code/:code', getEventByAccessCode);
router.put('/events/code/:code', updateEventByAccessCode);

// Protected routes for admin dashboard
router.get('/admin/events', authenticate, getAllEventsAdmin);
router.post('/admin/events', authenticate, createEvent);
router.put('/admin/events/:id', authenticate, updateEvent);
router.delete('/admin/events/:id', authenticate, deleteEvent);

export default router;
