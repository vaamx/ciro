import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat';
import fileRoutes from './routes/file.routes';
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

const app = express();

// CORS configuration
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

// Cookie parser middleware
app.use(cookieParser());

// Security middleware
app.use(securityHeaders);
app.use(rateLimiter);
app.use(speedLimiter);
app.use(requestSizeLimiter);

// Body parsing middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Security middleware for request body
app.use(sanitizeInput);
app.use(sqlInjectionPrevention);

// Serve static files from the uploads directory
app.use('/files', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app; 