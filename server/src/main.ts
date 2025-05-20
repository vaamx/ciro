// Register module aliases
import 'module-alias/register';
import * as net from 'net';
import * as os from 'os';
import * as fs from 'fs';
import express from 'express';

// Add global handlers EARLY
process.on('unhandledRejection', (reason, promise) => {
  console.error('>>> FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Exit forcefully
});

process.on('uncaughtException', (error) => {
  console.error('>>> FATAL: Uncaught Exception:', error);
  process.exit(1); // Exit forcefully
});

// Add global crypto polyfill for @nestjs/typeorm
import * as nodeCrypto from 'crypto';

if (typeof global.crypto === 'undefined') {
  // Apply the polyfill only if global.crypto is not defined
  global.crypto = {
    // @ts-ignore - this is a polyfill
    subtle: {}, // Add if needed for specific crypto operations
    getRandomValues: function(buffer) {
      return nodeCrypto.randomFillSync(buffer);
    },
    // @ts-ignore - TypeScript doesn't recognize our implementation
    randomUUID: function() {
      if (nodeCrypto.randomUUID) {
        return nodeCrypto.randomUUID();
      }
      // Generate a v4 UUID if randomUUID is not available
      const bytes = nodeCrypto.randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
      
      // Format UUID string
      const hexBytes = bytes.toString('hex');
      return `${hexBytes.slice(0, 8)}-${hexBytes.slice(8, 12)}-${hexBytes.slice(12, 16)}-${hexBytes.slice(16, 20)}-${hexBytes.slice(20)}`;
    }
  };
} else {
  // If global.crypto exists, check if specific methods like randomUUID are missing
  if (typeof global.crypto.randomUUID === 'undefined') {
    try {
      Object.defineProperty(global.crypto, 'randomUUID', {
        value: function() {
          if (nodeCrypto.randomUUID) {
            return nodeCrypto.randomUUID();
          }
          // Fallback UUID generation
          const bytes = nodeCrypto.randomBytes(16);
          bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
          bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
          const hexBytes = bytes.toString('hex');
          return `${hexBytes.slice(0, 8)}-${hexBytes.slice(8, 12)}-${hexBytes.slice(12, 16)}-${hexBytes.slice(16, 20)}-${hexBytes.slice(20)}`;
        },
        writable: true, // Attempt to make it writable, though this might not always succeed
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      console.warn('Could not polyfill global.crypto.randomUUID due to existing property constraints:', e);
    }
  }
  // Similarly, check for getRandomValues if it's also used by your dependencies
  if (typeof global.crypto.getRandomValues === 'undefined') {
    try {
      Object.defineProperty(global.crypto, 'getRandomValues', {
        value: function(buffer: Buffer) { // Explicitly type buffer
          return nodeCrypto.randomFillSync(buffer);
        },
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      console.warn('Could not polyfill global.crypto.getRandomValues due to existing property constraints:', e);
    }
  }
  // Ensure subtle is an object if it's not already or is undefined
  if (typeof global.crypto.subtle === 'undefined') {
    try {
      Object.defineProperty(global.crypto, 'subtle', {
        value: {},
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      console.warn('Could not polyfill global.crypto.subtle due to existing property constraints:', e);
    }
  } else if (global.crypto.subtle === null || typeof global.crypto.subtle !== 'object') {
     // If subtle exists but is not an object (e.g. null), try to overwrite
     // This is risky and might fail if the property is not configurable
    try {
      Object.defineProperty(global.crypto, 'subtle', {
        value: {},
        writable: true,
        configurable: true, // Must be true to allow redefining
        enumerable: true,
      });
    } catch (e) {
      console.warn('Could not re-polyfill global.crypto.subtle to be an object:', e);
    }
  }
}

import * as winston from 'winston';

// Define a patch function to ensure Winston logger methods exist
function ensureLoggerMethods(logger: winston.Logger): winston.Logger {
  // Use type assertion to work around TypeScript's readonly properties
  const loggerAny = logger as any;
  
  // Only add methods if they don't exist
  if (!loggerAny.silly) {
    // Use the existing log method with the appropriate level
    loggerAny.silly = function(message: any, ...meta: any[]) {
      return this.log('silly', message, ...meta);
    };
  }
  
  if (!loggerAny.debug) {
    loggerAny.debug = function(message: any, ...meta: any[]) {
      return this.log('debug', message, ...meta);
    };
  }
  
  return logger;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createServiceLogger } from './common/utils/logger-factory'; // Assuming logger factory exists
import { ValidationPipe } from '@nestjs/common'; // Import ValidationPipe
import { SocketService } from './services/util/socket.service'; // Import SocketService
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression'; // Import compression
import morgan from 'morgan'; // Import morgan
import cookieParser from 'cookie-parser'; // Import cookie-parser
import { 
  securityHeaders, 
  rateLimiter, 
  speedLimiter, 
  requestSizeLimiter 
} from './common/middleware/security'; // Import custom security middleware
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import { AllExceptionsFilter } from './common/filters/http-exception.filter'; // Import the filter
import { initializeUploadDirectories } from './common/utils/upload'; // Import upload directory initialization
import { join } from 'path'; // Import join
import { Logger } from '@nestjs/common';

const PORT = process.env.PORT || 3001;
const logger = new Logger('Bootstrap');

// Checks if port is already in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

// Run a simple Express server as a diagnostic tool
async function runDiagnosticExpressServer() {
  console.log('===== DIAGNOSTIC EXPRESS SERVER =====');
  console.log('Starting a simple Express server to diagnose port binding issues');
  
  // Convert PORT to number once
  const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  
  return new Promise<void>((resolve, reject) => {
    try {
      // Create a simple express server
      const app = express();
      
      app.get('/', (req, res) => {
        res.send('Diagnostic Express server running! Port binding works correctly.');
      });
      
      app.get('/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          mode: 'diagnostic',
          timestamp: new Date().toISOString() 
        });
      });
      
      // Try to bind to the port
      const server = app.listen(portNumber, () => {
        console.log(`DIAGNOSTIC: Successfully bound to port ${portNumber}!`);
        console.log('This confirms the port is available and can be bound to.');
        console.log('If NestJS is failing to bind, it is not a network or OS issue.');
        
        // Close the server and resolve
        server.close(() => {
          console.log('DIAGNOSTIC: Server closed successfully, continuing with NestJS bootstrap');
          resolve();
        });
      });
      
      server.on('error', (err) => {
        console.error(`DIAGNOSTIC: Express server failed to bind: ${err.message}`);
        reject(err);
      });
      
      // Set a timeout just in case
      setTimeout(() => {
        reject(new Error('Diagnostic server timeout after 5 seconds'));
      }, 5000);
    } catch (err) {
      console.error('Failed to create diagnostic server:', err);
      reject(err);
    }
  });
}

// Create a simple server as a fallback
async function createSimpleServer(): Promise<void> {
  const app = express();
  const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
  app.get('/', (req, res) => {
    res.send('Simple Express server running in fallback mode');
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', mode: 'simple-fallback', timestamp: new Date().toISOString() });
  });
  
  return new Promise((resolve, reject) => {
    const server = app.listen(portNumber, () => {
      logger.log(`Simple fallback server successfully bound to port ${portNumber}`);
      resolve();
    });
    
    server.on('error', (error) => {
      logger.error(`Simple fallback server failed to bind: ${error.message}`);
      reject(error);
    });
  });
}

// The bootstrap function with a more robust approach to port binding
async function bootstrap() {
  try {
    logger.log('Starting server initialization...');
    
    // First run the diagnostic server to test port binding
    try {
      await runDiagnosticExpressServer();
    } catch (err: unknown) {
      logger.error(`Diagnostic test failed: ${err instanceof Error ? err.message : String(err)}`);
      logger.error('Cannot proceed with NestJS initialization if port binding fails');
      return process.exit(1);
    }
    
    // Check if port is already in use (just to be safe)
    const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
    const portInUse = await isPortInUse(portNumber);
    if (portInUse) {
      logger.error(`Port ${portNumber} is already in use! Cannot start server.`);
      process.exit(1);
    }
    
    // Check if we should use simple server mode
    if (process.env.SIMPLE_SERVER === 'true') {
      logger.log('Running in SIMPLE_SERVER mode');
      return await createSimpleServer();
    }

    logger.log('Initializing NestJS application...');
    
    // Regular NestJS initialization
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });
    
    logger.log('NestJS application created successfully');
    
    // Configure Express middleware
    logger.log('Configuring middleware...');
    app.use(helmet());
    
    const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    logger.log(`[Bootstrap] Configuring CORS with origin: ${corsOrigin}`); // Log the origin being used
    
    // Update CORS configuration to handle credentials and specify frontend origin
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'cache-control']
    });
    
    // Apply global filters and enable shutdown hooks before initializing
    app.useGlobalFilters(new AllExceptionsFilter());
    app.enableShutdownHooks();
    
    logger.log('NestJS application configured, initializing...');
    
    // DIAGNOSTIC: Check if PrismaService is available
    try {
      // NestJS retrieves services by TYPE not by string name
      const moduleRef = app.select(AppModule);
      if (moduleRef) {
        logger.log('DIAGNOSTIC: AppModule is available');
        
        try {
          // Import PrismaService dynamically to avoid direct dependency
          const { PrismaService } = await import('./core/database/prisma.service');
          const prismaService = app.get(PrismaService);
          logger.log('DIAGNOSTIC: PrismaService is available through DI - SUCCESS');
        } catch (serviceError: any) {
          logger.error(`DIAGNOSTIC: PrismaService lookup failed: ${serviceError.message}`);
        }
      }
    } catch (error: any) {
      logger.error(`DIAGNOSTIC: Module lookup failed: ${error.message}`);
    }
    
    // Initialize the application explicitly first
    await app.init();
    logger.log('Application initialized successfully');
    
    // CRITICAL: Use native HTTP server approach which is more reliable
    logger.log(`Creating manual HTTP server binding on port ${portNumber}...`);
    
    return new Promise((resolve, reject) => {
      try {
        // Get the underlying HTTP adapter and server from NestJS
        const httpAdapter = app.getHttpAdapter();
        const server = httpAdapter.getHttpServer();
        
        if (!server) {
          throw new Error('HTTP server not created by NestJS adapter');
        }
        
        // Set a timeout to detect binding issues
        const timeoutId = setTimeout(() => {
          logger.error(`Server binding timeout after 15 seconds!`);
          reject(new Error('Server binding timeout'));
          process.exit(1);
        }, 15000);
        
        // Direct binding using the Node.js HTTP server
        server.listen(portNumber, () => {
          clearTimeout(timeoutId);
          logger.log(`Server successfully bound to port ${portNumber}`);
          resolve(app);
        });
        
        server.on('error', (error: Error) => {
          clearTimeout(timeoutId);
          logger.error(`Failed to bind server: ${error.message}`);
          reject(error);
          process.exit(1);
        });
      } catch (error) {
        logger.error(`Error during manual server binding: ${error instanceof Error ? error.message : String(error)}`);
        reject(error);
        process.exit(1);
      }
    });
  } catch (error: unknown) {
    logger.error(`Failed during bootstrap setup: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

// Start the server
bootstrap(); 