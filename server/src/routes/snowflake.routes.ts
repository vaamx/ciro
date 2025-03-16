// Import Express using require to avoid type issues
const express = require('express');
import { Request, Response, NextFunction } from 'express-serve-static-core';
import { SnowflakeFormService } from '../services/snowflake-form.service';
import { SnowflakeService } from '../services/snowflake.service';
import { SnowflakeNLQueryService } from '../services/snowflake-nl-query.service';
import { SnowflakeSchemaIndexerService } from '../services/snowflake-schema-indexer.service';
import { createServiceLogger } from '../utils/logger-factory';
import { body, param, validationResult } from 'express-validator';
import { db } from '../infrastructure/database';
import { WebSocketService } from '../services/websocket.service';

const router = express.Router();
const logger = createServiceLogger('SnowflakeRoutes');

// Services instances
const snowflakeService = SnowflakeService.getInstance();
const snowflakeFormService = new SnowflakeFormService();
const snowflakeNLQueryService = SnowflakeNLQueryService.getInstance();
const snowflakeSchemaIndexerService = SnowflakeSchemaIndexerService.getInstance();

// Middleware for validating request
const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    next();
  };
};

/**
 * Test Snowflake connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { 
      account, 
      username, 
      password, 
      privateKey, 
      privateKeyPass,
      warehouse, 
      database, 
      schema, 
      role 
    } = req.body;
    
    // Validate required parameters
    if (!account || !username) {
      return res.status(400).json({
        success: false,
        message: 'Account and username are required'
      });
    }
    
    // Check that either password or private key is provided
    if (!password && !privateKey) {
      return res.status(400).json({
        success: false,
        message: 'Either password or private key must be provided'
      });
    }
    
    const result = await snowflakeFormService.testConnection({
      account,
      username,
      password,
      privateKey,
      privateKeyPass,
      warehouse,
      database,
      schema,
      role
    });
    
    res.json({ success: true, message: 'Connection successful', result });
  } catch (error: any) {
    console.error('Error testing Snowflake connection:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to connect to Snowflake' 
    });
  }
});

/**
 * List Snowflake warehouses
 */
router.post('/warehouses', async (req, res) => {
  try {
    const connectionParams = req.body;
    
    if (!connectionParams.account || !connectionParams.username) {
      return res.status(400).json({
        success: false,
        message: 'Account and username are required'
      });
    }
    
    const warehouses = await snowflakeFormService.listWarehouses(connectionParams);
    res.json(warehouses);
  } catch (error: any) {
    console.error('Error listing Snowflake warehouses:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to list warehouses'
    });
  }
});

/**
 * List Snowflake databases
 */
router.post('/databases', async (req, res) => {
  try {
    const connectionParams = req.body;
    
    if (!connectionParams.account || !connectionParams.username) {
      return res.status(400).json({
        success: false,
        message: 'Account and username are required'
      });
    }
    
    const databases = await snowflakeFormService.listDatabases(connectionParams);
    res.json(databases);
  } catch (error: any) {
    console.error('Error listing Snowflake databases:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to list databases'
    });
  }
});

/**
 * List Snowflake schemas in a database
 */
router.post('/schemas', async (req, res) => {
  try {
    const connectionParams = req.body;
    const database = req.query.database as string;
    
    if (!connectionParams.account || !connectionParams.username) {
      return res.status(400).json({
        success: false,
        message: 'Account and username are required'
      });
    }
    
    if (!database) {
      return res.status(400).json({
        success: false,
        message: 'Database parameter is required'
      });
    }
    
    const schemas = await snowflakeFormService.listSchemas(connectionParams, database);
    res.json(schemas);
  } catch (error: any) {
    console.error('Error listing Snowflake schemas:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to list schemas'
    });
  }
});

/**
 * List Snowflake tables in a schema
 */
router.post('/tables', async (req, res) => {
  try {
    const connectionParams = req.body;
    const database = req.query.database as string;
    const schema = req.query.schema as string;
    
    if (!connectionParams.account || !connectionParams.username) {
      return res.status(400).json({
        success: false,
        message: 'Account and username are required'
      });
    }
    
    if (!database || !schema) {
      return res.status(400).json({
        success: false,
        message: 'Database and schema parameters are required'
      });
    }
    
    const tables = await snowflakeFormService.listTables(connectionParams, database, schema);
    res.json(tables);
  } catch (error: any) {
    console.error('Error listing Snowflake tables:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to list tables'
    });
  }
});

/**
 * List Snowflake roles
 */
router.post('/roles', async (req, res) => {
  try {
    const connectionParams = req.body;
    
    if (!connectionParams.account || !connectionParams.username) {
      return res.status(400).json({
        success: false,
        message: 'Account and username are required'
      });
    }
    
    const roles = await snowflakeFormService.listRoles(connectionParams);
    res.json(roles);
  } catch (error: any) {
    console.error('Error listing Snowflake roles:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to list roles'
    });
  }
});

/**
 * Index a database schema for a Snowflake data source
 */
router.post(
  '/data-sources/:dataSourceId/index-schema',
  async (req, res, next) => {
    try {
      const { dataSourceId } = req.params;
      const { database, schema, options = {} } = req.body;
      
      // Enhance options to ensure complete data indexing
      const enhancedOptions = {
        ...options,
        includeTableData: true,
        rowLimit: Number.MAX_SAFE_INTEGER,
        maxTablesToIndex: Number.MAX_SAFE_INTEGER,
        detectRelationships: true,
        sampleRowCount: 10000000
      };
      
      logger.info(`Indexing schema for dataSourceId=${dataSourceId}, database=${database}, schema=${schema} with enhanced options for complete data indexing`);
      
      // First ensure the data source exists in the database
      const dataSource = await db('data_sources')
        .where('id', dataSourceId)
        .first();
      
      // If it doesn't exist, create a minimal record first
      if (!dataSource) {
        await db('data_sources').insert({
          id: dataSourceId,
          name: `Snowflake: ${database}.${schema}`,
          type: 'snowflake',
          status: 'queued',
          metadata: JSON.stringify({
            database,
            schema,
            message: 'Preparing to index'
          }),
          created_at: new Date(),
          updated_at: new Date()
        });
        
        // Notify Knowledge Base UI about the new source
        const websocketService = new WebSocketService();
        websocketService.broadcast('knowledgeBaseUpdated', {
          action: 'add',
          source: {
            id: parseInt(dataSourceId),
            name: `Snowflake: ${database}.${schema}`,
            type: 'snowflake',
            status: 'queued',
            icon: 'database',
            metadata: {
              database,
              schema,
              message: 'Preparing to index'
            }
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Start the indexing process
      // This runs asynchronously and will update the status via WebSocket
      snowflakeSchemaIndexerService.indexDatabaseSchema(
        Number(dataSourceId),
        database,
        schema,
        enhancedOptions
      ).catch(err => {
        logger.error(`Error indexing schema: ${err.message}`);
      });
      
      return res.json({
        success: true,
        message: 'Schema indexing started',
        dataSourceId
      });
    } catch (error: any) {
      logger.error(`Error initiating schema indexing: ${error.message}`);
      next(error);
    }
  }
);

/**
 * Update schema index for changed tables
 */
router.post(
  '/data-sources/:dataSourceId/update-schema',
  async (req, res, next) => {
    try {
      const { dataSourceId } = req.params;
      const { database, schema, options = {} } = req.body;
      
      // Enhance options to ensure complete data indexing
      const enhancedOptions = {
        ...options,
        includeTableData: true,
        rowLimit: Number.MAX_SAFE_INTEGER,
        maxTablesToIndex: Number.MAX_SAFE_INTEGER,
        detectRelationships: true,
        sampleRowCount: 10000000
      };
      
      logger.info(`Updating schema for dataSourceId=${dataSourceId}, database=${database}, schema=${schema} with enhanced options for complete data indexing`);
      
      const result = await snowflakeSchemaIndexerService.updateSchemaIndex(
        Number(dataSourceId), 
        database, 
        schema, 
        enhancedOptions
      );
      
      return res.json({
        success: true,
        message: 'Schema updated successfully',
        result
      });
    } catch (error: any) {
      logger.error(`Error updating schema: ${error.message}`);
      next(error);
    }
  }
);

/**
 * Get table metadata
 */
router.get(
  '/data-sources/:dataSourceId/tables/:database/:schema/:table/metadata',
  async (req, res, next) => {
    try {
      const { dataSourceId, database, schema, table } = req.params;
      
      const metadata = await snowflakeSchemaIndexerService.getTableMetadata(
        Number(dataSourceId),
        database,
        schema,
        table
      );
      
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Table metadata not found'
        });
      }
      
      return res.json({
        success: true,
        metadata
      });
    } catch (error: any) {
      logger.error(`Error getting table metadata: ${error.message}`);
      next(error);
    }
  }
);

/**
 * Execute a natural language query against Snowflake
 */
router.post(
  '/data-sources/:dataSourceId/nl-query',
  async (req, res, next) => {
    try {
      const { dataSourceId } = req.params;
      const { query, options } = req.body;
      
      logger.info(`Executing NL query for dataSourceId=${dataSourceId}: "${query}"`);
      
      const result = await snowflakeNLQueryService.executeNaturalLanguageQuery(
        Number(dataSourceId),
        query,
        options
      );
      
      return res.json({
        success: true,
        result
      });
    } catch (error: any) {
      logger.error(`Error executing NL query: ${error.message}`);
      next(error);
    }
  }
);

/**
 * List all knowledge collections for Snowflake data
 */
router.get('/knowledge', async (req, res, next) => {
  try {
    logger.info('Listing Snowflake knowledge collections');
    
    // Get all metadata about Snowflake knowledge collections
    const metadata = await snowflakeSchemaIndexerService.getKnowledgeMetadata();
    
    // Get all available collections
    const collections = await snowflakeSchemaIndexerService.listSnowflakeCollections();
    
    return res.json({
      success: true,
      knowledge: {
        collections,
        metadata,
        count: collections.length
      }
    });
  } catch (error: any) {
    logger.error(`Error listing knowledge collections: ${error.message}`);
    next(error);
  }
});

/**
 * Update a knowledge collection by re-indexing the database
 */
router.post('/knowledge/:dataSourceId/:database/:schema/refresh', async (req, res, next) => {
  try {
    const { dataSourceId, database, schema } = req.params;
    const options = req.body.options || { updateEmbeddings: true };

    logger.info(`Refreshing knowledge for dataSourceId=${dataSourceId}, database=${database}, schema=${schema}`);

    const result = await snowflakeSchemaIndexerService.updateSchemaIndex(
      Number(dataSourceId),
      database,
      schema,
      options
    );

    return res.json({
      success: true,
      message: 'Knowledge refreshed successfully',
      result
    });
  } catch (error: any) {
    logger.error(`Error refreshing knowledge: ${error.message}`);
    next(error);
  }
});

export default router; 