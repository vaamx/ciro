import { Router } from '../types/express-types';
import { RagService } from '../services/rag.service';
import { authenticate } from '../middleware/auth';
import { createServiceLogger } from '../utils/logger-factory';
import { QdrantService } from '../services/qdrant.service';
import { OpenAIService } from '../services/openai.service';
import { redirectRagQueries } from '../middleware/redirect-rag-queries';

const router = Router();
const ragService = new RagService();
const logger = createServiceLogger('RagRoutes');

/**
 * @route POST /api/rag/query
 * @desc Process a RAG query against specified data sources
 * @access Private
 */
router.post('/query', redirectRagQueries, async (req, res) => {
  try {
    const { query, dataSourceIds = [], sessionId, documentId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Allow empty dataSourceIds to generate general fallback responses
    logger.info(`Processing RAG query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}" for data sources: ${dataSourceIds.length ? dataSourceIds.join(', ') : 'none'}`);
    
    if (documentId) {
      logger.info(`Document ID provided: ${documentId}`);
    }
    
    const result = await ragService.processQuery(query, dataSourceIds, sessionId, documentId);
    
    return res.json(result);
  } catch (error) {
    logger.error('Error processing RAG query:', error);
    return res.status(500).json({ 
      error: 'Failed to process RAG query',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/rag/status
 * @desc Get the status of the RAG service
 * @access Private
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await ragService.getStatus();
    return res.json(status);
  } catch (error) {
    logger.error('Error getting RAG status:', error);
    return res.status(500).json({ 
      error: 'Failed to get RAG status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Migrate vectors between collections
 */
router.post('/migrate-collection/:sourceCollection/:targetDataSourceId', async (req, res) => {
  try {
    logger.info(`Received request to migrate from ${req.params.sourceCollection} to data source ${req.params.targetDataSourceId}`);
    
    // Get services
    const ragService = new RagService();
    
    // Add QdrantService directly
    const qdrantService = new QdrantService();
    
    // Extract parameters
    const sourceCollection = `datasource_${req.params.sourceCollection}`;
    const targetCollection = `datasource_${req.params.targetDataSourceId}`;
    const targetDataSourceId = req.params.targetDataSourceId;
    
    logger.info(`Starting manual migration from ${sourceCollection} to ${targetCollection}`);
    
    // Check if collections exist
    const sourceExists = await qdrantService.collectionExists(sourceCollection);
    const targetExists = await qdrantService.collectionExists(targetCollection);
    
    logger.info(`Source collection exists: ${sourceExists}, Target collection exists: ${targetExists}`);
    
    if (!sourceExists) {
      return res.status(404).json({
        success: false,
        error: `Source collection ${sourceCollection} does not exist`
      });
    }
    
    // Create target collection if needed
    if (!targetExists) {
      try {
        await qdrantService.createCollection(targetCollection, {
          vectors: { size: 1536, distance: 'Cosine' }
        });
        logger.info(`Created target collection: ${targetCollection}`);
      } catch (createError) {
        logger.error(`Error creating target collection: ${createError}`);
        return res.status(500).json({
          success: false,
          error: `Failed to create target collection: ${createError.message}`
        });
      }
    }
    
    // Get source collection info
    const sourceInfo = await qdrantService.getInfo(sourceCollection);
    logger.info(`Source collection info: ${JSON.stringify(sourceInfo)}`);
    
    if (!sourceInfo || sourceInfo.vectors_count === 0) {
      return res.status(400).json({
        success: false,
        error: `Source collection ${sourceCollection} has no vectors to migrate`
      });
    }
    
    // Get all points from source
    let points = [];
    let hasMore = true;
    let offset = null;
    const batchSize = 100;
    const scrollLimit = 1000; // Safety limit to prevent infinite loops
    let scrollCount = 0;
    
    logger.info(`Starting to scroll through points in ${sourceCollection}`);
    
    while (hasMore && scrollCount < scrollLimit) {
      try {
        const scrollResult = await qdrantService.scrollPoints(sourceCollection, batchSize, offset);
        logger.info(`Retrieved ${scrollResult.points.length} points from ${sourceCollection} (offset: ${offset})`);
        
        if (scrollResult.points.length > 0) {
          points = points.concat(scrollResult.points);
          if (points.length === 0) {
            // Log the first point for debugging
            logger.info(`Sample point: ${JSON.stringify(scrollResult.points[0])}`);
          }
        }
        
        offset = scrollResult.next_page_offset;
        hasMore = offset !== null && scrollResult.points.length > 0;
        scrollCount++;
      } catch (scrollError) {
        logger.error(`Error scrolling points: ${scrollError}`);
        hasMore = false;
      }
    }
    
    logger.info(`Retrieved a total of ${points.length} points from ${sourceCollection}`);
    
    if (!points || points.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No points found in source collection ${sourceCollection}`
      });
    }
    
    // Filter for valid points
    const validPoints = points.filter(point => 
      point && 
      typeof point === 'object' && 
      'id' in point && 
      'vector' in point && 
      Array.isArray(point.vector) &&
      point.vector.length > 0
    ).map(point => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload || {}  // Ensure payload is never undefined
    }));
    
    logger.info(`Found ${validPoints.length} valid points to migrate`);
    
    if (validPoints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid points found for migration'
      });
    }
    
    // Upsert points to target collection
    try {
      await qdrantService.upsertVectors(targetCollection, validPoints);
      logger.info(`Successfully migrated ${validPoints.length} vectors from ${sourceCollection} to ${targetCollection}`);
      
      // Force flush and optimize the collection to ensure vectors are indexed
      try {
        logger.info(`Forcing flush of collection ${targetCollection}`);
        await qdrantService.forceFlushCollection(targetCollection);
        
        logger.info(`Optimizing collection ${targetCollection}`);
        await qdrantService.optimizeCollection(targetCollection);
        
        // Verify the collection has points after optimization
        const postMigrationInfo = await qdrantService.getInfo(targetCollection);
        logger.info(`Post-migration collection info: ${JSON.stringify(postMigrationInfo)}`);
      } catch (optimizeError) {
        logger.warn(`Error optimizing collection: ${optimizeError.message}`);
        // Continue anyway - the migration was successful
      }
      
      // Update database reference
      try {
        const db = require('../db');
        await db('data_sources')
          .where('id', Number(targetDataSourceId))
          .update({
            collection_name: targetCollection,
            metadata: db.raw(`
              jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{collections}',
                '["${targetCollection}", "${sourceCollection}"]'::jsonb
              )
            `)
          });
        logger.info(`Updated data source record ${targetDataSourceId} with collection names`);
      } catch (dbError) {
        logger.error(`Error updating data source record: ${dbError}`);
        // Continue anyway - the migration was successful
      }
      
      // Return success
      return res.json({
        success: true,
        source: sourceCollection,
        target: targetCollection,
        migratedPoints: validPoints.length,
        message: 'Migration completed successfully'
      });
    } catch (upsertError) {
      logger.error(`Error upserting vectors: ${upsertError}`);
      return res.status(500).json({
        success: false,
        error: `Error upserting vectors: ${upsertError.message}`
      });
    }
  } catch (error) {
    logger.error(`Error during collection migration: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Add a new endpoint to check collection info and refresh if needed
 */
router.get('/collection-info/:collectionId', async (req, res) => {
  try {
    const collectionId = req.params.collectionId;
    const normalizedCollection = `datasource_${collectionId}`;
    const refresh = req.query.refresh === 'true';
    
    logger.info(`Checking collection info for ${normalizedCollection}, refresh: ${refresh}`);
    
    const qdrantService = new QdrantService();
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(normalizedCollection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: `Collection ${normalizedCollection} does not exist`
      });
    }
    
    // Get collection info
    const info = await qdrantService.getInfo(normalizedCollection);
    logger.info(`Collection info: ${JSON.stringify(info)}`);
    
    // Get sample points
    let samplePoints = [];
    try {
      samplePoints = await qdrantService.getCollectionSample(normalizedCollection, 5);
      logger.info(`Retrieved ${samplePoints.length} sample points`);
      
      if (samplePoints.length > 0) {
        logger.info(`Sample point: ${JSON.stringify(samplePoints[0])}`);
      }
    } catch (sampleError) {
      logger.error(`Error getting sample: ${sampleError}`);
    }
    
    // If refresh requested, force flush and optimize
    if (refresh) {
      try {
        logger.info(`Forcing flush of collection ${normalizedCollection}`);
        await qdrantService.forceFlushCollection(normalizedCollection);
        
        logger.info(`Optimizing collection ${normalizedCollection}`);
        await qdrantService.optimizeCollection(normalizedCollection);
        
        // Get info again after refresh
        const refreshedInfo = await qdrantService.getInfo(normalizedCollection);
        logger.info(`Refreshed collection info: ${JSON.stringify(refreshedInfo)}`);
        
        return res.json({
          success: true,
          collection: normalizedCollection,
          exists: true,
          info: refreshedInfo,
          refreshed: true,
          samplePoints: samplePoints,
          sampleCount: samplePoints.length
        });
      } catch (refreshError) {
        logger.error(`Error refreshing collection: ${refreshError}`);
      }
    }
    
    return res.json({
      success: true,
      collection: normalizedCollection,
      exists: true,
      info: info,
      refreshed: false,
      samplePoints: samplePoints,
      sampleCount: samplePoints.length
    });
  } catch (error) {
    logger.error(`Error checking collection info: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Add a new endpoint to directly scroll through points in a collection
 */
router.get('/scroll-collection/:collectionId', async (req, res) => {
  try {
    const collectionId = req.params.collectionId;
    const normalizedCollection = `datasource_${collectionId}`;
    const limit = parseInt(req.query.limit as string) || 100;
    
    logger.info(`Scrolling through collection ${normalizedCollection} with limit ${limit}`);
    
    const qdrantService = new QdrantService();
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(normalizedCollection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: `Collection ${normalizedCollection} does not exist`
      });
    }
    
    // Scroll through points
    let points = [];
    let hasMore = true;
    let offset = null;
    const scrollLimit = 10; // Safety limit to prevent infinite loops
    let scrollCount = 0;
    
    logger.info(`Starting to scroll through points in ${normalizedCollection}`);
    
    while (hasMore && scrollCount < scrollLimit) {
      try {
        const scrollResult = await qdrantService.scrollPoints(normalizedCollection, limit, offset, true);
        logger.info(`Retrieved ${scrollResult.points.length} points from ${normalizedCollection} (offset: ${offset})`);
        
        if (scrollResult.points.length > 0) {
          points = points.concat(scrollResult.points);
          // Log the first point for debugging
          if (scrollCount === 0) {
            logger.info(`Sample point: ${JSON.stringify(scrollResult.points[0])}`);
          }
        }
        
        offset = scrollResult.next_page_offset;
        hasMore = offset !== null && scrollResult.points.length > 0;
        scrollCount++;
      } catch (scrollError) {
        logger.error(`Error scrolling points: ${scrollError}`);
        hasMore = false;
      }
    }
    
    logger.info(`Retrieved a total of ${points.length} points from ${normalizedCollection}`);
    
    // Try direct API call to Qdrant as well
    let directApiPoints = [];
    try {
      // Build the URL for the Qdrant API
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      const url = `${qdrantUrl}/collections/${normalizedCollection}/points/scroll`;
      logger.info(`Making direct API call to ${url}`);
      
      // Make the request
      const axios = require('axios');
      const response = await axios.post(url, {
        limit: limit,
        with_vectors: true
      });
      
      if (response.data && response.data.result) {
        directApiPoints = response.data.result.points || [];
        logger.info(`Direct API call returned ${directApiPoints.length} points`);
        if (directApiPoints.length > 0) {
          logger.info(`Sample point from direct API: ${JSON.stringify(directApiPoints[0])}`);
        }
      }
    } catch (directApiError) {
      logger.error(`Error making direct API call: ${directApiError}`);
    }
    
    return res.json({
      success: true,
      collection: normalizedCollection,
      exists: true,
      pointsCount: points.length,
      points: points.slice(0, Math.min(10, points.length)), // Limit to 10 points in response
      directApiPointsCount: directApiPoints.length,
      directApiPoints: directApiPoints.slice(0, Math.min(10, directApiPoints.length))
    });
  } catch (error) {
    logger.error(`Error scrolling through collection: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Add a test endpoint that directly retrieves points and returns them
 */
router.get('/test-collection/:collectionId', async (req, res) => {
  try {
    const collectionId = req.params.collectionId;
    const normalizedCollection = `datasource_${collectionId}`;
    
    logger.info(`Testing collection ${normalizedCollection}`);
    
    const qdrantService = new QdrantService();
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(normalizedCollection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: `Collection ${normalizedCollection} does not exist`
      });
    }
    
    // Get points directly via scrolling
    let points = [];
    let hasMore = true;
    let offset = null;
    let totalPoints = 0;
    
    while (hasMore) {
      try {
        const scrollResult = await qdrantService.scrollPoints(normalizedCollection, 10, offset, true);
        logger.info(`Retrieved ${scrollResult.points.length} points (offset: ${offset})`);
        
        if (scrollResult.points.length > 0) {
          totalPoints += scrollResult.points.length;
          
          // Only add the first 10 to the response to keep it manageable
          if (points.length < 10) {
            const newPoints = scrollResult.points.slice(0, 10 - points.length);
            points = points.concat(newPoints);
          }
        }
        
        offset = scrollResult.next_page_offset;
        hasMore = offset !== null && scrollResult.points.length > 0 && totalPoints < 100;
      } catch (scrollError) {
        logger.error(`Error scrolling points: ${scrollError}`);
        hasMore = false;
      }
    }
    
    // Try to format points to include text content
    const formattedPoints = points.map(point => ({
      id: point.id,
      hasVector: point.vector && Array.isArray(point.vector) && point.vector.length > 0,
      vectorLength: point.vector ? point.vector.length : 0,
      payload: point.payload,
      text: point.payload?.text || point.payload?.content || "No text content found"
    }));
    
    // Create a simple response from these points
    let response = {
      content: "Here's what I found:",
      sources: formattedPoints.map(p => ({
        id: p.id,
        text: p.text,
        score: 1.0,
        dataSourceId: collectionId
      }))
    };
    
    // Create formatted content
    let contentText = "## Information Retrieved\n\n";
    contentText += formattedPoints.map((p, i) => `### Document ${i+1}\n${p.text}\n`).join("\n");
    
    return res.json({
      success: true,
      collection: normalizedCollection,
      totalPoints: totalPoints,
      samplePoints: formattedPoints,
      response: response,
      formattedContent: contentText
    });
  } catch (error) {
    logger.error(`Error in test endpoint: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Direct query endpoint that bypasses standard metadata checks
 * and uses scroll method directly to search for data
 */
router.post('/direct-query', async (req, res) => {
  try {
    const { query, dataSourceId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Processing direct query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}" for data source: ${dataSourceId}`);
    
    // Get embedding for query
    const openaiService = new OpenAIService();
    const embedding = await openaiService.createEmbeddings([query]);
    
    if (!embedding || embedding.length === 0) {
      return res.status(500).json({ error: 'Failed to create embedding for query' });
    }
    
    // Format the collection name
    const collectionName = `datasource_${dataSourceId}`;
    
    const qdrantService = new QdrantService();
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(collectionName);
    if (!exists) {
      return res.status(404).json({ 
        error: `Collection ${collectionName} does not exist`,
        collectionName
      });
    }
    
    // Get all points via scrolling and perform local search
    logger.info(`Retrieving points from ${collectionName} for direct search`);
    
    let allPoints = [];
    let hasMore = true;
    let offset = null;
    const batchSize = 100;
    const maxPoints = 1000; // Limit to prevent excessive memory usage
    
    while (hasMore && allPoints.length < maxPoints) {
      try {
        const scrollResult = await qdrantService.scrollPoints(collectionName, batchSize, offset, true);
        logger.info(`Retrieved batch of ${scrollResult.points.length} points`);
        
        if (scrollResult.points.length > 0) {
          allPoints = allPoints.concat(scrollResult.points);
        } else {
          break;
        }
        
        offset = scrollResult.next_page_offset;
        hasMore = offset !== null;
      } catch (scrollError) {
        logger.error(`Error scrolling points: ${scrollError}`);
        hasMore = false;
      }
    }
    
    logger.info(`Retrieved a total of ${allPoints.length} points for search processing`);
    
    if (allPoints.length === 0) {
      return res.json({
        results: [],
        message: 'No points found in collection to search through',
        collection: collectionName
      });
    }
    
    // Calculate similarity scores and sort by relevance
    const queryVector = embedding[0];
    const searchResults = allPoints
      .map(point => {
        // Calculate cosine similarity if point has a vector
        let score = 0;
        if (point.vector && Array.isArray(point.vector)) {
          // Cosine similarity calculation
          const dotProduct = queryVector.reduce((sum, val, i) => sum + val * point.vector[i], 0);
          const queryMagnitude = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
          const vectorMagnitude = Math.sqrt(point.vector.reduce((sum, val) => sum + val * val, 0));
          score = dotProduct / (queryMagnitude * vectorMagnitude);
        }
        
        return {
          id: point.id,
          score: score,
          payload: point.payload || {},
          hasVector: !!point.vector
        };
      })
      .filter(result => result.score > 0.5) // Filter to relevant results only
      .sort((a, b) => b.score - a.score) // Sort by descending score
      .slice(0, 10); // Take top 10 results
    
    return res.json({
      results: searchResults,
      totalPointsScanned: allPoints.length,
      collection: collectionName,
      query: query
    });
  } catch (error) {
    logger.error('Error in direct query endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to process direct query',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Add an endpoint to explicitly refresh a collection's metadata
 */
router.post('/refresh-collection/:collectionId', async (req, res) => {
  try {
    const collectionId = req.params.collectionId;
    const normalizedCollection = `datasource_${collectionId}`;
    
    logger.info(`Refreshing collection metadata for ${normalizedCollection}`);
    
    const qdrantService = new QdrantService();
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(normalizedCollection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: `Collection ${normalizedCollection} does not exist`
      });
    }
    
    // Count the actual points in the collection by scrolling through them
    let totalPoints = 0;
    let hasMore = true;
    let offset = null;
    const batchSize = 100;
    
    while (hasMore) {
      try {
        const scrollResult = await qdrantService.scrollPoints(normalizedCollection, batchSize, offset, false);
        const batchCount = scrollResult.points.length;
        totalPoints += batchCount;
        
        logger.info(`Counted batch of ${batchCount} points, total so far: ${totalPoints}`);
        
        offset = scrollResult.next_page_offset;
        hasMore = offset !== null && scrollResult.points.length > 0;
      } catch (scrollError) {
        logger.error(`Error scrolling points: ${scrollError}`);
        hasMore = false;
      }
    }
    
    logger.info(`Found ${totalPoints} total points in collection`);
    
    if (totalPoints === 0) {
      return res.json({
        success: true,
        collection: normalizedCollection,
        message: "Collection exists but contains no points",
        pointsCount: 0
      });
    }
    
    // Force a collection optimization to update metadata
    try {
      logger.info(`Forcing optimization for collection ${normalizedCollection}`);
      await qdrantService.optimizeCollection(normalizedCollection);
      logger.info(`Optimization completed for ${normalizedCollection}`);
      
      // Force flush the collection
      await qdrantService.forceFlushCollection(normalizedCollection);
      logger.info(`Forced flush completed for ${normalizedCollection}`);
      
      // Update the database reference if needed
      try {
        const db = require('../db');
        await db('data_sources')
          .where('id', Number(collectionId))
          .update({
            collection_name: normalizedCollection,
            indexed_count: totalPoints,
            last_refreshed: new Date()
          });
        logger.info(`Updated database reference for collection ${normalizedCollection}`);
      } catch (dbError) {
        logger.error(`Error updating database: ${dbError}`);
      }
      
      // Get updated collection info
      const updatedInfo = await qdrantService.getInfo(normalizedCollection);
      
      return res.json({
        success: true,
        collection: normalizedCollection,
        actualPointsCount: totalPoints,
        info: updatedInfo,
        message: `Collection metadata refreshed. Found ${totalPoints} points.`
      });
    } catch (optimizeError) {
      logger.error(`Error optimizing collection: ${optimizeError}`);
      return res.status(500).json({
        success: false,
        collection: normalizedCollection,
        actualPointsCount: totalPoints,
        message: `Error refreshing collection metadata: ${optimizeError.message}`
      });
    }
  } catch (error) {
    logger.error('Error refreshing collection metadata:', error);
    return res.status(500).json({ 
      error: 'Failed to refresh collection metadata',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Endpoint specifically for sales-related queries that provides
 * a structured answer based on the direct query results
 */
router.post('/answer-sales-query', async (req, res) => {
  try {
    const { query, dataSourceId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Processing sales query: "${query}" for data source: ${dataSourceId}`);
    
    // Get embedding for query
    const openaiService = new OpenAIService();
    const embedding = await openaiService.createEmbeddings([query]);
    
    if (!embedding || embedding.length === 0) {
      return res.status(500).json({ error: 'Failed to create embedding for query' });
    }
    
    // Format the collection name
    const collectionName = `datasource_${dataSourceId}`;
    
    const qdrantService = new QdrantService();
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(collectionName);
    if (!exists) {
      return res.status(404).json({ 
        error: `Collection ${collectionName} does not exist`,
        collectionName
      });
    }
    
    // Get all points via scrolling
    logger.info(`Retrieving points from ${collectionName} for sales query`);
    
    let allPoints = [];
    let hasMore = true;
    let offset = null;
    const batchSize = 100;
    const maxPoints = 1000;
    
    while (hasMore && allPoints.length < maxPoints) {
      try {
        const scrollResult = await qdrantService.scrollPoints(collectionName, batchSize, offset, true);
        logger.info(`Retrieved batch of ${scrollResult.points.length} points`);
        
        if (scrollResult.points.length > 0) {
          allPoints = allPoints.concat(scrollResult.points);
        } else {
          break;
        }
        
        offset = scrollResult.next_page_offset;
        hasMore = offset !== null;
      } catch (scrollError) {
        logger.error(`Error scrolling points: ${scrollError}`);
        hasMore = false;
      }
    }
    
    logger.info(`Retrieved a total of ${allPoints.length} points for search processing`);
    
    if (allPoints.length === 0) {
      return res.json({
        answer: "I couldn't find any sales data in the specified data source.",
        data: [],
        query: query
      });
    }
    
    // Calculate similarity scores and sort by relevance
    const queryVector = embedding[0];
    const searchResults = allPoints
      .map(point => {
        // Calculate cosine similarity if point has a vector
        let score = 0;
        if (point.vector && Array.isArray(point.vector)) {
          // Cosine similarity calculation
          const dotProduct = queryVector.reduce((sum, val, i) => sum + val * point.vector[i], 0);
          const queryMagnitude = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
          const vectorMagnitude = Math.sqrt(point.vector.reduce((sum, val) => sum + val * val, 0));
          score = dotProduct / (queryMagnitude * vectorMagnitude);
        }
        
        return {
          id: point.id,
          score: score,
          payload: point.payload || {},
          text: point.payload?.text || "",
          hasVector: !!point.vector
        };
      })
      .filter(result => result.score > 0.5) // Filter to relevant results only
      .sort((a, b) => b.score - a.score) // Sort by descending score
      .slice(0, 10); // Take top 10 results
    
    // Extract sales by region from the most relevant document
    let regionSalesData = [];
    
    // Check if we have a relevant document with sales data
    if (searchResults.length > 0) {
      const topDocument = searchResults[0];
      const docText = topDocument.text;
      
      // Look for Operating segments data which contains regional sales
      if (docText.includes("Operating segments") || docText.includes("Zone NA") || docText.includes("Zone EUR")) {
        // Extract regional sales data through regex pattern matching
        const regex = /Zone\s+([A-Z]+)\s+([0-9,]+)/g;
        let match;
        while ((match = regex.exec(docText)) !== null) {
          const region = match[1];
          const sales = parseInt(match[2].replace(/,/g, ''));
          regionSalesData.push({ region, sales });
        }
        
        // Also check for other business segments
        const specialSegmentsRegex = /(Nestlé Health Science|Nespresso|Other businesses)\s+([0-9,]+)/g;
        while ((match = specialSegmentsRegex.exec(docText)) !== null) {
          const region = match[1];
          const sales = parseInt(match[2].replace(/,/g, ''));
          regionSalesData.push({ region, sales });
        }
      }
    }
    
    // Provide a structured sales summary
    let answer = "Based on the financial data, here are the total sales per region:\n\n";
    
    if (regionSalesData.length > 0) {
      regionSalesData.forEach(item => {
        answer += `- ${item.region}: ${item.sales.toLocaleString()} million CHF\n`;
      });
      
      // Calculate and add total
      const totalSales = regionSalesData.reduce((sum, item) => sum + item.sales, 0);
      answer += `\nTotal Sales: ${totalSales.toLocaleString()} million CHF`;
    } else {
      answer = "I found relevant financial data, but couldn't extract specific sales per region figures from it. Here's what I found:\n\n" + 
        searchResults[0].text.substring(0, 500) + "...";
    }
    
    return res.json({
      answer: answer,
      salesData: regionSalesData,
      sources: searchResults.map(r => ({
        id: r.id,
        text: r.text.substring(0, 300) + "...",
        score: r.score
      })),
      query: query
    });
  } catch (error) {
    logger.error('Error in sales query endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to process sales query',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Specialized endpoint for retrieving segment information from financial data
 */
router.get('/segment-info/:collectionId', async (req, res) => {
  try {
    const collectionId = req.params.collectionId;
    const normalizedCollection = `datasource_${collectionId}`;
    
    logger.info(`Retrieving segment information from collection ${normalizedCollection}`);
    
    const qdrantService = new QdrantService();
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(normalizedCollection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: `Collection ${normalizedCollection} does not exist`
      });
    }
    
    // Get all points from collection
    let points = [];
    let hasMore = true;
    let offset = null;
    let totalPoints = 0;
    
    while (hasMore) {
      try {
        const scrollResult = await qdrantService.scrollPoints(normalizedCollection, 10, offset, true);
        logger.info(`Retrieved ${scrollResult.points.length} points (offset: ${offset})`);
        
        if (scrollResult.points.length > 0) {
          totalPoints += scrollResult.points.length;
          points = points.concat(scrollResult.points);
        }
        
        offset = scrollResult.next_page_offset;
        hasMore = offset !== null && points.length < 50; // Limit to 50 points to avoid memory issues
      } catch (scrollError) {
        logger.error(`Error scrolling points: ${scrollError}`);
        hasMore = false;
      }
    }
    
    if (points.length === 0) {
      return res.json({
        success: false,
        message: "No data found in collection",
        collectionId,
        normalizedCollection
      });
    }
    
    // Extract segments from the points
    let segments = [];
    
    // Look for text containing "Segment" or "Operating segment" or "Zone" keywords
    for (const point of points) {
      const text = point.payload?.text || point.payload?.content || "";
      
      // Look for segment information
      const segmentPatterns = [
        /Zone\s+([A-Z]+)\s+([0-9,\.]+)/g,
        /Segment\s+([A-Za-z\s]+):\s+([0-9,\.]+)/gi,
        /Operating segment[s]?\s+([A-Za-z\s]+):\s+([0-9,\.]+)/gi,
        /(Nestlé Health Science|Nespresso|Other businesses)\s+([0-9,\.]+)/g
      ];
      
      for (const pattern of segmentPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          segments.push({
            name: match[1].trim(),
            value: match[2].replace(/,/g, ''),
            source: text.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50),
            pointId: point.id
          });
        }
      }
    }
    
    // If no segments found with patterns, look for any text with "segment" in it
    if (segments.length === 0) {
      for (const point of points) {
        const text = point.payload?.text || point.payload?.content || "";
        if (text.toLowerCase().includes("segment") || 
            text.toLowerCase().includes("zone") || 
            text.toLowerCase().includes("region")) {
          
          // Extract the paragraph containing segment information
          const paragraphs = text.split('\n').filter(p => 
            p.toLowerCase().includes("segment") || 
            p.toLowerCase().includes("zone") || 
            p.toLowerCase().includes("region")
          );
          
          for (const paragraph of paragraphs) {
            segments.push({
              raw: paragraph,
              pointId: point.id
            });
          }
        }
      }
    }
    
    // Create a formatted response
    let formattedContent = "## Segment Information\n\n";
    
    if (segments.length > 0) {
      formattedContent += "Found the following segments:\n\n";
      
      // Group by segment name if possible
      const groupedSegments = {};
      for (const segment of segments) {
        if (segment.name) {
          if (!groupedSegments[segment.name]) {
            groupedSegments[segment.name] = [];
          }
          groupedSegments[segment.name].push(segment);
        }
      }
      
      if (Object.keys(groupedSegments).length > 0) {
        formattedContent += "| Segment | Value |\n|---------|-------|\n";
        for (const [name, values] of Object.entries(groupedSegments)) {
          const value = values[0].value;
          formattedContent += `| ${name} | ${value} |\n`;
        }
      } else {
        for (const segment of segments) {
          if (segment.raw) {
            formattedContent += `- ${segment.raw}\n`;
          }
        }
      }
    } else {
      formattedContent += "No specific segment information found in the data.";
    }
    
    return res.json({
      success: true,
      segments: segments,
      totalPoints: totalPoints,
      formattedContent: formattedContent,
      collectionId: collectionId,
      normalizedCollection: normalizedCollection
    });
  } catch (error) {
    logger.error(`Error retrieving segment info: ${error}`);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to retrieve segment information"
    });
  }
});

/**
 * @route GET /api/rag/find-collection/:dataSourceId
 * @desc Debug endpoint to test finding the correct collection for a data source
 * @access Private
 */
router.get('/find-collection/:dataSourceId', async (req, res) => {
  try {
    const { dataSourceId } = req.params;
    logger.info(`Testing collection finding for data source ID: ${dataSourceId}`);
    
    // Create a new RagService instance to ensure we get fresh data
    const freshRagService = new RagService();
    
    // Call the findCorrectCollectionName method directly to test
    // @ts-ignore - Accessing private method for debugging
    const collectionName = await freshRagService.findCorrectCollectionName(dataSourceId);
    
    // Also get data source info from the database
    const db = require('../db');
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first('id', 'name', 'type', 'collection_name', 'status');
    
    // Get available collections from Qdrant
    const qdrantService = QdrantService.getInstance();
    const availableCollections = await qdrantService.listCollections();
    
    // Get matching collections
    const matchingCollections = availableCollections.filter(c => 
      c.includes(dataSourceId) || 
      (dataSource?.collection_name && c === dataSource.collection_name)
    );
    
    return res.json({
      success: true,
      dataSourceId,
      foundCollection: collectionName,
      dataSource,
      availableCollections,
      matchingCollections
    });
  } catch (error) {
    logger.error(`Error finding collection: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * @route POST /api/admin/set-debug
 * @desc Enable debug mode for specific modules
 * @access Private
 */
router.post('/admin/set-debug', async (req, res) => {
  try {
    const { debug, module } = req.body;
    
    logger.info(`Setting debug mode to ${debug} for module: ${module}`);
    
    // Set debug environment variables
    if (module === 'rag' || module === 'all') {
      process.env.DEBUG_RAG = debug ? 'true' : 'false';
    }
    
    if (module === 'qdrant' || module === 'all') {
      process.env.DEBUG_QDRANT = debug ? 'true' : 'false';
    }
    
    if (module === 'openai' || module === 'all') {
      process.env.DEBUG_OPENAI = debug ? 'true' : 'false';
    }
    
    return res.json({
      success: true,
      debug,
      module,
      message: `Debug mode ${debug ? 'enabled' : 'disabled'} for ${module}`
    });
  } catch (error) {
    logger.error(`Error setting debug mode: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * New endpoint to manually set the collection_name for document data sources
 */
router.post('/set-collection/:dataSourceId', async (req, res) => {
  try {
    const { dataSourceId } = req.params;
    const { collectionName } = req.body;
    
    if (!collectionName) {
      return res.status(400).json({
        success: false,
        error: 'Collection name is required'
      });
    }
    
    logger.info(`Setting collection name for data source ${dataSourceId} to ${collectionName}`);
    
    // Verify that the collection exists in Qdrant
    const qdrantService = new QdrantService();
    const exists = await qdrantService.collectionExists(collectionName);
    
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Collection ${collectionName} does not exist in Qdrant`
      });
    }
    
    // Update the data source in the database
    const db = require('../db');
    const updated = await db('data_sources')
      .where('id', dataSourceId)
      .update({
        collection_name: collectionName,
        metadata: db.raw(`
          jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{collection_name}',
            ?::jsonb
          )
        `, [JSON.stringify(collectionName)]),
        updated_at: new Date()
      })
      .returning(['id', 'name', 'collection_name']);
    
    if (!updated || updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Data source ${dataSourceId} not found`
      });
    }
    
    logger.info(`Successfully updated data source ${dataSourceId} with collection_name: ${collectionName}`);
    
    // Return success
    return res.json({
      success: true,
      dataSource: updated[0],
      message: `Collection name set to ${collectionName}`
    });
  } catch (error) {
    logger.error(`Error setting collection name: ${error}`);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Direct collection search endpoint for document collections
 * This bypasses the database check and directly searches Qdrant
 */
router.post('/direct-search/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    logger.info(`Processing direct search for collection: ${collectionId} with query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    // Try different collection name formats
    const collectionFormats = [
      `datasource_${collectionId}`, // Standard format
      collectionId.includes('datasource_') ? collectionId : null, // Already in correct format
      collectionId // Raw format
    ].filter(Boolean);
    
    const qdrantService = new QdrantService();
    
    // Check each format and use the first one that exists
    let validCollection = null;
    for (const collection of collectionFormats) {
      const exists = await qdrantService.collectionExists(collection);
      if (exists) {
        logger.info(`Found valid collection: ${collection}`);
        validCollection = collection;
        break;
      }
    }
    
    if (!validCollection) {
      return res.status(404).json({ 
        error: `No valid collection found for ID ${collectionId}`,
        checkedFormats: collectionFormats
      });
    }
    
    // Get embedding for query
    const openaiService = new OpenAIService();
    const embedding = await openaiService.createEmbeddings([query]);
    
    if (!embedding || embedding.length === 0) {
      return res.status(500).json({ error: 'Failed to create embedding for query' });
    }
    
    // Search the collection
    logger.info(`Searching collection ${validCollection} with vector`);
    const results = await qdrantService.search(validCollection, embedding[0], {}, 10);
    
    return res.json({
      collection: validCollection,
      query,
      results: results.map(result => ({
        id: result.id,
        score: result.score,
        text: result.payload?.text || result.payload?.content || 'No text content',
        payload: result.payload
      }))
    });
  } catch (error) {
    logger.error(`Error in direct search endpoint: ${error}`);
    return res.status(500).json({ 
      error: 'Failed to perform direct search',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Endpoint to bypass collection name finding and directly use collections with the datasource_UUID format
 */
router.post('/query-direct-collection', async (req, res) => {
  try {
    const { query, dataSourceId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Processing direct collection query for ID: ${dataSourceId}`);
    
    // Always use the direct datasource_{uuid} pattern
    const collectionName = dataSourceId.startsWith('datasource_') 
      ? dataSourceId 
      : `datasource_${dataSourceId}`;
    
    // Verify the collection exists
    const qdrantService = new QdrantService();
    const exists = await qdrantService.collectionExists(collectionName);
    
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Collection ${collectionName} does not exist in Qdrant`
      });
    }
    
    // Get embedding for query
    const openaiService = new OpenAIService();
    const embeddings = await openaiService.createEmbeddings([query]);
    
    if (!embeddings || embeddings.length === 0) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create embeddings for query' 
      });
    }
    
    // Search for documents
    const searchResults = await qdrantService.search(
      collectionName,
      embeddings[0],
      {},
      10
    );
    
    // Format the results
    const documents = searchResults.map(result => ({
      id: result.id,
      content: result.payload?.text || result.payload?.content || JSON.stringify(result.payload),
      metadata: {
        score: result.score,
        dataSourceId: dataSourceId,
        collectionName
      }
    }));
    
    // Generate response
    const prompt = `
      You are analyzing documents retrieved from a vector database in response to this query: "${query}"
      
      The documents are from collection: ${collectionName}
      
      Based on these retrieved documents, please provide a comprehensive answer to the query.
      If there are no relevant documents or the documents don't contain information to answer the query,
      acknowledge this and suggest what additional information might be needed.
      
      Format your response in a clear, well-structured manner.
    `;
    
    const messages = [
      { role: 'system', content: prompt },
      ...documents.map((doc, index) => ({
        role: 'user',
        content: `Document ${index + 1}:\n${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...' : ''}`
      }))
    ] as any[]; // Type assertion to fix linter error
    
    // Use a smaller model for faster responses
    const model = 'o3-mini';
    
    const completion = await openaiService.generateChatCompletion(
      messages,
      { model, temperature: 0.3 }
    );
    
    const content = completion.choices[0].message.content;
    
    return res.json({
      success: true,
      sources: documents.map(doc => ({
        id: doc.id,
        text: doc.content.substring(0, 150) + (doc.content.length > 150 ? '...' : ''),
        score: doc.metadata.score,
        dataSourceId
      })),
      content,
      model,
      metadata: {
        processingTime: 0,
        model,
        collectionNames: [collectionName],
        dataSourceIds: [dataSourceId],
        dataSourceType: 'qdrant',
        isQdrantResponse: true,
        useEnhancedVisualization: false,
        hasVisualization: false
      }
    });
  } catch (error) {
    logger.error(`Error in direct collection query: ${error}`);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
});

/**
 * New endpoint to check all available collections in Qdrant 
 * and find ones that might match a data source ID
 */
router.get('/find-matching-collections/:dataSourceId', async (req, res) => {
  try {
    const { dataSourceId } = req.params;
    logger.info(`Finding collections matching ID: ${dataSourceId}`);
    
    const qdrantService = new QdrantService();
    
    // List all collections
    let collections = [];
    try {
      const collectionsResponse = await qdrantService.listCollections();
      collections = Array.isArray(collectionsResponse) 
        ? collectionsResponse 
        : ((collectionsResponse as any)?.collections?.map(c => c.name) || []); // Type assertion to fix linter error
      
      logger.info(`Found ${collections.length} collections in Qdrant`);
      
      // Special case for 'all' - just return the list of collections
      if (dataSourceId === 'all') {
        return res.json({
          success: true,
          collections
        });
      }
    } catch (error) {
      logger.error(`Error listing collections: ${error}`);
      return res.status(500).json({
        success: false,
        error: `Failed to list collections: ${error.message}`
      });
    }
    
    // Find all possible matching collections
    const directMatch = `datasource_${dataSourceId}`;
    
    const matchingCollections = {
      directMatch: collections.includes(directMatch) ? directMatch : null,
      containsId: collections.filter(name => 
        name.includes(dataSourceId) && name !== directMatch
      ),
      containsUuid: dataSourceId.includes('-') 
        ? collections.filter(name => name.includes(dataSourceId))
        : [],
      snowflakePatterns: collections.filter(name =>
        name.startsWith(`snowflake_${dataSourceId}_`) ||
        name.startsWith(`datasource_snowflake_${dataSourceId}_`) ||
        name.startsWith(`row_data_${dataSourceId}_`)
      )
    };
    
    // Check each matching collection for points
    const collectionsWithPoints = [];
    
    // Function to check and add collection with point count
    const checkCollection = async (collectionName) => {
      try {
        const info = await qdrantService.getInfo(collectionName);
        const pointCount = info.points_count || 0;
        
        collectionsWithPoints.push({
          name: collectionName,
          pointCount,
          hasPoints: pointCount > 0
        });
      } catch (error) {
        logger.warn(`Error getting info for collection ${collectionName}: ${error.message}`);
        collectionsWithPoints.push({
          name: collectionName,
          pointCount: null,
          hasPoints: null,
          error: error.message
        });
      }
    };
    
    // Check the direct match first
    if (matchingCollections.directMatch) {
      await checkCollection(matchingCollections.directMatch);
    }
    
    // Check all other potential matches
    const allOtherMatches = [
      ...matchingCollections.containsId,
      ...matchingCollections.containsUuid,
      ...matchingCollections.snowflakePatterns
    ];
    
    // Remove duplicates
    const uniqueMatches = [...new Set(allOtherMatches)];
    
    for (const collection of uniqueMatches) {
      await checkCollection(collection);
    }
    
    // Sort collections by point count (descending)
    collectionsWithPoints.sort((a, b) => {
      if (a.pointCount === null) return 1;
      if (b.pointCount === null) return -1;
      return b.pointCount - a.pointCount;
    });
    
    // Return the results
    return res.json({
      success: true,
      dataSourceId,
      directMatch: matchingCollections.directMatch,
      matchingPatterns: {
        containsId: matchingCollections.containsId,
        containsUuid: matchingCollections.containsUuid,
        snowflakePatterns: matchingCollections.snowflakePatterns
      },
      collectionsWithPoints,
      recommendedCollection: collectionsWithPoints.length > 0 
        ? collectionsWithPoints[0].name 
        : null
    });
  } catch (error) {
    logger.error(`Error finding matching collections: ${error}`);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

export default router; 