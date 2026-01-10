import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';

// Create an instance of the Express application
const app: Express = express();

// --- Middleware Setup ---

// 1. Enable Cross-Origin Resource Sharing (CORS)
const extensionOrigin = 'chrome-extension://pljefinahpbeihfldbpgecimgoadinkh';
app.use(
  cors({
    origin: [
      'http://localhost:3002', // Your Next.js frontend
      'http://localhost:3000', // Dashboard / Dashboard-static (Next.js default port)
      extensionOrigin,       // Your Chrome Extension
      'http://localhost:5173', // Vite dev server
    ],
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

export default app;