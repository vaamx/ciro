import express from '../types/express-types';
import type { Response as ExpressResponse, RequestHandler } from 'express-serve-static-core';
import { authenticate } from '../middleware/auth';
import { DataSourceController } from '../controllers/data-source.controller';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { QdrantService } from '../services/qdrant.service';
import { getServiceRegistry } from '../services/service-registry';
import { createServiceLogger } from '../utils/logger-factory';
import { pool } from '../config/database';
import { OpenAIService } from '../services/openai.service';
import { RagService } from '../services/rag.service';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Response } from '../types/express-types';
import visualizationRoutes from './visualization.routes';
import { VisualizationController } from '../controllers/visualization.controller';

// Force Node to use the actual express module, not the type definition
// @ts-ignore
const { Router } = require('express');

// Extend AuthRequest interface to include the required properties
declare module '../middleware/auth' {
  interface AuthRequest {
    params: any;
    query: any;
    body: any;
    originalUrl: string;
    organizationId?: string;
  }
}

// Define the formatCollectionName function
const formatCollectionName = (id: string): string => {
  return `collection_${id}`;
};

// Create router using the explicitly imported Router
const router = Router();
const dataSourceController = new DataSourceController();
const logger = createServiceLogger('ApiRoutes');
const qdrantService = QdrantService.getInstance();
const openAIService = OpenAIService.getInstance();
const visualizationController = new VisualizationController();

// Add clock data endpoint
router.get('/qdrant/clock-data/:collection/:id', asyncHandler<AuthRequest>(async (req, res) => {
  try {
    const { collection, id } = req.params;
    
    // Validate inputs
    if (!collection || !id) {
      return res.status(400).json({ error: 'Collection and ID are required' });
    }
    
    logger.info(`Clock data request for collection: ${collection}, id: ${id}`);
    
    // Define possible paths to check
    const qdrantDataPath = process.env.QDRANT_DATA_PATH || './qdrant_data';
    const possiblePaths = [
      path.join(qdrantDataPath, `collections/${collection}/${id}/newest_clocks.json`),
      path.join(qdrantDataPath, `collections/${collection}/newest_clocks.json`),
      path.join(qdrantDataPath, `collections/newest_clocks.json`),
      path.join(qdrantDataPath, `newest_clocks.json`)
    ];
    
    // Try each path
    let clockDataContent = null;
    for (const filePath of possiblePaths) {
      logger.info(`Checking for clock data at: ${filePath}`);
      if (fs.existsSync(filePath)) {
        try {
          clockDataContent = fs.readFileSync(filePath, 'utf8');
          logger.info(`Found clock data at: ${filePath}`);
          break;
        } catch (readError) {
          logger.warn(`Error reading clock data from ${filePath}:`, readError);
        }
      }
    }
    
    // If file was found and read, parse and return it
    if (clockDataContent) {
      try {
        const clockData = JSON.parse(clockDataContent);
        return res.json(clockData);
      } catch (parseError) {
        logger.warn(`Error parsing clock data JSON:`, parseError);
        // Continue to mock data if parsing fails
      }
    }
    
    // Generate mock data if file doesn't exist or couldn't be parsed
    logger.info('Using mock clock data');
    const mockClockData = {
      last_updated: new Date().toISOString(),
      clocks: {
        search: Date.now() - 5000,
        embedding: Date.now() - 3000,
        processing: Date.now() - 2000
      },
      is_mock: true
    };
    
    return res.json(mockClockData);
  } catch (error) {
    logger.error('Error retrieving clock data:', error);
    return res.status(500).json({ error: 'Failed to retrieve clock data' });
  }
}));

// Create a wrapper function to handle type conversion
const wrapController = (fn: any): RequestHandler => {
  return (req: any, res: any, next: any) => {
    return fn(req, res);
  };
};

// Add visualization routes
router.use('/visualizations', visualizationRoutes);

// After the existing visualization routes
// Add direct route for visualization generation (this route will work regardless of whether the module routes work)
router.post('/visualizations/generate/:dataSourceId', authenticate, 
  wrapController((req, res) => visualizationController.generateVisualization(req, res))
);

// Data Sources routes
router.get('/data-sources', authenticate, dataSourceController.getDataSources as RequestHandler);
router.get('/data-sources/:id', authenticate, wrapController((req, res) => dataSourceController.getDataSource(req, res)));
router.get('/data-sources/:id/chunks', authenticate, wrapController((req, res) => dataSourceController.getDataSourceChunks(req, res)));
router.get('/data-sources/:id/content', authenticate, wrapController((req, res) => dataSourceController.getLocalFileContent(req, res)));
router.post('/data-sources', authenticate, wrapController(dataSourceController.createDataSource));
router.put('/data-sources/:id', authenticate, wrapController(dataSourceController.updateDataSource));
router.delete('/data-sources/:id', authenticate, wrapController((req, res) => dataSourceController.deleteDataSource(req, res)));

// Add collections endpoint to list all Qdrant collections
router.get('/collections', authenticate, asyncHandler<AuthRequest>(async (req, res: Response) => {
  try {
    // Get all data sources from the database
    const query = `
      SELECT id, name, type, metadata 
      FROM data_sources 
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;
    
    const organizationId = req.organizationId || 1;
    const result = await pool.query(query, [organizationId]);
    
    // Map data sources to collection names using the existing formatCollectionName function
    const collections = result.rows.map(ds => formatCollectionName(ds.id));
    
    // Check for existing collections on disk
    const qdrantCollections = await qdrantService.listCollections();
    
    // Combine the lists, removing duplicates
    const allCollections = [...new Set([...collections, ...qdrantCollections])];
    
    return res.json(allCollections);
  } catch (error) {
    logger.error('Error listing collections:', error);
    return res.status(500).json({ error: 'Failed to list collections' });
  }
}));

// Document chunks routes
router.post('/data-sources/chunks/search', authenticate, 
  asyncHandler<AuthRequest>(async (req, res) => {
    await (dataSourceController.searchDocumentChunks as any)(req, res);
  })
);
router.post('/data-sources/chunks/text-search', authenticate, 
  asyncHandler<AuthRequest>(async (req, res) => {
    await (dataSourceController.textSearchDocumentChunks as any)(req, res);
  })
);
router.post('/data-sources/chunks', authenticate, 
  asyncHandler<AuthRequest>(async (req, res) => {
    await (dataSourceController.storeDocumentChunk as any)(req, res);
  })
);

// Add API key endpoint
router.get('/config/openai-key', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!apiKey) {
      return res.status(404).json({ 
        error: 'API key not configured on server',
        message: 'The OpenAI API key is not configured on the server.'
      });
    }
    
    return res.json({ 
      apiKey,
      source: 'server_env'
    });
  } catch (error) {
    console.error('Error retrieving API key:', error);
  }
});

// Knowledge base search endpoint
router.get('/knowledge/search', authenticate, asyncHandler<AuthRequest>(async (req, res) => {
  try {
    const { query, organization_id } = req.query;
    
      if (!organization_id) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    logger.info(`Knowledge search request: query=${query}, organization_id=${organization_id}`);
    
    // Get the RAG service to use its data source helpers
    const ragService = new RagService();
    
    // Convert organization_id to string to ensure type safety
    const orgId = typeof organization_id === 'string' ? organization_id : 
                Array.isArray(organization_id) ? String(organization_id[0]) : 
                String(organization_id);
    
    // Use the RAG service to list available data sources with collection status
    const dataSources = await ragService.listDataSources(orgId);
    
    if (!dataSources || dataSources.length === 0) {
      logger.info(`No data sources found for organization: ${organization_id}`);
      return res.json([]);
    }
    
    logger.info(`Found ${dataSources.length} data sources, ${dataSources.filter(ds => ds.hasCollection).length} with collections`);
    
    // List all available collections for logging
    const availableCollections = await qdrantService.listCollections();
    logger.info(`Available collections for search: ${availableCollections.join(', ')}`);
    
    // Get the most recent files for each data source
    let knowledgeItems = [];
    
    for (const source of dataSources) {
      try {
        if (!source.hasCollection) {
          logger.warn(`Skipping source ${source.id} - no collection exists`);
          continue;
        }
        
        logger.info(`Searching collection: ${source.collectionName}`);
        
        // If we have a query, perform a vector search
        if (query && query !== '*' && query !== '.') {
          const embedding = await openAIService.createEmbeddings(query as string);
          const searchResults = await qdrantService.search(
            source.collectionName,
            embedding[0],
            undefined,
            10
          );
          
          // Format results
          const items = searchResults.map(result => ({
            id: result.id || `item-${crypto.randomUUID()}`,
            title: result.payload?.title || result.payload?.fileName || 'Untitled document',
            content: result.payload?.text || result.payload?.content || '',
            path: result.payload?.path || result.payload?.filePath || `document-${result.id}`,
            metadata: result.payload?.metadata || {
              lastModified: new Date(),
              author: result.payload?.author || 'Unknown',
              tags: result.payload?.tags || []
            },
            sourceId: source.id,
            sourceName: source.name,
            type: result.payload?.type || 'document',
            similarity: result.score || 0,
            created: result.payload?.created || new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            stats: {
              accessCount: result.payload?.accessCount || 0,
              lastAccessed: new Date()
            }
          }));
          
          knowledgeItems = [...knowledgeItems, ...items];
        } else {
          // Without query, get most recent documents
          const points = await qdrantService.getAllPoints(source.collectionName, 10);
          
          // Format results
          const items = points.map(point => ({
            id: point.id || `item-${crypto.randomUUID()}`,
            title: point.payload?.title || point.payload?.fileName || 'Untitled document',
            content: point.payload?.text || point.payload?.content || '',
            path: point.payload?.path || point.payload?.filePath || `document-${point.id}`,
            metadata: point.payload?.metadata || {
              lastModified: new Date(),
              author: point.payload?.author || 'Unknown',
              tags: point.payload?.tags || []
            },
            sourceId: source.id,
            sourceName: source.name,
            type: point.payload?.type || 'document',
            created: point.payload?.created || new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            stats: {
              accessCount: point.payload?.accessCount || 0,
              lastAccessed: new Date()
            }
          }));
          
          knowledgeItems = [...knowledgeItems, ...items];
        }
      } catch (error) {
        logger.error(`Error searching collection for source ${source.id}:`, error);
      }
    }
    
    logger.info(`Found ${knowledgeItems.length} knowledge items across all sources`);
    
    // Sort by relevance (if query) or recency
    knowledgeItems.sort((a, b) => {
      if (query && query !== '*' && query !== '.') {
        return (b.similarity || 0) - (a.similarity || 0);
      } else {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      }
    });
    
    return res.json(knowledgeItems);
  } catch (error) {
    logger.error('Error in knowledge search:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to search knowledge base';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = `${errorMessage}: ${error.message}`;
      
      // Add stack trace in development environments
      if (process.env.NODE_ENV !== 'production') {
        errorMessage += `\n${error.stack}`;
      }
    }
    
    // Check for specific error types and provide appropriate status codes
    if (error.name === 'AuthenticationError') {
      statusCode = 401;
      errorMessage = 'Authentication required to search knowledge base';
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = `Invalid search parameters: ${error.message}`;
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      errorMessage = `Resource not found: ${error.message}`;
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }
}));

// Add vector search endpoint
router.post('/vector-search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { collection, vector, limit = 10, threshold = 0.5 } = req.body;
    
    if (!collection || !vector) {
      return res.status(400).json({ error: 'Missing required parameters: collection and vector' });
    }
    
    // Initialize Qdrant service
    const qdrantService = QdrantService.getInstance();
    
    // Collection name handling - try multiple formats if needed
    let collectionsToTry = [collection];
    
    // If the collection looks like a numeric ID, also try with different prefixes
    if (/^\d+$/.test(collection)) {
      collectionsToTry = [
        collection,
        `datasource_${collection}`,
        `data_source_${collection}`
      ];
    }
    
    // Try to find existing collections that match our data source ID
    let foundCollection = null;
    let collections = await qdrantService.listCollections();
    console.log(`Available collections: ${collections.join(', ')}`);
    
    // Look for collections that might match our ID with different prefixes/formats
    for (const collectionName of collectionsToTry) {
      if (collections.includes(collectionName)) {
        console.log(`Found matching collection: ${collectionName}`);
        foundCollection = collectionName;
        break;
      }
    }
    
    // If we still don't have a match, try to find a collection that contains our ID
    if (!foundCollection && /^\d+$/.test(collection)) {
      for (const existingCollection of collections) {
        if (existingCollection.includes(collection)) {
          console.log(`Found collection containing ID: ${existingCollection}`);
          foundCollection = existingCollection;
          break;
        }
      }
    }
    
    if (!foundCollection) {
      console.log(`No matching collection found for: ${collection}`);
      return res.json([]);
    }
    
    // Create filter for threshold if needed
    // Only apply the filter if threshold is explicitly specified and greater than 0
    let filter = undefined;
    
    // Only apply threshold filter if it's provided and greater than 0
    if (req.body.hasOwnProperty('threshold') && threshold > 0) {
      filter = {
        must: [
          {
            key: 'metadata.score',
            range: {
              gte: threshold
            }
          }
        ]
      };
      console.log(`Applying score threshold filter: ${threshold}`);
    } else {
      console.log(`No threshold filter applied (threshold: ${threshold})`);
    }
    
    // Perform search
    const searchResults = await qdrantService.search(foundCollection, vector, filter, limit);
    
    return res.json(searchResults);
  } catch (error) {
    console.error('Vector search error:', error);
    return res.status(500).json({ error: 'Error performing vector search' });
  }
});

// Add text search endpoint
router.post('/qdrant/text-search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { collection, text, limit = 10 } = req.body;
    
    if (!collection || !text) {
      return res.status(400).json({ error: 'Missing required parameters: collection and text' });
    }
    
    // Initialize Qdrant service
    const qdrantService = QdrantService.getInstance();
    
    // Collection name handling - try multiple formats if needed
    let collectionsToTry = [collection];
    
    // If the collection looks like a numeric ID, also try with different prefixes
    if (/^\d+$/.test(collection)) {
      collectionsToTry = [
        collection,
        `datasource_${collection}`,
        `data_source_${collection}`
      ];
    }
    
    // Try to find existing collections that match our data source ID
    let foundCollection = null;
    let collections = await qdrantService.listCollections();
    console.log(`Available collections: ${collections.join(', ')}`);
    
    // Look for collections that might match our ID with different prefixes/formats
    for (const collectionName of collectionsToTry) {
      if (collections.includes(collectionName)) {
        console.log(`Found matching collection: ${collectionName}`);
        foundCollection = collectionName;
        break;
      }
    }
    
    // If we still don't have a match, try to find a collection that contains our ID
    if (!foundCollection && /^\d+$/.test(collection)) {
      for (const existingCollection of collections) {
        if (existingCollection.includes(collection)) {
          console.log(`Found collection containing ID: ${existingCollection}`);
          foundCollection = existingCollection;
          break;
        }
      }
    }
    
    if (!foundCollection) {
      console.log(`No matching collection found for: ${collection}`);
      return res.json([]);
    }
    
    // Perform text search with the found collection
    const searchResults = await qdrantService.textSearch(foundCollection, text, undefined, limit);
    
    return res.json(searchResults);
  } catch (error) {
    console.error('Text search error:', error);
    return res.status(500).json({ error: 'Error performing text search' });
  }
});

// Add text search endpoint at the path expected by the client
router.post('/text-search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { collection, text, limit = 10 } = req.body;
    
    if (!collection || !text) {
      return res.status(400).json({ error: 'Missing required parameters: collection and text' });
    }
    
    // Initialize Qdrant service
    const qdrantService = QdrantService.getInstance();
    
    // Collection name handling - try multiple formats if needed
    let collectionsToTry = [collection];
    
    // If the collection looks like a numeric ID, also try with different prefixes
    if (/^\d+$/.test(collection)) {
      collectionsToTry = [
        collection,
        `datasource_${collection}`,
        `data_source_${collection}`
      ];
    }
    
    // Try to find existing collections that match our data source ID
    let foundCollection = null;
    let collections = await qdrantService.listCollections();
    console.log(`Available collections: ${collections.join(', ')}`);
    
    // Look for collections that might match our ID with different prefixes/formats
    for (const collectionName of collectionsToTry) {
      if (collections.includes(collectionName)) {
        console.log(`Found matching collection: ${collectionName}`);
        foundCollection = collectionName;
        break;
      }
    }
    
    // If we still don't have a match, try to find a collection that contains our ID
    if (!foundCollection && /^\d+$/.test(collection)) {
      for (const existingCollection of collections) {
        if (existingCollection.includes(collection)) {
          console.log(`Found collection containing ID: ${existingCollection}`);
          foundCollection = existingCollection;
          break;
        }
      }
    }
    
    if (!foundCollection) {
      console.log(`No matching collection found for: ${collection}`);
      return res.json([]);
    }
    
    // Perform text search with the found collection
    const searchResults = await qdrantService.textSearch(foundCollection, text, undefined, limit);
    
    return res.json(searchResults);
  } catch (error) {
    console.error('Text search error:', error);
    return res.status(500).json({ error: 'Error performing text search' });
  }
});

// Add a direct ext/text-search endpoint to handle client requests
router.post('/ext/text-search', authenticate, asyncHandler<AuthRequest>(async (req, res) => {
  const { collection, text, limit } = req.body;
  
  if (!collection || !text) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  const searchLimit = limit || 10;
  const qdrantService = QdrantService.getInstance();
  
  try {
    logger.info(`Text search request for collection: ${collection}, query: ${text}, limit: ${searchLimit}`);
    
    // Try to handle numeric collection IDs in various formats
    let effectiveCollection = collection;
    let collectionExists = await qdrantService.collectionExists(effectiveCollection);
    
    // Collection name handling logic
    if (!collectionExists && !isNaN(Number(collection))) {
      // If collection is numeric, try various format options
      const numericId = Number(collection);
      const alternateNames = [
        `datasource_${collection}`,
        `data_source_${collection}`
      ];
      
      logger.info(`Collection ${collection} not found directly. Trying alternate formats: ${alternateNames.join(', ')}`);
      
      // Try the alternate formats
      for (const altName of alternateNames) {
        if (await qdrantService.collectionExists(altName)) {
          effectiveCollection = altName;
          collectionExists = true;
          logger.info(`Using alternate collection name: ${effectiveCollection}`);
          break;
        }
      }
      
      // If still not found, try to look up the UUID from the database
      if (!collectionExists) {
        logger.info(`Alternate collection names not found. Querying database for UUID...`);
        try {
          const result = await pool.query(
            'SELECT metadata FROM data_sources WHERE id = $1',
            [numericId]
          );
          
          if (result.rows.length > 0) {
            const metadata = result.rows[0].metadata;
            let uuid = null;
            
            if (metadata && metadata.id) {
              uuid = metadata.id;
            } else if (metadata && metadata.file_id) {
              uuid = metadata.file_id;
            }
            
            if (uuid) {
              const uuidCollection = `datasource_${uuid}`;
              
              logger.info(`Found UUID ${uuid} in metadata for ID ${numericId}, trying collection: ${uuidCollection}`);
              
              if (await qdrantService.collectionExists(uuidCollection)) {
                effectiveCollection = uuidCollection;
                collectionExists = true;
                logger.info(`Using UUID-based collection name: ${effectiveCollection}`);
              }
            } else {
              logger.warn(`No UUID found in data source with ID ${numericId}`);
            }
          }
        } catch (dbError) {
          logger.error(`Database error looking up UUID: ${dbError.message}`);
        }
      }
      
      // Last resort: list all collections and see if any contain this ID
      if (!collectionExists) {
        logger.info(`Still couldn't find collection. Listing all collections to check if any match...`);
        const allCollections = await qdrantService.listCollections();
        logger.info(`Available collections: ${allCollections.join(', ')}`);
        
        for (const coll of allCollections) {
          if (coll.includes(collection)) {
            effectiveCollection = coll;
            collectionExists = true;
            logger.info(`Found matching collection by substring: ${effectiveCollection}`);
            break;
          }
        }
      }
    }
    
    if (!collectionExists) {
      logger.warn(`No collection found for ${collection} after trying all alternatives`);
      return res.json([]);
    }
    
    const results = await qdrantService.textSearch(effectiveCollection, text, null, searchLimit);
    logger.info(`Text search returned ${results.length} results`);
    
    return res.json(results);
  } catch (error) {
    logger.error(`Error in text search: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}));

// Add the vector-search endpoint with improved collection name handling
router.post('/ext/vector-search', authenticate, asyncHandler<AuthRequest>(async (req, res) => {
  try {
    const { collection, embeddings, limit, filter, includeMetadata } = req.body;
    
    if (!collection) {
      return res.status(400).json({ error: 'Collection ID is required' });
    }
    
    if (!embeddings || !Array.isArray(embeddings)) {
      return res.status(400).json({ error: 'Embeddings array is required' });
    }
    
    const maxLimit = 100;
    const searchLimit = Math.min(limit || 10, maxLimit);
    
    // Enhanced collection name formatting with better logging
    const formatCollectionName = (id: string) => {
      logger.info(`Normalizing collection name for ID: ${id}`);
      return id.startsWith('datasource_') ? id : `datasource_${id}`;
    };
    
    // Enhanced function to find the correct collection by data source ID or file ID
    const findCollectionByID = async (id: string) => {
      logger.info(`Finding collection for ID: ${id}`);
      
      // List all available collections for debugging
      const availableCollections = await qdrantService.listCollections();
      logger.info(`Available collections: ${availableCollections.join(', ')}`);
      
      // First check directly with the data source ID format
      const dsCollection = formatCollectionName(id);
      logger.info(`Checking for collection with data source format: ${dsCollection}`);
      if (await qdrantService.collectionExists(dsCollection)) {
        logger.info(`Found collection with data source format: ${dsCollection}`);
        return dsCollection;
      }
      
      // Try to find by file UUID
      try {
        // Check file_to_data_source mapping
        const mapping = await pool.query(
          'SELECT data_source_id FROM file_to_data_source WHERE file_id = $1',
          [id]
        );
        
        if (mapping.rows.length > 0) {
          const dataSourceId = mapping.rows[0].data_source_id;
          const mappedCollection = formatCollectionName(dataSourceId);
          logger.info(`Found mapping from file ID ${id} to data source ID ${dataSourceId}`);
          
          if (await qdrantService.collectionExists(mappedCollection)) {
            logger.info(`Found collection by file-to-data-source mapping: ${mappedCollection}`);
            return mappedCollection;
          }
        }
        
        // Check data sources table directly
        const dataSources = await pool.query(
          "SELECT id, metadata FROM data_sources WHERE id = $1 OR CAST(metadata->>'id' AS TEXT) = $1",
          [id]
        );
        
        if (dataSources.rows.length > 0) {
          const dataSource = dataSources.rows[0];
          logger.info(`Found data source in database with ID ${dataSource.id}`);
          
          // Check both formats - with ID or with UUID
          const dsIdCollection = formatCollectionName(dataSource.id.toString());
          if (await qdrantService.collectionExists(dsIdCollection)) {
            logger.info(`Found collection by data source ID: ${dsIdCollection}`);
            return dsIdCollection;
          }
          
          // Try with internal file ID if it exists
          if (dataSource.metadata && dataSource.metadata.id) {
            const dsUuidCollection = formatCollectionName(dataSource.metadata.id);
            if (await qdrantService.collectionExists(dsUuidCollection)) {
              logger.info(`Found collection by data source metadata ID: ${dsUuidCollection}`);
              return dsUuidCollection;
            }
          }
        }
        
        // Final attempt - direct UUID collection check
        const uuidCollection = formatCollectionName(id.replace(/-/g, ''));
        if (await qdrantService.collectionExists(uuidCollection)) {
          logger.info(`Found collection by UUID without hyphens: ${uuidCollection}`);
          return uuidCollection;
        }
        
      } catch (dbError) {
        logger.error(`Error querying database for collection mapping: ${dbError.message}`);
      }
      
      // Final check - try all collections for a match by internal ID
      try {
        for (const availableCollection of availableCollections) {
          logger.info(`Checking if collection ${availableCollection} is related to ID ${id}`);
          
          const points = await qdrantService.getRandomPoints(availableCollection, 1);
          if (points.length > 0 && 
              points[0].payload && 
              (points[0].payload.metadata?.dataSourceId === id || 
               points[0].payload.metadata?.fileId === id ||
               availableCollection.includes(id))) {
            logger.info(`Found matching collection by content check: ${availableCollection}`);
            return availableCollection;
          }
        }
      } catch (contentCheckError) {
        logger.error(`Error during content check: ${contentCheckError.message}`);
      }
      
      logger.warn(`No collection found for ID: ${id}`);
      return null;
    };
    
    // List all available collections
    const availableCollections = await qdrantService.listCollections();
    logger.info(`Available collections: ${availableCollections.join(', ')}`);
    
    // First, check if the collection already exists with the exact name
    let collectionName = formatCollectionName(collection);
    let collectionFound = availableCollections.includes(collectionName);
    let matchingCollection = collectionName;
    
    // If not found, try to find a matching collection
    if (!collectionFound) {
      logger.info(`Collection ${collectionName} not found directly, trying to resolve...`);
      
      // First, try a special format check for CSV files which might use numeric ID
      // This is a common case for CSV files formatted as datasource_nnn
      const directNumericMatch = /^(datasource_)?(\d+)$/.exec(collection);
      if (directNumericMatch) {
        const numericId = directNumericMatch[2];
        const numericCollectionName = `datasource_${numericId}`;
        logger.info(`Trying numeric collection format: ${numericCollectionName}`);
        
        if (availableCollections.includes(numericCollectionName)) {
          collectionName = numericCollectionName;
          collectionFound = true;
          matchingCollection = numericCollectionName;
          logger.info(`Found matching collection with numeric ID format: ${collectionName}`);
        }
      }
      
      // Is this a UUID? (contains hyphens)
      if (!collectionFound && collection.includes('-')) {
        const resolvedCollection = await findCollectionByID(collection);
        if (resolvedCollection) {
          collectionName = resolvedCollection;
          collectionFound = true;
          matchingCollection = resolvedCollection;
          logger.info(`Resolved UUID ${collection} to collection: ${collectionName}`);
        }
      } else if (!collectionFound) {
        // If it's a numeric ID, try to look up from database
        try {
          const result = await pool.query(
            'SELECT * FROM data_sources WHERE id = $1',
            [collection]
          );
          
          const dataSource = result.rows[0];
          
          if (dataSource) {
            // Try different possible collection names
            const possibleNames = [
              formatCollectionName(collection),
              `datasource_${collection}`,
              `collection_${collection}`,
              `data_source_${collection}`
            ];
            
            for (const name of possibleNames) {
              if (availableCollections.includes(name)) {
                collectionName = name;
                collectionFound = true;
                matchingCollection = name;
                logger.info(`Found matching collection with variation: ${collectionName}`);
                break;
              }
            }
            
            // If still not found, check if there's metadata with UUID
            if (!collectionFound && dataSource.metadata) {
              // Try to get UUID - it could be in metadata fields
              let uuid = null;
              if (dataSource.metadata && dataSource.metadata.id) {
                // Nested in metadata.id
                uuid = dataSource.metadata.id;
              } else if (dataSource.metadata && dataSource.metadata.file_id) {
                // File ID in metadata
                uuid = dataSource.metadata.file_id;
              }
              
              if (uuid) {
                logger.info(`Found UUID ${uuid} for numeric ID ${collection}`);
                
                // Check if there's a collection with this UUID
                const uuidCollection = formatCollectionName(uuid);
                if (availableCollections.includes(uuidCollection)) {
                  logger.info(`Found matching collection with UUID: ${uuidCollection}`);
                  collectionName = uuidCollection;
                  collectionFound = true;
                  matchingCollection = uuidCollection;
                }
              }
            }
          }
        } catch (error) {
          logger.error(`Error looking up data source in database: ${error.message}`);
        }
      }
      
      // If still not found, check for any collection that might contain this ID
      if (!collectionFound) {
        logger.info(`Still couldn't find collection. Checking for substring matches...`);
        
        for (const coll of availableCollections) {
          if (coll.includes(`datasource_${collection}`)) {
            collectionName = coll;
            collectionFound = true;
            matchingCollection = coll;
            logger.info(`Found matching collection by substring: ${collectionName}`);
            break;
          }
        }
      }
    }
    
    if (!collectionFound) {
      logger.error(`No matching collection found for: ${collection}`);
      return res.status(404).json({
        error: 'Collection not found',
        requested: collection,
        availableCollections
      });
    }
    
    // Perform the vector search using the correct method name
    logger.info(`Performing vector search on collection: ${matchingCollection}`);
    const searchResults = await qdrantService.search(
      matchingCollection,
      embeddings[0], // Use the first embedding for search
      filter,
      searchLimit
    );
    
    return res.json({
      results: searchResults,
      collection: {
        requested: collection,
        used: matchingCollection
      }
    });
  } catch (error) {
    logger.error('Vector search error:', error);
    return res.status(500).json({
      error: 'Vector search failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}));

// Text search with improved collection resolution
router.post('/ext/text-search', authenticate, asyncHandler<AuthRequest>(async (req, res) => {
  const { collection, text, limit } = req.body;
  
  if (!collection) {
    return res.status(400).json({ error: 'Collection ID is required' });
  }
  
  if (!text) {
    return res.status(400).json({ error: 'Search text is required' });
  }
  
  const maxLimit = 100;
  const searchLimit = Math.min(limit || 10, maxLimit);
  
  // Helper function for consistent collection name formatting
  const formatCollectionName = (id: string) => {
    return id.startsWith('datasource_') ? id : `datasource_${id}`;
  };
  
  // Helper function to find the collection by UUID
  const findCollectionByUUID = async (uuid: string) => {
    // Check for direct UUID-based collection
    const uuidCollection = formatCollectionName(uuid);
    if (await qdrantService.collectionExists(uuidCollection)) {
      return uuidCollection;
    }
    
    // Check file_to_data_source mapping
    try {
      const mapping = await pool.query(
        'SELECT data_source_id FROM file_to_data_source WHERE file_id = $1',
        [uuid]
      );
      
      if (mapping.rows.length > 0) {
        const dataSourceId = mapping.rows[0].data_source_id;
        const mappedCollection = formatCollectionName(dataSourceId);
        
        if (await qdrantService.collectionExists(mappedCollection)) {
          return mappedCollection;
        }
      }
    } catch (mappingError) {
      logger.error(`Error checking mapping: ${mappingError.message}`);
    }
    
    // Check metadata in data_sources table
    try {
      const result = await pool.query(
        "SELECT * FROM data_sources WHERE metadata->>'id' = $1 OR metadata::text LIKE $2",
        [uuid, `%${uuid}%`]
      );
      
      if (result.rows.length > 0) {
        const dataSource = result.rows[0];
        const dataSourceId = dataSource.id.toString();
        const metadataCollection = formatCollectionName(dataSourceId);
        
        if (await qdrantService.collectionExists(metadataCollection)) {
          return metadataCollection;
        }
      }
    } catch (dbError) {
      logger.error(`Error checking metadata: ${dbError.message}`);
    }
    
    return null;
  };
  
  try {
    // List all available collections
    const availableCollections = await qdrantService.listCollections();
    logger.info(`Available collections: ${availableCollections.join(', ')}`);
    
    // First, check if the collection already exists with the exact name
    let collectionName = formatCollectionName(collection);
    let collectionExists = availableCollections.includes(collectionName);
    let effectiveCollection = collectionName;
    
    // If collection doesn't exist with direct name, try to resolve it
    if (!collectionExists) {
      logger.info(`Collection ${collectionName} not found directly, trying to resolve...`);
      
      // First, try a special format check for CSV files which might use numeric ID
      // This is a common case for CSV files formatted as datasource_nnn
      const directNumericMatch = /^(datasource_)?(\d+)$/.exec(collection);
      if (directNumericMatch) {
        const numericId = directNumericMatch[2];
        const numericCollectionName = `datasource_${numericId}`;
        logger.info(`Trying numeric collection format: ${numericCollectionName}`);
        
        if (availableCollections.includes(numericCollectionName)) {
          collectionName = numericCollectionName;
          collectionExists = true;
          effectiveCollection = numericCollectionName;
          logger.info(`Found matching collection with numeric ID format: ${collectionName}`);
        }
      }
      
      // Is this a UUID? (contains hyphens)
      if (!collectionExists && collection.includes('-')) {
        const resolvedCollection = await findCollectionByUUID(collection);
        if (resolvedCollection) {
          effectiveCollection = resolvedCollection;
          collectionExists = true;
          logger.info(`Resolved UUID ${collection} to collection: ${effectiveCollection}`);
        }
      } else if (!collectionExists) {
        // Assume it's a numeric ID from a data source
        const numericId = collection;
        
        // Try different possible collection names
        const possibleNames = [
          formatCollectionName(numericId),
          `datasource_${numericId}`,
          `collection_${numericId}`,
          `data_source_${numericId}`
        ];
        
        for (const name of possibleNames) {
          if (availableCollections.includes(name)) {
            effectiveCollection = name;
            collectionExists = true;
            logger.info(`Found matching collection with variation: ${effectiveCollection}`);
            break;
          }
        }
        
        // If not found, try to get the UUID from the data source metadata
        if (!collectionExists) {
          try {
            const result = await pool.query(
              'SELECT metadata FROM data_sources WHERE id = $1',
              [numericId]
            );
            
            if (result.rows.length > 0) {
              const metadata = result.rows[0].metadata;
              let uuid = null;
              
              if (metadata && metadata.id) {
                uuid = metadata.id;
              } else if (metadata && metadata.file_id) {
                uuid = metadata.file_id;
              }
              
              if (uuid) {
                const uuidCollection = `datasource_${uuid}`;
                
                logger.info(`Found UUID ${uuid} in metadata for ID ${numericId}, trying collection: ${uuidCollection}`);
                
                if (availableCollections.includes(uuidCollection)) {
                  effectiveCollection = uuidCollection;
                  collectionExists = true;
                  logger.info(`Using UUID-based collection name: ${effectiveCollection}`);
                }
              } else {
                logger.warn(`No UUID found in data source with ID ${numericId}`);
              }
            }
          } catch (dbError) {
            logger.error(`Database error looking up UUID: ${dbError.message}`);
          }
        }
      }
      
      // Last resort: list all collections and see if any contain this ID
      if (!collectionExists) {
        logger.info(`Still couldn't find collection. Checking for substring matches...`);
        
        for (const coll of availableCollections) {
          if (coll.includes(collection)) {
            effectiveCollection = coll;
            collectionExists = true;
            logger.info(`Found matching collection by substring: ${effectiveCollection}`);
            break;
          }
        }
      }
    }
    
    if (!collectionExists) {
      logger.error(`No matching collection found for: ${collection}`);
      return res.status(404).json({
        error: 'Collection not found',
        requested: collection,
        availableCollections
      });
    }
    
    // Generate embeddings for the search text using the correct method name
    const embeddings = await openAIService.createEmbeddings(text);
    
    if (!embeddings || embeddings.length === 0) {
      return res.status(500).json({ error: 'Failed to generate embeddings for search text' });
    }
    
    // Perform the vector search with the resolved collection and correct method name
    logger.info(`Performing text search (via vectors) on collection: ${effectiveCollection}`);
    const searchResults = await qdrantService.search(effectiveCollection, embeddings[0], null, searchLimit);
    
    return res.json({
      results: searchResults,
      collection: {
        requested: collection,
        used: effectiveCollection
      }
    });
  } catch (error) {
    logger.error('Text search error:', error);
    return res.status(500).json({
      error: 'Text search failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}));

export default router; 