import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createLogger } from './utils/logger';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { QdrantService } from './services/qdrant.service';
import { rateLimiter, speedLimiter, securityHeaders } from './middleware';
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
import { asyncErrorHandler } from './middleware';
import { WebSocketService } from './services/websocket.service';
import { getServiceRegistry } from './services/service-registry';
import multer from 'multer';

// Initialize logger
const logger = createLogger('App');

// Initialize app
const app = express();

// Configure security headers
app.use(securityHeaders);

// Configure helmet for secure headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Use compression middleware
app.use(compression());

// Configure CORS
app.use(cors(config.cors));

// Configure request logging
app.use(morgan('combined'));

// First register the chunk upload routes before applying the JSON body parser
// This allows multer to handle the multipart/form-data for PDF chunks without interference
app.use('/api/data-sources/upload', chunkRouter);

// Configure body parser - only applied to routes registered after this point
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Configure multer for file uploads
const upload = multer({ 
  dest: path.join(process.cwd(), 'server/uploads/temp'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
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

// Serve static files from the public directory
const publicPath = path.join(process.cwd(), 'server/public');
logger.info(`Serving static files from ${publicPath}`);
app.use(express.static(publicPath));

// Global error handler
app.use(asyncErrorHandler);

export default app; 