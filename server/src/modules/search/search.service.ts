import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { QdrantSearchService } from '../../services/vector/search.service';
import { OpenAIService } from '../../services/ai/openai.service';
import { DocumentProcessingService } from '../document-processing/document-processing.service';
import { SearchResponseDto } from './dto/search-response.dto';

interface SearchResult {
  id?: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  fileId?: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly documentProcessorService: DocumentProcessingService,
    @Optional() private readonly openAIService: OpenAIService,
    @Optional() private readonly qdrantSearchService: QdrantSearchService,
    private readonly pool: Pool
  ) {
    if (!this.openAIService) {
      this.logger.warn('OpenAIService is not available in SearchService - some search features may be limited');
    }
    
    if (!this.qdrantSearchService) {
      this.logger.warn('QdrantSearchService is not available in SearchService - vector search functionality will be limited');
    }
  }

  /**
   * Search for similar documents based on a query
   */
  async searchSimilarDocuments(
    query: string, 
    userId: string, 
    fileIds?: string, 
    limit?: string
  ): Promise<SearchResponseDto> {
    this.logger.log(`Searching documents - query: "${query}", userId: ${userId}, fileIds: ${fileIds}`);
    
    let results: SearchResult[] = [];
    
    // If specific fileIds were provided, only search those files
    if (fileIds && fileIds.trim()) {
      results = await this.searchSpecificFiles(query, userId, fileIds, limit);
    } else {
      // No specific fileIds, search all files for the user
      results = await this.searchAllUserFiles(query, userId, limit);
    }

    return {
      results,
      total: results.length,
      query
    };
  }

  /**
   * Get all files for a user
   */
  async getUserFiles(userId: string) {
    this.logger.log(`Getting files for user ${userId}`);
    
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT id, name, type, status, metadata, created_at, updated_at
        FROM files
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [userId]);
      
      return {
        files: result.rows,
        total: result.rows.length
      };
    } catch (error) {
      this.logger.error(
        `Database error retrieving files for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException('Failed to retrieve user files from database');
    } finally {
      client.release();
    }
  }

  /**
   * Search specific files identified by fileIds
   */
  private async searchSpecificFiles(
    query: string, 
    userId: string, 
    fileIds: string, 
    limit?: string
  ): Promise<SearchResult[]> {
    const fileIdArray = fileIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    
    if (fileIdArray.length === 0) {
      throw new BadRequestException('Invalid file IDs provided');
    }
    
    const client = await this.pool.connect();
    try {
      // Get the files
      const fileQuery = `
        SELECT id, name, content, metadata, user_id
        FROM files
        WHERE id = ANY($1)
      `;
      
      const fileResult = await client.query(fileQuery, [fileIdArray]);
      
      if (fileResult.rows.length === 0) {
        throw new NotFoundException('No files found with the provided IDs');
      }
      
      // Check permissions (if not admin, only allow access to own files)
      const unauthorizedFiles = fileResult.rows.filter(
        file => file.user_id !== userId && file.user_id !== 'admin'
      );
      
      if (unauthorizedFiles.length > 0) {
        throw new BadRequestException('Unauthorized access to one or more files');
      }
      
      // Perform the search on each file
      let allResults: SearchResult[] = [];
      
      for (const file of fileResult.rows) {
        try {
          const searchResults = await this.searchSingleFile(file, query, limit);
          allResults = allResults.concat(searchResults);
        } catch (error) {
          this.logger.error(`Error searching file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Sort by similarity
      allResults.sort((a, b) => b.similarity - a.similarity);
      
      // Check if this is an analytical query
      if (this.isAnalyticalQuery(query)) {
        // Process results for analytical queries
        const entityCounts = this.countEntitiesInResults(allResults);
        
        // Add entity count information to the results
        return [{
          content: JSON.stringify(entityCounts),
          metadata: {
            type: 'analytical_result',
            entities: Object.keys(entityCounts).length,
            query
          },
          similarity: 1.0
        }];
      } else {
        // Limit results for regular queries
        const maxResults = parseInt(limit || '20');
        return allResults.slice(0, maxResults);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Search all files belonging to a user
   */
  private async searchAllUserFiles(
    query: string, 
    userId: string, 
    limit?: string
  ): Promise<SearchResult[]> {
    if (!userId) {
      throw new BadRequestException('User ID is required when fileIds are not provided');
    }
    
    const client = await this.pool.connect();
    let allResults: SearchResult[] = [];
    
    try {
      // Get all user files
      const fileQuery = `
        SELECT id, name, content, metadata
        FROM files
        WHERE user_id = $1
      `;
      
      const fileResult = await client.query(fileQuery, [userId]);
      
      if (fileResult.rows.length === 0) {
        // Return empty results if user has no files
        return [];
      }
      
      // Perform search on each file
      for (const file of fileResult.rows) {
        try {
          const searchResults = await this.searchSingleFile(file, query, limit);
          allResults = allResults.concat(searchResults);
        } catch (error) {
          this.logger.error(`Error searching file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Sort by similarity
      allResults.sort((a, b) => b.similarity - a.similarity);
      
      // Limit results
      const maxResults = parseInt(limit || '20');
      return allResults.slice(0, maxResults);
    } finally {
      client.release();
    }
  }

  /**
   * Search a single file and return results
   */
  private async searchSingleFile(file: any, query: string, limit?: string): Promise<SearchResult[]> {
    const collectionName = `file_${file.id}`;
    const isAnalytical = this.isAnalyticalQuery(query);
    const searchLimit = isAnalytical ? 100 : (parseInt(limit || '20'));
    
    this.logger.debug(`Searching collection ${collectionName} with query: "${query}" (analytical: ${isAnalytical})`);
    
    // Check if OpenAI service is available
    if (!this.openAIService || !this.qdrantSearchService) {
      this.logger.warn('Required search services not available - returning placeholder result');
      return [{
        content: "Search functionality is limited while services are initializing. Please try again in a moment.",
        metadata: {
          notice: "Services starting up",
          file_name: file.name,
          file_id: file.id
        },
        similarity: 0.5,
        fileId: file.id
      }];
    }
    
    // Get embedding for the query
    const embeddings = await this.openAIService.createEmbeddings(query || '');
    
    // Perform the search
    const searchResults = await this.qdrantSearchService.search(
      collectionName,
      embeddings[0], // Use the first embedding vector
      undefined,
      searchLimit
    );
    
    // Format and add results
    return searchResults.map((result: any) => ({
      content: result.payload?.text || result.payload?.content || '',
      metadata: result.payload?.metadata || {},
      similarity: result.score || 0,
      fileId: file.id.toString()
    }));
  }

  /**
   * Determines whether a query is analytical in nature
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
    
    return analyticalPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Count entities in the search results
   */
  private countEntitiesInResults(results: SearchResult[]): Record<string, number> {
    const entityCounts: Record<string, number> = {};
    
    for (const result of results) {
      const content = result.content || '';
      
      // Try to identify generic entities in the content
      this.extractEntitiesFromContent(content).forEach(entity => {
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
      });
      
      // Also look for entities in metadata
      if (result.metadata) {
        const metadata = result.metadata;
        
        // Check common metadata fields that might contain entity names
        ['title', 'name', 'organization', 'company', 'category', 'tag'].forEach(field => {
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
   * Extract potential entity names from content using generic patterns
   */
  private extractEntitiesFromContent(content: string): string[] {
    const entities: string[] = [];
    
    // Extract labeled entities (Name: X, Category: Y, etc.)
    const labeledEntityPattern = /([A-Z][a-z]+):?\s*([^,\n.]+)/gi;
    const matches = content.matchAll(labeledEntityPattern);
    
    for (const match of matches) {
      if (match[2] && match[2].trim()) {
        entities.push(match[2].trim());
      }
    }
    
    // Extract potential named entities (proper nouns)
    // This is a simplistic approach - in a real system, you might use NLP
    const potentialNamedEntities = content.match(/\b[A-Z][a-z]+ (?:[A-Z][a-z]+ )*(?:[A-Z][a-z]+)\b/g) || [];
    entities.push(...potentialNamedEntities);
    
    return [...new Set(entities)]; // Remove duplicates
  }
} 