import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';

// Create an instance of the Express application
const app: Express = express();

// --- Middleware Setup ---

// 1. Enable Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:3002',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://localhost:3001',
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow ALL chrome extensions (for development flexibility)
      if (origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'x-model-id'],
    credentials: true,
  })
);

app.use(express.json());

// --- API Routes ---

// A simple health check route to verify the server is running
app.get('/', (req: Request, res: Response) => {
  res.send('AI Email Assistant API is running!');
});

// Mount the authentication routes
app.use('/api/auth', authRoutes);

import userRoutes from './routes/userRoutes.js';
app.use('/api/user', userRoutes);

import aiRoutes from './routes/aiRoutes.js'; // <-- Import the new AI routes
app.use('/api/ai', aiRoutes); // <-- Use the new AI routes

// ... rest of your app.ts


import gmailRoutes from './routes/gmailRoutes.js';

// ... other app.use statements
app.use('/api/gmail', gmailRoutes); // <-- Add this line



import syncRoutes from './routes/syncRoutes.js';
// ... other app.use() calls
app.use('/api/sync', syncRoutes); // <-- ADD THIS

// Dashboard routes for analytics and metrics
import dashboardRoutes from './routes/dashboardRoutes.js';
app.use('/api/dashboard', dashboardRoutes);

import taskRoutes from './routes/tasks.js';
app.use('/api/tasks', taskRoutes);

// Admin routes for user management and platform stats
import adminRoutes from './routes/adminRoutes.js';
app.use('/api/admin', adminRoutes);

export default app;