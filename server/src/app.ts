// Use require for Express to bypass TypeScript issues
const express = require('express');
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as winston from 'winston';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { QdrantService } from './services/qdrant.service';
import { rateLimiter, speedLimiter, securityHeaders, requestSizeLimiter } from './middleware';
import { authenticate } from './middleware/auth';
import dataSourceRoutes, { chunkRouter } from './routes/data-source.routes';
import path from 'path';
import { RagService } from './services/rag.service';
import { configService } from './services/config.service';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import fileRoutes from './routes/file.routes';
import dashboardRoutes from './routes/dashboard.routes';
import organizationRoutes from './routes/organizationRoutes';
import automationRoutes from './routes/automation.routes';
import searchRoutes from './routes/search.routes';
import healthRoutes from './routes/health.routes';
import teamsRoutes from './routes/teams.routes';
import documentProcessingRoutes from './routes/document-processing.routes';
import { testRoutes } from './routes/test.routes';
import uploadRoutes from './routes/upload.routes';
import apiRoutes from './routes/api';
import fineTuningRoutes from './routes/fine-tuning.routes';
import qdrantRoutes from './routes/qdrant.routes';
import ragRoutes from './routes/rag.routes';
import snowflakeRoutes from './routes/snowflake.routes';
import vectorSearchRoutes from './routes/vector-search.routes';
import { asyncErrorHandler } from './middleware';
import { WebSocketService } from './services/websocket.service';
import { getServiceRegistry } from './services/service-registry';
import multer from 'multer';
// import * as Sentry from '@sentry/node'; // Temporarily commented out due to type issues
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import analyticsRoutes from './routes/analytics.routes';
import { resetPasswordRouter } from './routes/password-reset';
import { SocketService } from './services/socket.service';
import { EventManager } from './services/event-manager';

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [App]: ${message}`;
      return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [App]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

// Initialize app
const app = express();

// Configure security headers
app.use(securityHeaders);

// Configure helmet for secure headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Use compression middleware - use type assertion to fix TypeScript error
app.use(compression() as any);

// Configure request logging
app.use(morgan('combined'));

// Replace the cors middleware with our own custom implementation
// Comment out the original cors middleware
// app.use(cors(config.cors));

// Custom CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim());
  
  const origin = req.headers.origin;
  
  // Skip for requests without origin (like API tools or server to server)
  if (!origin) {
    return next();
  }
  
  // Always set CORS headers for all origins during development
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, Cache-Control, Credentials');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '600');
  
  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// First register the chunk upload routes before applying the JSON body parser
// This allows multer to handle the multipart/form-data for PDF chunks without interference
app.use('/api/data-sources/upload', chunkRouter);

// Configure body parser - only applied to routes registered after this point
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Apply request size limiter for non-JSON/form requests
app.use(requestSizeLimiter);

// Configure cookie parser
app.use(cookieParser());

// Configure rate limiting
app.use(rateLimiter);
app.use(speedLimiter);

// Initialize core services using the service registry
logger.info('Initializing document processing services...');
const serviceRegistry = getServiceRegistry();
const qdrantService = serviceRegistry.getQdrantService();
const ragService = new RagService();

// Health check endpoint
app.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.status(200).json({ 
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Special maintenance endpoint for fixing collection references
app.post('/api/maintenance/fix-collection-references', async (req, res) => {
  logger.info('Fix collection references maintenance endpoint called');
  try {
    // Create a new RagService instance
    const ragService = new RagService();
    
    // Run the collection references fix
    const result = await ragService.updateDataSourceCollectionReferences();
    
    // Return the result
    res.status(200).json({
      success: true,
      message: `Updated ${result.updated} collection references`,
      result
    });
  } catch (error) {
    logger.error('Error fixing collection references:', error);
    res.status(500).json({
      success: false,
      message: `Error fixing collection references: ${error}`
    });
  }
});

// Configure routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/organizations', organizationRoutes);
// Register the main data-sources router - this handles all regular routes 
// but the chunkRouter (registered earlier) handles binary uploads without JSON parsing
app.use('/api/data-sources', dataSourceRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/document-processing', documentProcessingRoutes);
app.use('/api/test', testRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ext', apiRoutes);
app.use('/api/fine-tuning', fineTuningRoutes);
app.use('/api/qdrant', qdrantRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/snowflake', snowflakeRoutes);
// Add the new vector search routes for both /api/ext and /api/qdrant endpoints
app.use('/api/ext', vectorSearchRoutes);
app.use('/api/qdrant', vectorSearchRoutes);

// Import and use workspace routes
import workspaceRoutes from './routes/workspace.routes';
app.use('/api/workspaces', workspaceRoutes);

// Import and use routes from the index router
import apiIndexRoutes from './routes/index';
app.use('/api', apiIndexRoutes);

// Configure multer for file uploads
const upload = multer({ 
  dest: path.join(process.cwd(), 'server/uploads/temp'),
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB limit (increased from 50MB)
});

// Add Excel processing endpoint
app.post('/api/excel/process', upload.single('file'), async (req, res) => {
  try {
    logger.info('Excel processing request received');
    
    // Check if user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const file = req.file;
    logger.info(`Processing Excel file: ${file.originalname}`);
    
    // Return success for now
    return res.status(200).json({ 
      success: true, 
      message: 'Excel file received',
      filename: file.originalname
    });
  } catch (error) {
    logger.error('Error processing Excel file:', error);
    return res.status(500).json({ error: 'Failed to process Excel file' });
  }
});

// Serve static files from the uploads directory
const uploadsPath = path.join(process.cwd(), config.uploadsDir);
logger.info(`Serving static files from ${uploadsPath}`);
app.use('/uploads', express.static(uploadsPath));

// Serve static files from the /files path (for organization logos and other files)
logger.info(`Also serving static files from ${uploadsPath} at /files path`);
app.use('/files', express.static(uploadsPath));

// Serve static files from the public directory
const publicPath = path.join(process.cwd(), 'server/public');
logger.info(`Serving static files from ${publicPath}`);
app.use(express.static(publicPath));

// Setup routes
app.use('/api/chat', authenticate, chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/data-sources', dataSourceRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/reset-password', resetPasswordRouter);
app.use('/api/ext', apiRoutes);
app.use('/api/qdrant', qdrantRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/qdrant', vectorSearchRoutes);

// Add a dedicated Collections endpoint for the frontend
app.get('/api/collections', authenticate, async (req, res) => {
  try {
    const qdrantService = QdrantService.getInstance();
    const collections = await qdrantService.listCollections();
    res.json(collections);
  } catch (error) {
    console.error('Error listing collections:', error);
    res.status(500).json({ error: 'Failed to list collections' });
  }
});

// Global error handler
app.use(asyncErrorHandler);

export default app; 