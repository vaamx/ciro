import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantSearchService } from './search.service';
import { QdrantClientService } from './qdrant-client.service';
import { EmbeddingService } from '../ai/embedding.service';
import { SearchResultItem } from '../vector/vector.interfaces';
import { 
  normalizeCollectionName, 
  combineFilters, 
  extractKeywords,
  createKeywordFilter,
  calculateKeywordMatchScore
} from './utils';

interface HybridSearchOptions {
  semanticWeight?: number;        // Weight for semantic search (0-1)
  keywordWeight?: number;         // Weight for keyword search (0-1)
  similarityThreshold?: number;   // Minimum similarity score threshold
  includeMetadata?: boolean;      // Whether to include metadata in results
  limit?: number;                 // Maximum number of results to return
  offset?: number;                // Offset for pagination
  filter?: Record<string, any>;   // Filter to apply to search
  reRankResults?: boolean;        // Whether to rerank results after combining
  keywordFields?: string[];       // Fields to search for keywords
}

type SearchResult = SearchResultItem & {
  searchType?: 'semantic' | 'keyword' | 'hybrid'; // Source of the result
};

/**
 * Advanced search service that combines semantic (vector) search with 
 * keyword-based search for more comprehensive results
 */
@Injectable()
export class HybridSearchService extends QdrantSearchService {
  // Create a service-specific logger
  protected override readonly logger = createServiceLogger('HybridSearchService');

  constructor(
    qdrantClientService: QdrantClientService,
    embeddingService: EmbeddingService
  ) {
    super(qdrantClientService, embeddingService);
    this.logger.info('HybridSearchService initialized');
  }

  /**
   * Perform a hybrid search using both semantic (vector) and keyword-based approaches
   * 
   * @param collectionName The Qdrant collection to search
   * @param query The search query
   * @param options Search options including weights for different search types
   * @returns Combined and reranked search results
   */
  async advancedHybridSearch(
    collectionName: string,
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      semanticWeight = 0.7,
      keywordWeight = 0.3,
      similarityThreshold = 0.3,
      limit = 50,
      offset = 0,
      filter = {},
      reRankResults = true,
      keywordFields = ['text', 'content', 'title'],
      includeMetadata = true
    } = options;

    this.logger.info(`Performing hybrid search on collection ${collectionName} for query: "${query.substring(0, 50)}..."`);
    this.logger.debug(`Hybrid search params: semantic=${semanticWeight}, keyword=${keywordWeight}, threshold=${similarityThreshold}`);

    // Normalize weights to ensure they sum to 1
    const totalWeight = semanticWeight + keywordWeight;
    const normalizedSemanticWeight = semanticWeight / totalWeight;
    const normalizedKeywordWeight = keywordWeight / totalWeight;

    // Step 1: Perform semantic vector search
    this.logger.debug(`Starting semantic vector search with weight ${normalizedSemanticWeight}`);
    const semanticResults = await this.performSemanticSearch(
      collectionName,
      query,
      {
        filter,
        limit: limit * 2, // Get more results for reranking
        offset,
        similarityThreshold
      }
    );

    // Step 2: Perform keyword search
    this.logger.debug(`Starting keyword search with weight ${normalizedKeywordWeight}`);
    const keywordResults = await this.performKeywordSearch(
      collectionName,
      query,
      {
        filter,
        limit: limit * 2, // Get more results for reranking
        offset,
        fields: keywordFields
      }
    );

    // Step 3: Combine and normalize results
    const combinedResults = this.combineSearchResults(
      semanticResults,
      keywordResults,
      {
        semanticWeight: normalizedSemanticWeight,
        keywordWeight: normalizedKeywordWeight,
        deduplicateById: true
      }
    );

    // Step 4: Rerank if requested
    const finalResults = reRankResults
      ? await this.reRankResults(query, combinedResults)
      : combinedResults;

    // Step 5: Apply threshold and limit
    const thresholdedResults = finalResults
      .filter(result => result.score >= similarityThreshold)
      .slice(0, limit);

    this.logger.info(`Hybrid search complete. Found ${thresholdedResults.length} results`);
    return thresholdedResults;
  }

  /**
   * Override the parent class hybridSearch method to maintain compatibility
   * This serves as an adapter to our more advanced hybrid search
   */
  override async hybridSearch(
    collectionName: string,
    vector: number[],
    keywords: string,
    keywordField: string = 'text',
    limit: number = 10
  ): Promise<SearchResultItem[]> {
    // If we have keywords, use the parent implementation
    if (keywords && keywords.trim().length > 0) {
      return super.hybridSearch(collectionName, vector, keywords, keywordField, limit);
    }
    
    // If we don't have keywords but have a vector, convert to our advanced search
    // First, reverse engineer the query from vector (simplified)
    try {
      const query = "query"; // Placeholder, in real implementation we'd use reverse embedding
      
      // Call our advanced hybrid search
      return this.advancedHybridSearch(collectionName, query, { limit });
    } catch (error) {
      // Fallback to parent implementation
      return super.hybridSearch(collectionName, vector, keywords, keywordField, limit);
    }
  }

  /**
   * Perform a semantic vector search using embeddings
   */
  private async performSemanticSearch(
    collectionName: string,
    query: string,
    options: {
      filter?: Record<string, any>;
      limit?: number;
      offset?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<SearchResult[]> {
    try {
      // Create embeddings using the injected EmbeddingService
      const queryEmbedding = await this.embeddingService.createEmbedding(query);
      
      // Use the parent class search method
      const results = await this.search(
        collectionName,
        queryEmbedding,
        options.filter,
        options.limit,
        options.similarityThreshold,
        options.offset
      );

      // Mark results as coming from semantic search
      return results.map(result => ({
        ...result,
        searchType: 'semantic' as const
      }));
    } catch (error) {
      this.logger.error(`Error in semantic search: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Perform a keyword-based search using text matching
   */
  private async performKeywordSearch(
    collectionName: string,
    query: string,
    options: {
      filter?: Record<string, any>;
      limit?: number;
      offset?: number;
      fields?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    try {
      const {
        filter = {},
        limit = 50,
        offset = 0,
        fields = ['text', 'content', 'title']
      } = options;

      // Extract keywords using the utility function
      const keywords = extractKeywords(query);
      if (keywords.length === 0) {
        return [];
      }

      // Create keyword filter using the utility function
      const keywordFilter = createKeywordFilter(keywords, fields);
      
      // Combine filters using the utility function
      const combinedFilter = combineFilters(filter, keywordFilter);

      // Use dummy vector for search
      const dummyVector = new Array(1536).fill(0);
      const results = await this.search(
        collectionName,
        dummyVector,
        combinedFilter,
        limit,
        0,  // No similarity threshold needed for keyword search
        offset
      );

      // Score the results based on keyword matching
      const scoredResults = results.map(result => {
        // Get the text content to score
        const content = result.payload?.text || result.payload?.content || '';
        
        // Calculate score using the utility function
        const keywordScore = calculateKeywordMatchScore(content, keywords);
        
        return {
          ...result,
          score: keywordScore,
          searchType: 'keyword' as const
        };
      })
      .filter(result => result.score > 0) // Only return results with matches
      .sort((a, b) => b.score - a.score); // Sort by score descending

      return scoredResults;
    } catch (error) {
      this.logger.error(`Error in keyword search: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Combine results from semantic and keyword searches
   */
  private combineSearchResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    options: {
      semanticWeight: number;
      keywordWeight: number;
      deduplicateById: boolean;
    }
  ): SearchResult[] {
    const { semanticWeight, keywordWeight, deduplicateById } = options;

    // Create a map of results by ID for deduplication
    const resultMap = new Map<string, SearchResult>();

    // Process semantic results
    for (const result of semanticResults) {
      const id = String(result.id);
      resultMap.set(id, {
        ...result,
        score: result.score * semanticWeight,
        searchType: 'hybrid'
      });
    }

    // Process keyword results, combining scores for duplicates
    for (const result of keywordResults) {
      const id = String(result.id);
      
      if (deduplicateById && resultMap.has(id)) {
        // Combine scores for existing result
        const existingResult = resultMap.get(id)!;
        resultMap.set(id, {
          ...existingResult,
          score: existingResult.score + (result.score * keywordWeight),
          searchType: 'hybrid'
        });
      } else {
        // Add new result
        resultMap.set(id, {
          ...result,
          score: result.score * keywordWeight,
          searchType: 'hybrid'
        });
      }
    }

    // Convert map to array and sort by score
    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Rerank results using cross-encoder or other techniques
   */
  private async reRankResults(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // In a full implementation, this would use a cross-encoder model or 
    // other reranking technique to improve ordering.
    // For this implementation, we'll use a simpler approach that considers
    // both the existing score and additional factors like:
    // - Exact match bonuses
    // - Recency bias
    // - Length/completeness bonuses

    const rerankedResults = results.map(result => {
      let scoreMultiplier = 1.0;
      
      // 1. Apply exact match bonus
      const content = result.payload?.text || result.payload?.content || '';
      if (typeof content === 'string' && content.toLowerCase().includes(query.toLowerCase())) {
        scoreMultiplier *= 1.2; // 20% bonus for exact match
      }
      
      // 2. Apply length/completeness bonus for longer, more detailed content
      if (typeof content === 'string') {
        const wordCount = content.split(/\s+/).length;
        // Bonus for content with substantial information (diminishing returns)
        scoreMultiplier *= Math.min(1.0 + (wordCount / 1000), 1.3);
      }

      // 3. Apply recency bias if timestamp exists
      const timestamp = result.payload?.timestamp || result.payload?.created_at;
      if (timestamp) {
        try {
          const date = new Date(timestamp);
          const now = new Date();
          const ageInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          // Apply recency bonus that decays with age (max 15% for very recent content)
          scoreMultiplier *= Math.max(1.0, 1.15 - (ageInDays / 100));
        } catch (error) {
          // Ignore timestamp parsing errors
        }
      }

      return {
        ...result,
        score: result.score * scoreMultiplier
      };
    });

    // Re-sort after reranking
    return rerankedResults.sort((a, b) => b.score - a.score);
  }

  /**
   * Comprehensive hybrid search across multiple data sources
   */
  async hybridSearchComprehensive(
    query: string,
    dataSourceIds: string[] | number[],
    options: HybridSearchOptions = {}
  ): Promise<SearchResult[]> {
    const normalizedDataSourceIds = dataSourceIds.map(id => String(id));
    
    this.logger.info(`Performing comprehensive hybrid search across ${normalizedDataSourceIds.length} data sources`);
    
    // Get all collection names
    const collectionsMap: Record<string, string> = {};
    for (const dataSourceId of normalizedDataSourceIds) {
      const collectionName = this.getCollectionNameForDataSource(dataSourceId);
      collectionsMap[dataSourceId] = collectionName;
    }
    
    // Perform hybrid search on each collection in parallel
    const searchPromises = Object.entries(collectionsMap).map(async ([dataSourceId, collectionName]) => {
      try {
        // Use our advanced hybrid search method
        const results = await this.advancedHybridSearch(collectionName, query, options);
        
        // Add data source info to results
        return results.map(result => ({
          ...result,
          payload: {
            ...result.payload,
            dataSourceId,
            collectionName
          }
        }));
      } catch (error) {
        this.logger.error(`Error searching collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    });
    
    // Wait for all searches to complete
    const resultsArrays = await Promise.all(searchPromises);
    
    // Combine and sort all results
    const combinedResults = resultsArrays
      .flat()
      .sort((a, b) => b.score - a.score);
    
    // Apply final limit
    const limitedResults = combinedResults.slice(0, options.limit || 50);
    
    this.logger.info(`Comprehensive hybrid search complete. Found ${limitedResults.length} results from ${resultsArrays.filter(arr => arr.length > 0).length} sources`);
    
    return limitedResults;
  }
} 