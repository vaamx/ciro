import dotenv from 'dotenv';
// Load environment variables before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { oauthRouter } from './routes/oauth';
import { proxyRouter } from './routes/proxy';
import chatRouter from './routes/chat';
import { authRouter } from './routes/auth';
import { refreshSession } from './middleware/auth';
import { initializeDatabase } from './infrastructure/database/init';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// Configure CORS
const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Authorization', 'Set-Cookie'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Enable pre-flight requests for all routes
app.options('*', cors(corsOptions));

// Session refresh middleware
app.use(refreshSession);

// Log all requests
app.use((req, res, next) => {
  const sanitizedBody = { ...req.body };
  if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
  if (sanitizedBody.newPassword) sanitizedBody.newPassword = '[REDACTED]';
  
  console.log(`${req.method} ${req.path}`, {
    body: sanitizedBody,
    cookies: req.cookies,
    headers: req.headers
  });
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/chat', chatRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

const PORT = Number(process.env.PORT) || 3001;

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
    });
  })
  .catch((error: Error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }); 