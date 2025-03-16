// Main server initialization file
import { DocumentProcessorService } from './services/document-processor.service';
import { config } from './config';
import { SocketService } from './services/socket.service';
import { initializeDatabase } from './infrastructure/database/init';
import { runMigrations } from './infrastructure/database/migrate';
import Server from './server';
import path from 'path';
import knex from 'knex';
import * as winston from 'winston';
import { getServiceRegistry } from './services/service-registry';
import runEnvironmentChecks from './utils/check-env';
import { RagService } from './services/rag.service';
import { db } from './infrastructure/database';

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [Server]: ${message}`;
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
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [Server]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

// Function to ensure collection_name column exists and update references
async function updateCollectionReferences() {
  try {
    logger.info('Checking for collection_name column in data_sources table...');
    
    // Check if column exists
    const result = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'data_sources' AND column_name = 'collection_name'
    `);
    
    if (result.rows.length === 0) {
      logger.info('collection_name column does not exist, adding it to data_sources table');
      
      // Add the column
      await db.schema.table('data_sources', table => {
        table.string('collection_name').nullable();
      });
      
      logger.info('Added collection_name column to data_sources table');
    } else {
      logger.info('collection_name column already exists');
    }
    
    // Run the collection references fix
    logger.info('Running collection references fix...');
    const ragService = new RagService();
    const result2 = await ragService.updateDataSourceCollectionReferences();
    logger.info(`Collection references fix completed: Updated ${result2.updated} data sources, ${result2.errors} errors`);
    return true;
  } catch (error) {
    logger.error('Error updating collection references:', error);
    return false;
  }
}

// Create necessary directories
async function createMissingDirectories() {
  const fs = require('fs');
  const mkdirp = (dir: string) => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });
  
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.resolve(process.cwd(), config.uploadsDir);
  mkdirp(uploadsDir);
  logger.info(`Uploads directory: ${uploadsDir}`);
  
  // Create logs directory if it doesn't exist
  const logsDir = path.resolve(process.cwd(), 'logs');
  mkdirp(logsDir);
  logger.info(`Logs directory: ${logsDir}`);
}

// Database initialization
async function initializePostgres() {
  try {
    logger.info('Initializing PostgreSQL connection...');
    
    // Use the configured host and port
    const host = config.database.host;
    const port = config.database.port;
    logger.info(`PostgreSQL connection settings: ${host}:${port}`);
    
    // Initialize Knex with the configured settings
    const db = knex({
      client: 'pg',
      connection: {
        host,
        port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database
      }
    });
    
    // Test connection
    const result = await db.raw('SELECT 1+1 as result');
    if (result.rows[0].result === 2) {
      logger.info('PostgreSQL connection successful!');
      return true;
    } else {
      logger.error('PostgreSQL connection test failed');
      return false;
    }
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL connection', { error });
    return false;
  }
}

// Run environment checks
runEnvironmentChecks();

// Check critical configuration
console.log('Database connection configured with:');
console.log(`- Host: ${config.database.host}`);
console.log(`- Port: ${config.database.port}`);
console.log(`- User: ${config.database.user}`);
console.log(`- Database: ${config.database.database}`);
console.log(`- Environment: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Local Development'}`);

// Check OpenAI API key
const openAiKey = process.env.OPENAI_API_KEY || (config.openai && config.openai.apiKey);
console.log(`OpenAI API key present: ${!!openAiKey}`);
if (openAiKey) {
  console.log(`OpenAI API key starts with: ${openAiKey.substring(0, 12)}...`);
  console.log(`OpenAI API base URL: ${process.env.OPENAI_API_BASE || ((config.openai as any) && (config.openai as any).baseURL) || 'https://api.openai.com/v1'}`);
} else {
  console.error('WARNING: OpenAI API key is missing! Embeddings and completions will not work.');
}

// Initialize Qdrant
const qdrantUrl = (config as any).qdrant?.url || 'http://localhost:6333';
console.log(`Qdrant URL: ${qdrantUrl}`);

// Start services and server
async function startServer() {
  logger.info('Starting server...');
  
  try {
    // Create necessary directories
    await createMissingDirectories();
    
    // Initialize database connection
    const dbInitialized = await initializePostgres();
    if (!dbInitialized) {
      logger.warn('Failed to initialize database. Continuing with limited functionality.');
    }
    
    // Run migrations
    try {
      await runMigrations();
      logger.info('Database migrations completed successfully.');
    } catch (error) {
      logger.error('Error running migrations', { error });
      logger.warn('Continuing without migrations. Some features may not work correctly.');
    }
    
    // Run the collection references fix
    try {
      await updateCollectionReferences();
    } catch (error) {
      logger.error('Error updating collection references, continuing anyway:', error);
    }
    
    // Initialize services via service registry to ensure proper singleton management
    const serviceRegistry = getServiceRegistry();
    
    // Pre-initialize document processor to ensure it's ready before requests come in
    const documentProcessor = DocumentProcessorService.getInstance();
    
    // Initialize server
    const server = new Server();
    
    // Start HTTP server
    try {
      server.start();
      logger.info(`Server running on port ${config.port}`);

      // Add logging middleware to track RAG requests/responses
      const express = require('express');
      const app = express();
      app.use('/api/rag/*', (req, res, next) => {
        const originalSend = res.send;
        const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
        
        console.log(`[${requestId}] RAG request received: ${req.method} ${req.originalUrl}`);
        
        // Override send method to log responses
        res.send = function(body) {
          // Convert response to string if it's an object
          const responseStr = typeof body === 'object' ? JSON.stringify(body) : body;
          const responsePreview = responseStr.substring(0, 100) + (responseStr.length > 100 ? '...' : '');
          
          console.log(`[${requestId}] RAG response sent: ${responsePreview}`);
          console.log(`[${requestId}] Response size: ${responseStr.length} bytes`);
          
          // Call the original send method
          return originalSend.call(this, body);
        };
        
        next();
      });

      return true;
    } catch (error) {
      logger.error('Failed to start server', { error });
      return false;
    }
  } catch (error) {
    logger.error('Error starting server', { error });
    return false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  try {
    const server = new Server();
    await server.stop();
    
    logger.info('Server and services stopped successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  try {
    const server = new Server();
    await server.stop();
    
    logger.info('Server and services stopped successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

// Start the server
startServer().then(started => {
  if (!started) {
    logger.error('Failed to start server');
    process.exit(1);
  }
}).catch(error => {
  logger.error('Unhandled error starting server', { error });
  process.exit(1);
}); 