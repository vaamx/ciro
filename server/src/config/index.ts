import dotenv from 'dotenv';
import { Config } from '../types/config';

// Load environment variables
dotenv.config();

const config: Config = {
  port: process.env.PORT || 3001,
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || '***REMOVED***',
    password: process.env.DB_PASSWORD || '***REMOVED***',
    database: process.env.DB_NAME || 'ciro_db'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    orgId: process.env.OPENAI_ORG_ID,
    baseURL: process.env.OPENAI_API_BASE
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Get allowed origins from environment variables
      const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map(o => o.trim());
      
      // Check if the origin is allowed
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        // Return the specific requesting origin
        callback(null, origin);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
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
    maxAge: 600
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  },
  tasks: {
    summarizationInterval: process.env.SUMMARIZATION_INTERVAL ? parseInt(process.env.SUMMARIZATION_INTERVAL) : undefined,
    cleanupInterval: process.env.CLEANUP_INTERVAL ? parseInt(process.env.CLEANUP_INTERVAL) : undefined,
    indexingInterval: process.env.INDEXING_INTERVAL ? parseInt(process.env.INDEXING_INTERVAL) : undefined
  },
};

export { config }; 