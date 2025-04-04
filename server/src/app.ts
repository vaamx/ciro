import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat';
import fileRoutes from './routes/file.routes';
import dashboardRoutes from './routes/dashboard.routes';
import organizationRoutes from './routes/organizationRoutes';
import dataSourceRoutes from './routes/dataSource.routes';
import automationRoutes from './routes/automation.routes';
import {
  rateLimiter,
  speedLimiter,
  securityHeaders,
  requestSizeLimiter,
  sanitizeInput,
  sqlInjectionPrevention,
  errorHandler
} from './middleware/security';
import { config } from './config/index';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import { initializeUploadDirectories, UPLOAD_DIR } from './utils/upload';
import { RequestHandler } from 'express';

const app = express();

// Initialize upload directories at startup
initializeUploadDirectories().catch(error => {
  console.error('Failed to initialize upload directories:', error);
  process.exit(1); // Exit if we can't set up critical directories
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? config.cors.origin 
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'Origin', 
    'X-Requested-With',
    'Credentials'
  ],
  exposedHeaders: ['set-cookie'],
  maxAge: 600 // 10 minutes
}));
app.use(compression());
app.use(morgan('dev'));

// Cookie parser middleware
app.use(cookieParser());

// Security middleware
app.use(securityHeaders as unknown as express.RequestHandler);
app.use(rateLimiter as unknown as express.RequestHandler);
app.use(speedLimiter as unknown as express.RequestHandler);
app.use(requestSizeLimiter as unknown as express.RequestHandler);

// Body parsing middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Security middleware for request body
app.use(sanitizeInput as unknown as express.RequestHandler);
app.use(sqlInjectionPrevention as unknown as express.RequestHandler);

// Serve static files from the uploads directory
app.use('/files', (req, res, next) => {
  console.log('Static file request:', {
    url: req.url,
    method: req.method,
    headers: req.headers,
    fullPath: path.resolve(UPLOAD_DIR, req.url.replace(/^\/+/, ''))
  });
  next();
}, express.static(UPLOAD_DIR, {
  index: false,
  fallthrough: true,
  redirect: false
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/data-sources', dataSourceRoutes);
app.use('/api/automations', automationRoutes);

// Error handling
app.use(errorHandler as unknown as express.ErrorRequestHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app; 