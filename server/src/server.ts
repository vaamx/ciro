import dotenv from 'dotenv';
// Load environment variables before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { oauthRouter } from './routes/oauth';
import { proxyRouter } from './routes/proxy';
import chatRouter from './routes/chat';
import authRouter from './routes/auth.routes';
import fileRouter from './routes/file.routes';
import automationRouter from './routes/automation.routes';
import dataSourceRouter from './routes/dataSource.routes';
import organizationRouter from './routes/organizationRoutes';
import { refreshSession } from './middleware/auth';
import path from 'path';

const app = express();

// Middleware
app.use(express.json());

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
app.use(cookieParser());
app.use(refreshSession);

// Static file serving
app.use('/files', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/files', fileRouter);
app.use('/api/automations', automationRouter);
app.use('/api/data-sources', dataSourceRouter);
app.use('/api/organizations', organizationRouter);
app.use('/oauth', oauthRouter);
app.use('/proxy', proxyRouter);

export default app; 