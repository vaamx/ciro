import { db } from '../infrastructure/database';
import { OpenAIService } from './openai.service';
import { QdrantService } from './qdrant.service';
import { createLogger } from '../utils/logger';

/**
 * Hybrid Search Service
 * Combines semantic (vector) search with keyword-based (BM25) search
 * for improved retrieval performance
 */
export class HybridSearchService {
  private openaiService: OpenAIService;
  private qdrantService: QdrantService;
  private logger = createLogger('HybridSearchService');

  constructor() {
    this.openaiService = OpenAIService.getInstance();
    this.qdrantService = QdrantService.getInstance();
    this.logger.info('Initialized HybridSearchService');
  }

  /**
   * Perform a hybrid search across specified data sources
   * @param query The search query
   * @param dataSourceIds Array of data source IDs to search in
   * @param options Search options
   * @returns Array of search results
   */
  async search(
    query: string,
    dataSourceIds: string[] | number[],
    options: {
      limit?: number;
      semanticWeight?: number;
      keywordWeight?: number;
      similarityThreshold?: number;
      includeMetadata?: boolean;
      isAnalytical?: boolean;
    } = {}
  ): Promise<any[]> {
    const {
      limit = 10,
      semanticWeight = 0.75,
      keywordWeight = 0.25,
      similarityThreshold = 0.3,
      includeMetadata = true,
      isAnalytical = false,
    } = options;

    this.logger.info(`Performing hybrid search for: "${query.substring(0, 50)}..."`);
    this.logger.info(`Search parameters: semanticWeight=${semanticWeight}, keywordWeight=${keywordWeight}, limit=${limit}`);

    try {
      // Normalize data source IDs to numbers
      const numericIds = dataSourceIds.map(id => 
        typeof id === 'string' ? parseInt(id, 10) : id
      );

      // 1. Perform semantic search
      const semanticResults = await this.performSemanticSearch(
        query,
        numericIds,
        Math.ceil(limit * 1.5), // Get more results for reranking
        similarityThreshold,
        isAnalytical
      );

      this.logger.info(`Found ${semanticResults.length} results from semantic search`);

      // 2. Perform keyword search
      const keywordResults = await this.performKeywordSearch(
        query,
        numericIds,
        Math.ceil(limit * 1.5) // Get more results for reranking
      );

      this.logger.info(`Found ${keywordResults.length} results from keyword search`);

      // 3. Combine and rerank the results
      const combinedResults = this.combineAndRerank(
        semanticResults,
        keywordResults,
        semanticWeight,
        keywordWeight,
        limit
      );

      this.logger.info(`Returning ${combinedResults.length} hybrid search results`);

      // Format the final results
      return combinedResults.map(result => ({
        id: result.id,
        content: result.content,
        pageContent: result.content,
        score: result.finalScore,
        metadata: includeMetadata ? {
          ...result.metadata,
          semanticScore: result.semanticScore,
          keywordScore: result.keywordScore,
          finalScore: result.finalScore,
          sourceId: result.sourceId,
          source: result.sourceName || 'unknown'
        } : undefined
      }));
    } catch (error) {
      this.logger.error('Error performing hybrid search:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search using vector embeddings
   */
  private async performSemanticSearch(
    query: string,
    dataSourceIds: number[],
    limit: number,
    similarityThreshold: number,
    isAnalytical: boolean
  ): Promise<any[]> {
    try {
      // Generate an embedding for the query
      const embeddings = await this.openaiService.createEmbeddings([query]);
      const embedding = embeddings[0]; // Take the first (and only) embedding
      
      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to generate query embedding');
      }

      // Combine results from all data sources
      const combinedResults: any[] = [];

      // Search in each data source's Qdrant collection
      for (const sourceId of dataSourceIds) {
        try {
          // Get collection info
          const dataSource = await db('data_sources')
            .where({ id: sourceId })
            .first();
            
          if (!dataSource) {
            this.logger.warn(`Data source ${sourceId} not found`);
            continue;
          }
          
          const collectionName = dataSource.metadata?.collectionName || `collection_${sourceId}`;
          
          // Check if collection exists
          const collectionExists = await this.qdrantService.collectionExists(collectionName);
          
          if (!collectionExists) {
            this.logger.warn(`Qdrant collection ${collectionName} does not exist`);
            continue;
          }
          
          // Search in the collection
          const results = await this.qdrantService.search(
            collectionName,
            embedding,
            undefined,
            limit
          );
          
          // Filter by similarity threshold post-search if needed
          const filteredResults = similarityThreshold 
            ? results.filter(r => (r.score || 0) >= similarityThreshold) 
            : results;
          
          if (filteredResults && filteredResults.length > 0) {
            // Format Qdrant results
            const formattedResults = filteredResults.map(result => ({
              id: result.id,
              content: result.payload.content || result.payload.text,
              sourceId,
              sourceName: dataSource.name || `Source ${sourceId}`,
              semanticScore: result.score || 0,
              keywordScore: 0, // Will be populated later if found in keyword results
              metadata: {
                ...result.payload.metadata,
                similarity: result.score
              }
            }));
            
            combinedResults.push(...formattedResults);
          }
        } catch (error) {
          this.logger.error(`Error searching in data source ${sourceId}:`, error);
        }
      }

      // Fallback to PostgreSQL vector search if no Qdrant results
      if (combinedResults.length === 0) {
        this.logger.info('No Qdrant results, falling back to PostgreSQL vector search');
        
        // Format embedding for PostgreSQL
        const formattedEmbedding = `[${embedding.join(',')}]`;
        
        // Adjust limit for analytical queries
        const effectiveLimit = isAnalytical ? Math.ceil(limit * 1.5) : limit;
        
        const chunks = await db('document_chunks')
          .select(
            'document_chunks.*',
            db.raw('1 - (embedding <=> ?) as similarity', [formattedEmbedding])
          )
          .whereIn('data_source_id', dataSourceIds)
          .whereRaw('embedding IS NOT NULL')
          .andWhereRaw('1 - (embedding <=> ?) >= ?', [formattedEmbedding, similarityThreshold])
          .orderBy('similarity', 'desc')
          .limit(effectiveLimit);
        
        this.logger.info(`Found ${chunks.length} relevant chunks from PostgreSQL vector search`);
        
        if (chunks && chunks.length > 0) {
          // Get data source names
          const dataSourceMap = new Map();
          for (const sourceId of dataSourceIds) {
            const source = await db('data_sources').where({ id: sourceId }).first();
            if (source) {
              dataSourceMap.set(sourceId, source.name || `Source ${sourceId}`);
            }
          }
          
          // Format PostgreSQL results
          const formattedChunks = chunks.map((chunk: any) => ({
            id: chunk.id,
            content: chunk.content,
            sourceId: chunk.data_source_id,
            sourceName: dataSourceMap.get(chunk.data_source_id) || `Source ${chunk.data_source_id}`,
            semanticScore: chunk.similarity || 0,
            keywordScore: 0, // Will be populated later if found in keyword results
            metadata: {
              ...chunk.metadata,
              similarity: chunk.similarity
            }
          }));
          
          combinedResults.push(...formattedChunks);
        }
      }

      return combinedResults;
    } catch (error) {
      this.logger.error('Error performing semantic search:', error);
      return [];
    }
  }

  /**
   * Perform keyword-based search using PostgreSQL full-text search
   */
  private async performKeywordSearch(
    query: string,
    dataSourceIds: number[],
    limit: number
  ): Promise<any[]> {
    try {
      // Prepare search terms
      // Split the query into words and remove common stop words
      const queryTerms = query
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(term => term.length > 2) // Filter out short words
        .filter(term => !['the', 'and', 'but', 'for', 'not', 'you', 'that', 'this', 'with'].includes(term));
      
      if (queryTerms.length === 0) {
        return [];
      }
      
      // Create a tsquery expression for PostgreSQL full-text search
      const tsQuery = queryTerms.map(term => `${term}:*`).join(' | ');
      
      // Get data source names
      const dataSourceMap = new Map();
      for (const sourceId of dataSourceIds) {
        const source = await db('data_sources').where({ id: sourceId }).first();
        if (source) {
          dataSourceMap.set(sourceId, source.name || `Source ${sourceId}`);
        }
      }
      
      // Perform full-text search in PostgreSQL
      const chunks = await db('document_chunks')
        .select(
          'document_chunks.*',
          db.raw(`ts_rank(to_tsvector('english', content), to_tsquery('english', ?)) as rank`, [tsQuery])
        )
        .whereIn('data_source_id', dataSourceIds)
        .whereRaw(`to_tsvector('english', content) @@ to_tsquery('english', ?)`, [tsQuery])
        .orderBy('rank', 'desc')
        .limit(limit);
      
      this.logger.info(`Found ${chunks.length} chunks from keyword search`);
      
      // Format results
      return chunks.map((chunk: any) => ({
        id: chunk.id,
        content: chunk.content,
        sourceId: chunk.data_source_id,
        sourceName: dataSourceMap.get(chunk.data_source_id) || `Source ${chunk.data_source_id}`,
        semanticScore: 0, // Will be populated later if found in semantic results
        keywordScore: chunk.rank || 0,
        metadata: {
          ...chunk.metadata,
          keywordRank: chunk.rank
        }
      }));
    } catch (error) {
      this.logger.error('Error performing keyword search:', error);
      
      // Fallback to simpler LIKE query if full-text search fails
      try {
        this.logger.info('Falling back to LIKE-based keyword search');
        
        // Prepare search terms for LIKE query
        const searchTerms = query
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(term => term.length > 2);
        
        if (searchTerms.length === 0) {
          return [];
        }
        
        // Find chunks that contain any of the search terms
        let queryBuilder = db('document_chunks')
          .select('*')
          .whereIn('data_source_id', dataSourceIds);
        
        // Add LIKE conditions for each search term
        for (const term of searchTerms) {
          queryBuilder = queryBuilder.orWhereRaw('LOWER(content) LIKE ?', [`%${term}%`]);
        }
        
        const chunks = await queryBuilder.limit(limit);
        
        this.logger.info(`Found ${chunks.length} chunks from fallback keyword search`);
        
        // Get data source names
        const dataSourceMap = new Map();
        for (const sourceId of dataSourceIds) {
          const source = await db('data_sources').where({ id: sourceId }).first();
          if (source) {
            dataSourceMap.set(sourceId, source.name || `Source ${sourceId}`);
          }
        }
        
        // Calculate a simple score based on how many terms match
        return chunks.map((chunk: any) => {
          const content = chunk.content.toLowerCase();
          let matchCount = 0;
          
          for (const term of searchTerms) {
            if (content.includes(term)) {
              matchCount++;
            }
          }
          
          const score = matchCount / searchTerms.length;
          
          return {
            id: chunk.id,
            content: chunk.content,
            sourceId: chunk.data_source_id,
            sourceName: dataSourceMap.get(chunk.data_source_id) || `Source ${chunk.data_source_id}`,
            semanticScore: 0,
            keywordScore: score,
            metadata: {
              ...chunk.metadata,
              keywordMatches: matchCount,
              keywordRank: score
            }
          };
        });
      } catch (fallbackError) {
        this.logger.error('Error in fallback keyword search:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Combine and rerank results from semantic and keyword searches
   */
  private combineAndRerank(
    semanticResults: any[],
    keywordResults: any[],
    semanticWeight: number,
    keywordWeight: number,
    limit: number
  ): any[] {
    try {
      // Create a map of all results by ID
      const resultsMap = new Map();
      
      // Add semantic results to the map
      for (const result of semanticResults) {
        resultsMap.set(result.id, {
          ...result,
          finalScore: result.semanticScore * semanticWeight
        });
      }
      
      // Update with keyword results or add new ones
      for (const result of keywordResults) {
        if (resultsMap.has(result.id)) {
          // Result exists in semantic results, update scores
          const existingResult = resultsMap.get(result.id);
          existingResult.keywordScore = result.keywordScore;
          existingResult.finalScore = (existingResult.semanticScore * semanticWeight) + 
                                     (result.keywordScore * keywordWeight);
        } else {
          // New result from keyword search
          resultsMap.set(result.id, {
            ...result,
            finalScore: result.keywordScore * keywordWeight
          });
        }
      }
      
      // Convert map to array and sort by final score
      const combinedResults = Array.from(resultsMap.values())
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, limit);
      
      return combinedResults;
    } catch (error) {
      this.logger.error('Error combining and reranking results:', error);
      
      // If reranking fails, just return semantic results as fallback
      return semanticResults.slice(0, limit);
    }
  }
  
  /**
   * Perform a hybrid search specifically optimized for multi-turn conversations
   * Takes into account previous conversation turns and entities
   */
  async searchWithConversationContext(
    query: string,
    conversationHistory: any[],
    dataSourceIds: string[] | number[],
    options: {
      limit?: number;
      semanticWeight?: number;
      keywordWeight?: number;
      conversationContextWeight?: number;
      entityBoost?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<any[]> {
    const {
      limit = 10,
      semanticWeight = 0.6,
      keywordWeight = 0.2,
      conversationContextWeight = 0.2,
      entityBoost = 1.2,
      similarityThreshold = 0.3
    } = options;
    
    try {
      // Extract entities mentioned in the conversation
      const entities = this.extractEntitiesFromConversation(conversationHistory);
      this.logger.info(`Extracted ${entities.length} entities from conversation`);
      
      // Generate an enhanced query that incorporates context
      const enhancedQuery = this.enhanceQueryWithContext(query, conversationHistory);
      
      // Perform the basic hybrid search
      const results = await this.search(
        enhancedQuery,
        dataSourceIds,
        {
          limit: Math.ceil(limit * 1.5), // Get more results than needed for reranking
          semanticWeight,
          keywordWeight,
          similarityThreshold
        }
      );
      
      // Rerank results based on conversation context
      return this.reankBasedOnConversationContext(
        results,
        conversationHistory,
        entities,
        conversationContextWeight,
        entityBoost,
        limit
      );
    } catch (error) {
      this.logger.error('Error in searchWithConversationContext:', error);
      
      // Fallback to regular hybrid search
      return this.search(query, dataSourceIds, { limit });
    }
  }
  
  /**
   * Extract entities from conversation history
   */
  private extractEntitiesFromConversation(conversationHistory: any[]): string[] {
    if (!conversationHistory || conversationHistory.length === 0) {
      return [];
    }
    
    const entities: string[] = [];
    
    for (const message of conversationHistory) {
      const content = typeof message.content === 'string' ? message.content : '';
      
      // Look for proper nouns (capitalized words)
      const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
      const matches = content.matchAll(properNounPattern);
      
      for (const match of Array.from(matches)) {
        if (match[1] && match[1].length > 2) {
          entities.push(match[1]);
        }
      }
    }
    
    // Remove duplicates and filter out common words
    const commonWords = [
      'I', 'You', 'We', 'They', 'He', 'She', 'It', 'This', 'That', 'These', 'Those',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return [...new Set(entities)]
      .filter(entity => !commonWords.includes(entity));
  }
  
  /**
   * Enhance a query with context from conversation history
   */
  private enhanceQueryWithContext(query: string, conversationHistory: any[]): string {
    // For short queries, try to add context
    if (query.length < 20 && conversationHistory.length > 0) {
      // Get the last few messages
      const recentMessages = conversationHistory.slice(-3);
      
      // Extract key phrases or entities
      const entities = this.extractEntitiesFromConversation(recentMessages);
      
      if (entities.length > 0) {
        // Add top 2 entities to the query for context
        const topEntities = entities.slice(0, 2);
        return `${query} (regarding ${topEntities.join(' and ')})`;
      }
    }
    
    // Check for pronouns that might need resolution
    const pronounPattern = /\b(it|they|them|this|that|these|those)\b/i;
    if (pronounPattern.test(query) && conversationHistory.length > 0) {
      // Get the last message
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';
      
      // Extract entities from the last message
      const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
      const matches = Array.from(content.matchAll(properNounPattern));
      
      if (matches.length > 0) {
        // Use the last mentioned entity to resolve pronouns
        const entity = matches[matches.length - 1][1];
        return query.replace(pronounPattern, `$1 (${entity})`);
      }
    }
    
    return query;
  }
  
  /**
   * Rerank search results based on conversation context
   */
  private reankBasedOnConversationContext(
    results: any[],
    conversationHistory: any[],
    entities: string[],
    contextWeight: number,
    entityBoost: number,
    limit: number
  ): any[] {
    if (results.length === 0) {
      return [];
    }
    
    // Combine all conversation content for matching
    const conversationText = conversationHistory
      .map(msg => typeof msg.content === 'string' ? msg.content : '')
      .join(' ');
    
    // Rerank based on conversation context
    const rerankedResults = results.map(result => {
      const content = result.content || '';
      let contextScore = 0;
      
      // Calculate context relevance score based on entity mentions
      if (entities.length > 0) {
        for (const entity of entities) {
          if (content.includes(entity)) {
            // Boost score for each entity mention
            contextScore += 0.1 * entityBoost;
          }
        }
      }
      
      // Check for content similarity with recent conversation
      const wordOverlapScore = this.calculateWordOverlap(content, conversationText);
      contextScore += wordOverlapScore * 0.5;
      
      // Calculate final score with context weighting
      const finalScore = (
        (result.score || 0) * (1 - contextWeight) + 
        contextScore * contextWeight
      );
      
      return {
        ...result,
        contextScore,
        finalScore
      };
    });
    
    // Sort by final score and limit results
    return rerankedResults
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }
  
  /**
   * Calculate word overlap between two texts
   */
  private calculateWordOverlap(text1: string, text2: string): number {
    // Get unique words from both texts
    const words1 = new Set(
      text1.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );
    
    const words2 = new Set(
      text2.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );
    
    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }
    
    // Count overlapping words
    let overlapCount = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        overlapCount++;
      }
    }
    
    // Calculate Jaccard similarity
    const unionSize = words1.size + words2.size - overlapCount;
    return overlapCount / unionSize;
  }
} 