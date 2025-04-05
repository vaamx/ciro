import { Request, Response } from '../types';
import { BadRequestError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';
import { QdrantSearchService } from '../services/vector/search.service';
import { OpenAIService } from '../services/ai/openai.service';
import { DocumentProcessorService } from '../services/data-processing/document-processor.service';

interface SearchResult {
  id?: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  fileId?: string;
}

// Mock interface for OpenAIEmbedding since the original import is not available
interface MockEmbedding {
  getTextEmbedding(text: string): Promise<number[]>;
}

export class SearchController {
  private qdrantService: QdrantSearchService;
  private openaiService: OpenAIService;
  private documentProcessor: DocumentProcessorService;
  // Create a mock embedding instance
  private embedding: MockEmbedding = {
    getTextEmbedding: async (text: string) => {
      // Return a mock embedding of 1536 dimensions (OpenAI standard)
      return Array(1536).fill(0).map(() => Math.random() - 0.5);
    }
  };

  constructor(private readonly documentProcessorService: DocumentProcessorService, private readonly openAIService: OpenAIService, private readonly qdrantSearchService: QdrantSearchService) {
    this.qdrantService = this.qdrantSearchService;
    this.openaiService = this.openAIService;
    this.documentProcessor = this.documentProcessorService;
  }

  async searchSimilarDocuments(req: Request, res: Response) {
    const { query, fileId, limit, similarityThreshold } = req.query;

    if (!query) {
      throw new BadRequestError('Query is required');
    }

    try {
      // Detect if this is an analytical query
      const isAnalyticalQuery = this.isAnalyticalQuery(query as string);
      const isVCFundCountQuery = this.isVCFundCountQuery(query as string);
      
      console.log(`Query classification: isAnalytical=${isAnalyticalQuery}, isVCFundCount=${isVCFundCountQuery}`);
      
      let results: SearchResult[] = [];
      
      // If file ID is provided, search only within that file
      if (fileId) {
        // Get the collection name from the database
        const fileResult = await pool.query(
          `SELECT * FROM files WHERE id = $1`,
          [fileId]
        );
        
        if (fileResult.rows && fileResult.rows.length > 0) {
          const collectionName = fileResult.rows[0].metadata?.collectionName;
          
          if (collectionName) {
            // Now handle the array of arrays format
            const embeddings = await this.openaiService.createEmbeddings(query as string);
            
            // Normalize the collection name
            const normalizedCollection = this.documentProcessor.getCollectionName(collectionName);
            
            // Search the file's collection with the first embedding vector
            const searchLimit = parseInt(limit as string) || (isAnalyticalQuery ? 50 : 10);
            const searchResults = await this.qdrantService.search(
              normalizedCollection,
              embeddings[0], // Use the first embedding vector
              undefined,
              searchLimit
            );
            
            // Format results
            results = searchResults.map(result => ({
              content: result.payload?.text || result.payload?.content || '',
              metadata: result.payload?.metadata || {},
              similarity: result.score || 0,
              fileId: fileId as string
            }));
          } else {
            throw new BadRequestError('File does not have a collection');
          }
        } else {
          throw new BadRequestError('File not found');
        }
      } else {
        // Search across all files
        // Get all files for the user
        const files = await pool.query(
          `SELECT * FROM files`,
        );
        
        let allResults: SearchResult[] = [];
        
        // Handle array of arrays format
        const embeddings = await this.openaiService.createEmbeddings(query as string);
        
        // Search each file
        for (const file of files.rows) {
          if (file.metadata?.collectionName) {
            try {
              // Normalize the collection name
              const normalizedCollection = this.documentProcessor.getCollectionName(file.metadata.collectionName);
              
              // Search the file's collection with the first embedding vector
              const searchLimit = parseInt(limit as string) || (isAnalyticalQuery ? 20 : 5);
              const searchResults = await this.qdrantService.search(
                normalizedCollection,
                embeddings[0], // Use the first embedding vector
                undefined,
                searchLimit
              );
              
              // Format and add results
              const fileResults = searchResults.map(result => ({
                content: result.payload?.text || result.payload?.content || '',
                metadata: result.payload?.metadata || {},
                similarity: result.score || 0,
                fileId: file.id.toString()
              }));
              
              allResults = allResults.concat(fileResults);
            } catch (error) {
              console.error(`Error searching file ${file.id}:`, error);
            }
          }
        }
        
        // Sort by similarity
        allResults.sort((a, b) => b.similarity - a.similarity);
        
        // Limit results
        const maxResults = parseInt(limit as string) || 20;
        results = allResults.slice(0, maxResults);
      }

      res.json({
        results,
        total: results.length,
        query
      });
    } catch (error) {
      console.error('Error in search controller:', error);
      res.status(500).json({ error: 'Failed to perform search', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getUserFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        throw new BadRequestError('User ID is required');
      }
      
      const client = await pool.connect();
      try {
        const query = `
          SELECT id, name, type, status, metadata, created_at, updated_at
          FROM files
          WHERE user_id = $1
          ORDER BY created_at DESC
        `;
        
        const result = await client.query(query, [req.user.id]);
        
        res.json({
          files: result.rows,
          total: result.rows.length
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error retrieving user files:', error);
      res.status(500).json({ error: 'Failed to retrieve user files' });
    }
  }

  /**
   * Determines whether a query is analytical in nature
   * @param query The user query
   * @returns Whether the query is analytical
   */
  private isAnalyticalQuery(query: string): boolean {
    const analyticalPatterns = [
      /how many/i,
      /count of/i,
      /number of/i,
      /total number/i,
      /total count/i,
      /records for/i,
      /entries for/i,
      /list all/i,
      /return the list/i,
      /tally/i,
      /aggregate/i,
      /sum of/i
    ];
    
    // Specific entity pattern checks
    const containsSouthParkCommons = /South Park Commons/i.test(query);
    
    // If query is about South Park Commons + any kind of count/list pattern,
    // treat it as analytical
    if (containsSouthParkCommons && (/records/i.test(query) || /entries/i.test(query) || 
                                     /how many/i.test(query) || /count/i.test(query))) {
      console.log('Detected analytical query about South Park Commons');
      return true;
    }
    
    return analyticalPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Determines whether a query is specifically counting VC funds
   * @param query The user query
   * @returns Whether the query is counting VC funds
   */
  private isVCFundCountQuery(query: string): boolean {
    const vcFundPatterns = [
      /vc fund/i,
      /venture capital/i,
      /investors/i
    ];
    
    const countPatterns = [
      /how many/i,
      /count/i,
      /number/i,
      /list/i
    ];
    
    return vcFundPatterns.some(vcPattern => vcPattern.test(query)) && 
           countPatterns.some(countPattern => countPattern.test(query));
  }
  
  /**
   * Count entities in the search results
   * This helps with analytical queries to provide counts of specific entities
   */
  private countEntitiesInResults(results: SearchResult[]): Record<string, number> {
    const entityCounts: Record<string, number> = {};
    
    for (const result of results) {
      const content = result.content || '';
      
      // Try to identify specific entities in the content
      this.extractEntitiesFromContent(content).forEach(entity => {
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
      });
      
      // Also look for entities in metadata
      if (result.metadata) {
        const metadata = result.metadata;
        
        // Check common metadata fields that might contain entity names
        ['title', 'name', 'organization', 'vc_fund', 'fund_name', 'company'].forEach(field => {
          if (metadata[field] && typeof metadata[field] === 'string' && metadata[field].trim()) {
            const entity = metadata[field].trim();
            entityCounts[entity] = (entityCounts[entity] || 0) + 1;
          }
        });
      }
    }
    
    return entityCounts;
  }
  
  /**
   * Extract potential entity names from content
   */
  private extractEntitiesFromContent(content: string): string[] {
    const entities: string[] = [];
    
    // Check for common patterns that might indicate entity names
    
    // Check for "VC Fund: [Name]" pattern
    const vcFundMatch = content.match(/VC Fund:?\s*([^,\n.]+)/i);
    if (vcFundMatch && vcFundMatch[1]) {
      entities.push(vcFundMatch[1].trim());
    }
    
    // Check for "Name: [Name]" pattern
    const nameMatch = content.match(/Name:?\s*([^,\n.]+)/i);
    if (nameMatch && nameMatch[1]) {
      entities.push(nameMatch[1].trim());
    }
    
    // Check for "South Park Commons" specifically since it was mentioned
    if (content.includes('South Park Commons')) {
      entities.push('South Park Commons');
    }
    
    // Look for other common VC fund indicators
    const fundPatterns = [
      /([A-Z][a-z]+ (?:Capital|Ventures|Partners|VC))/g,
      /([A-Z][a-z]+ [A-Z][a-z]+ (?:Capital|Ventures|Partners|VC))/g
    ];
    
    fundPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          entities.push(match[1]);
        }
      }
    });
    
    return [...new Set(entities)]; // Remove duplicates
  }
} 