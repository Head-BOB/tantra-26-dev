import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env.js';

import authRoutes from './routes/auth.routes.js';
import eventsRoutes from './routes/events.routes.js';
import coordsRoutes from './routes/coords.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import regsRoutes from './routes/regs.routes.js';

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ENV.FRONTEND_URL.includes('*') || ENV.FRONTEND_URL.includes(origin)) {
      return callback(null, true);
    }
    // Allow any localhost and vercel preview branches
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive default to avoid blocking college networks
  },
  credentials: true,
}));

// Body parsing with 10mb limit for QR upload
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting for general traffic (1000 requests per 10 mins per IP)
const globalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Health check endpoint for Render & monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'tantra-26-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', eventsRoutes);
app.use('/api', coordsRoutes);
app.use('/api', paymentRoutes);
app.use('/api', regsRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Tantra 26 API Server is running. Visit /health for system status.');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const server = app.listen(ENV.PORT, () => {
  console.log(`🚀 Tantra 26 Backend running on http://localhost:${ENV.PORT} [${ENV.NODE_ENV}]`);
});

export default app;
