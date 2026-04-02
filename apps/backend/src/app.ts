import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

// ─── Route Imports ───────────────────────────────────
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import gmailRoutes from './routes/gmailRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import taskRoutes from './routes/tasks.js';
import adminRoutes from './routes/adminRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import modelRoutes from './routes/modelRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import upgradeRoutes from './routes/upgradeRoutes.js';
import { env } from './config/env.js';

// ─── Middleware Imports ──────────────────────────────
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

// ─── App Setup ───────────────────────────────────────
const app: Express = express();

// Trust the first proxy (essential for rate limiting behind Nginx/Heroku/etc)
app.set('trust proxy', 1);

// ─── Security & Parsing Middleware ───────────────────
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
]);

if (env.DASHBOARD_URL) {
  allowedOrigins.add(env.DASHBOARD_URL.replace(/\/$/, ''));
}

if (env.CORS_ORIGINS) {
  for (const origin of env.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)) {
    allowedOrigins.add(origin.replace(/\/$/, ''));
  }
}

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');

      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      // Allow all Chrome extensions (development flexibility)
      if (origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'x-model-id'],
    credentials: true,
  })
);

// ─── Documentation ───────────────────────────────────
app.get('/api-docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Health Check ────────────────────────────────────
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the status of the API
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/upgrade', upgradeRoutes);

// ─── Error Handling (must be AFTER all routes) ───────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
