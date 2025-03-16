import { Router } from '../types/express-types';
import { QdrantService } from '../services/qdrant.service';
import { createServiceLogger } from '../utils/logger-factory';
import { asyncHandler } from '../utils/asyncHandler';
import { Pool } from 'pg';
import { config } from '../config';
import { configService } from '../services/config.service';

const router = Router();
const logger = createServiceLogger('HealthRoutes');
const qdrantService = QdrantService.getInstance();

// Create a pool for health check only
const dbPool = new Pool({
  host: process.env.DB_HOST || config.database.host,
  port: parseInt(process.env.DB_PORT || config.database.port.toString()),
  user: process.env.DB_USER || config.database.user,
  password: process.env.DB_PASSWORD || config.database.password,
  database: process.env.DB_NAME || config.database.database,
  connectionTimeoutMillis: 5000 // Timeout after 5 seconds
});

/**
 * Basic health check endpoint
 * GET /api/health
 * Returns 200 OK if the server is running
 */
router.get('/', (req, res) => {
  logger.debug('Health check requested');
  res.status(200).json({ 
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * Detailed health check endpoint 
 * GET /api/health/details
 * Returns detailed information about server components
 */
router.get('/details', (req, res) => {
  console.log('Detailed health check endpoint accessed!');
  
  const detailedHealth = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    }
  };

  res.status(200).json(detailedHealth);
});

// Define service detail types
type ServiceDetail = {
  status: 'ok' | 'error' | 'unknown' | 'disabled';
  details: any; // Using any to allow flexibility
};

// Detailed health check for all services
router.get('/detailed', asyncHandler(async (req, res) => {
  logger.debug('Detailed health check requested');
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown', details: {} } as ServiceDetail,
      unstructured: { status: 'disabled', details: { message: 'Unstructured API has been disabled and removed' } } as ServiceDetail,
      qdrant: { status: 'unknown', details: {} } as ServiceDetail
    }
  };
  
  // Check database health
  try {
    const dbClient = await dbPool.connect();
    try {
      const result = await dbClient.query('SELECT NOW()');
      health.services.database = { 
        status: 'ok', 
        details: { 
          timestamp: result.rows[0].now,
          host: process.env.DB_HOST || config.database.host,
          port: parseInt(process.env.DB_PORT || config.database.port.toString()),
          database: process.env.DB_NAME || config.database.database 
        }
      };
    } finally {
      dbClient.release();
    }
  } catch (error: unknown) {
    logger.error('Database health check failed', { error });
    health.services.database = { 
      status: 'error', 
      details: { message: error instanceof Error ? error.message : 'Unknown error' }
    };
    health.status = 'degraded';
  }
  
  // Check Qdrant health
  try {
    const client = qdrantService.getClient();
    const response = await client.getCollections();
    health.services.qdrant = { 
      status: 'ok',
      details: { 
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        collections: response.collections?.length || 0
      }
    };
  } catch (error: unknown) {
    logger.error('Qdrant health check failed', { error });
    health.services.qdrant = { 
      status: 'error', 
      details: { message: error instanceof Error ? error.message : 'Unknown error' }
    };
    health.status = 'degraded';
  }
  
  res.status(200).json(health);
}));

// Check if ready to process documents
router.get('/ready', asyncHandler(async (req, res) => {
  logger.debug('Ready check requested');
  
  const readyCheck = {
    ready: true,
    timestamp: new Date().toISOString(),
    services: {
      unstructured: 'disabled',
      qdrant: false,
      database: false
    }
  };
  
  // Check database
  try {
    const dbClient = await dbPool.connect();
    try {
      await dbClient.query('SELECT 1');
      readyCheck.services.database = true;
    } finally {
      dbClient.release();
    }
  } catch (error: unknown) {
    logger.error('Database ready check failed', { error });
    readyCheck.ready = false;
  }
  
  // Check Qdrant
  try {
    const client = qdrantService.getClient();
    await client.getCollections();
    readyCheck.services.qdrant = true;
  } catch (error: unknown) {
    logger.error('Qdrant ready check failed', { error });
    readyCheck.ready = false;
  }
  
  res.status(readyCheck.ready ? 200 : 503).json(readyCheck);
}));

// Add a new endpoint to check QdrantService initialization count
router.get('/qdrant-instances', (req, res) => {
  const count = QdrantService.getConstructorCallCount();
  res.json({
    status: 'success',
    count,
    message: `QdrantService constructor has been called ${count} times`
  });
});

export default router; 