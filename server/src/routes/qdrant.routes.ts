import express, { Request, Response } from '../types/express-types';
import { QdrantService } from '../services/qdrant.service';
import { authenticate } from '../middleware/auth';
import { createServiceLogger } from '../utils/logger-factory';
import { OpenAIService } from '../services/openai.service';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const logger = createServiceLogger('QdrantRoutes');
const qdrantService = QdrantService.getInstance();
const openaiService = OpenAIService.getInstance();

// General utility function to search and count entities
async function countEntitiesByKeyword(collection: string, keyword: string, fieldName: string = 'text'): Promise<number> {
  try {
    // Create an embedding for the keyword
    const embeddings = await openaiService.createEmbeddings([keyword]);
    
    if (!embeddings || embeddings.length === 0) {
      logger.error(`Failed to create embedding for keyword: ${keyword}`);
      return 0;
    }
    
    // Search for matching documents
    const results = await qdrantService.search(collection, embeddings[0], {
      filter: {
        must: [
          {
            key: fieldName,
            match: {
              text: keyword
            }
          }
        ]
      }
    }, 100);
    
    // Return the count of unique documents
    const uniqueDocuments = new Set(results.map(r => r.id));
    return uniqueDocuments.size;
  } catch (error) {
    logger.error(`Error counting entities for keyword '${keyword}':`, error);
    return 0;
  }
}

/**
 * Route to check if a collection exists
 */
router.get('/collections/:collection/exists', authenticate, async (req, res) => {
  try {
    const { collection } = req.params;
    const exists = await qdrantService.collectionExists(collection);
    res.json({ exists });
  } catch (error) {
    logger.error('Error checking if collection exists:', error);
    res.status(500).json({ error: 'Failed to check if collection exists' });
  }
});

/**
 * Route to count unique VC funds in a collection
 */
router.get('/collections/:collection/count-funds', authenticate, async (req, res) => {
  try {
    const { collection } = req.params;
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({ error: `Collection ${collection} does not exist` });
    }
    
    // Count VC funds using keyword search
    const count = await countEntitiesByKeyword(collection, "venture capital fund");
    
    res.json({ collection, count });
  } catch (error) {
    logger.error('Error counting VC funds:', error);
    res.status(500).json({ error: 'Failed to count VC funds' });
  }
});

/**
 * Route to count unique investors in a collection
 */
router.get('/collections/:collection/count-investors', authenticate, async (req, res) => {
  try {
    const { collection } = req.params;
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({ error: `Collection ${collection} does not exist` });
    }
    
    // Count investors using keyword search
    const count = await countEntitiesByKeyword(collection, "investor");
    
    res.json({ collection, count });
  } catch (error) {
    logger.error('Error counting investors:', error);
    res.status(500).json({ error: 'Failed to count investors' });
  }
});

/**
 * Route to count entities by pattern
 */
router.post('/collections/:collection/count-entities', authenticate, async (req, res) => {
  try {
    const { collection } = req.params;
    const { pattern, entityType } = req.body;
    
    if (!pattern || !entityType) {
      return res.status(400).json({ error: 'Pattern and entityType are required' });
    }
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({ error: `Collection ${collection} does not exist` });
    }
    
    // Count entities by doing a keyword search
    const count = await countEntitiesByKeyword(collection, entityType);
    
    res.json({ 
      collection, 
      entityType, 
      count,
      message: 'Simplified entity counting - results are approximate'
    });
  } catch (error) {
    logger.error('Error counting entities by pattern:', error);
    res.status(500).json({ error: 'Failed to count entities' });
  }
});

/**
 * Route to analyze document structure
 */
router.get('/collections/:collection/analyze', authenticate, async (req, res) => {
  try {
    const { collection } = req.params;
    const sampleSize = parseInt(req.query.sampleSize as string) || 10;
    
    // Check if collection exists
    const exists = await qdrantService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({ error: `Collection ${collection} does not exist` });
    }
    
    // Get document samples
    const samples = await qdrantService.search(collection, Array(1536).fill(0), {}, sampleSize);
    
    // Generate basic analysis
    const analysis = {
      sampleSize: samples.length,
      averageTextLength: samples.reduce((sum, doc) => sum + (doc.text?.length || 0), 0) / (samples.length || 1),
      fields: Object.keys(samples[0] || {}).filter(key => key !== 'id' && key !== '_score'),
      metadata: samples.filter(s => s.metadata).length > 0 ? 
        Object.keys(samples.find(s => s.metadata)?.metadata || {}) : [],
      message: 'Basic structure analysis using random samples'
    };
    
    res.json(analysis);
  } catch (error) {
    logger.error('Error analyzing document structure:', error);
    res.status(500).json({ error: 'Failed to analyze document structure' });
  }
});

/**
 * Endpoint to get clock data for a collection
 */
router.get('/clock-data/:collection/:id', async (req, res) => {
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
});

export default router; 