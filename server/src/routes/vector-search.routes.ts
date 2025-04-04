/**
 * Vector Search API Routes
 * This file implements the API endpoints needed by the dashboard's QdrantService
 */
import express, { Request, Response } from '../types/express-types';
import { QdrantService } from '../services/qdrant.service';
import { authenticate } from '../middleware/auth';
import { createServiceLogger } from '../utils/logger-factory';
import { OpenAIService } from '../services/openai.service';

const router = express.Router();
const logger = createServiceLogger('VectorSearchRoutes');
const qdrantService = QdrantService.getInstance();
const openaiService = OpenAIService.getInstance();

/**
 * @route POST /api/ext/vector-search
 * @desc Search Qdrant collection by vector similarity
 * @access Private
 */
router.post('/vector-search', authenticate, async (req, res) => {
  try {
    const { collection, vector, limit = 5, filter, includeMetadata = true } = req.body;
    
    if (!collection || !vector) {
      return res.status(400).json({ error: 'Collection name and vector are required' });
    }
    
    logger.info(`Vector search request for collection: ${collection}, vector length: ${vector.length}, limit: ${limit}`);
    
    // Perform the vector search
    const results = await qdrantService.search(collection, vector, filter, limit);
    
    // If we have results, return them directly
    if (results && results.length > 0) {
      logger.info(`Vector search returned ${results.length} results from ${collection}`);
      return res.json(results);
    }
    
    // If no results, return empty array
    logger.info(`No vector search results found for collection ${collection}`);
    return res.json([]);
  } catch (error) {
    logger.error('Error in vector search:', error);
    return res.status(500).json({ error: 'Failed to perform vector search' });
  }
});

/**
 * @route POST /api/ext/text-search
 * @desc Search Qdrant by text query (creates embedding first)
 * @access Private
 */
router.post('/text-search', authenticate, async (req, res) => {
  try {
    const { collection, text, limit = 10, filter, includeMetadata = true } = req.body;
    
    if (!collection || !text) {
      return res.status(400).json({ error: 'Collection name and text query are required' });
    }
    
    logger.info(`Text search request for collection: ${collection}, query: "${text}", limit: ${limit}`);
    
    // Create an embedding from the text
    try {
      const embeddings = await openaiService.createEmbeddings(text);
      
      if (!embeddings || embeddings.length === 0) {
        logger.error(`Failed to create embedding for text: ${text}`);
        return res.status(500).json({ error: 'Failed to create embedding for text search' });
      }
      
      // Use the embedding to perform a vector search
      const results = await qdrantService.search(collection, embeddings[0], filter, limit);
      
      if (results && results.length > 0) {
        logger.info(`Text search returned ${results.length} results from ${collection}`);
        return res.json(results);
      }
      
      // If no results, return empty array
      logger.info(`No text search results found for collection ${collection}`);
      return res.json([]);
    } catch (embeddingError) {
      logger.error('Error creating embedding for text search:', embeddingError);
      return res.status(500).json({ error: 'Failed to create embedding for text search' });
    }
  } catch (error) {
    logger.error('Error in text search:', error);
    return res.status(500).json({ error: 'Failed to perform text search' });
  }
});

/**
 * @route POST /api/qdrant/search
 * @desc Direct Qdrant search endpoint (alternate format)
 * @access Private
 */
router.post('/search', authenticate, async (req, res) => {
  try {
    const { collection_name, vector, filter, limit = 5, similarity_threshold = 0.2 } = req.body;
    
    if (!collection_name || !vector) {
      return res.status(400).json({ error: 'Collection name and vector are required' });
    }
    
    logger.info(`Qdrant search request for collection: ${collection_name}, vector length: ${vector.length}, limit: ${limit}, threshold: ${similarity_threshold}`);
    
    // Perform the vector search
    const results = await qdrantService.search(collection_name, vector, filter, limit, similarity_threshold);
    
    // Format response to match expected format
    return res.json({
      points: results,
      time: Date.now()
    });
  } catch (error) {
    logger.error('Error in Qdrant search:', error);
    return res.status(500).json({ error: 'Failed to perform Qdrant search' });
  }
});

export default router; 