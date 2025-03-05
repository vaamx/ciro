import { Router } from 'express';
import { RagService } from '../services/rag.service';
import { authenticate } from '../middleware/auth';
import { createLogger } from '../utils/logger';

const router = Router();
const ragService = new RagService();
const logger = createLogger('RagRoutes');

/**
 * @route POST /api/rag/query
 * @desc Process a RAG query against specified data sources
 * @access Private
 */
router.post('/query', authenticate, async (req, res) => {
  try {
    const { query, dataSourceIds, sessionId, documentId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    if (!dataSourceIds || !Array.isArray(dataSourceIds) || dataSourceIds.length === 0) {
      return res.status(400).json({ error: 'At least one data source ID is required' });
    }
    
    logger.info(`Processing RAG query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}" for data sources: ${dataSourceIds.join(', ')}`);
    
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

export default router; 