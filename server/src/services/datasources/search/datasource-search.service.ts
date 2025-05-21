import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QdrantClientService, QdrantSearchService } from '../../vector'; // Adjusted path
import type { SearchResultItem } from '../../vector/vector.interfaces'; // Adjusted path
import { createServiceLogger } from '../../../common/utils/logger-factory'; // Adjusted path
import { QueryAnalysisService } from '../../analysis/query-analysis.service'; // Adjusted path

// Define needed interfaces locally for now
interface SearchResultWithMetadata {
  id: string;
  data_source_id: number;
  content: string;
  metadata: {
    datasource_id: number;
    collection_name: string;
    similarity: number;
    [key: string]: any;
  };
  similarity: number;
}

@Injectable()
export class DataSourceSearchService {
  private logger = createServiceLogger('DataSourceSearchService');

  constructor(
    private qdrantClientService: QdrantClientService,
    private qdrantSearchService: QdrantSearchService,
    private queryAnalysisService: QueryAnalysisService,
  ) {
    this.logger.info('DataSourceSearchService initialized');
  }

  /**
   * Search document chunks by embedding similarity
   */
  async searchDocumentChunks(
    embedding: number[],
    dataSources: number[],
    limit: number = 100,
    similarityThreshold: number = 0.3,
    isAnalytical: boolean = false,
    isVCFundCountQuery: boolean = false, // Keep param, might be used for logic later
    originalQuery: string = '',
    needsExhaustiveResults: boolean = false,
  ): Promise<SearchResultWithMetadata[]> {
    try {
      const isEntityLookup = this.queryAnalysisService.isEntityLookupQuery(originalQuery);

      if (needsExhaustiveResults || isEntityLookup) {
        isAnalytical = true; // Reuse the logic from original service
        this.logger.info(`Forcing analytical processing for exhaustive results or entity lookup: "${originalQuery}"`);
      }

      this.logger.info(`Searching document chunks with embedding`, {
        dataSources,
        limit,
        threshold: similarityThreshold,
        isAnalytical,
        originalQuery: originalQuery.substring(0, 50) + (originalQuery.length > 50 ? '...' : ''),
        isEntityLookup,
        needsExhaustiveResults,
      });

      let effectiveLimit = limit;
      let effectiveThreshold = similarityThreshold;

      if (isAnalytical || isVCFundCountQuery || isEntityLookup || needsExhaustiveResults) { // Keep logic
        effectiveLimit = 500;
        effectiveThreshold = 0.2;
      }

      const searchPromises = dataSources.map(async (datasourceId) => {
        const collectionName = `datasource_${datasourceId}`;
        this.logger.info(`Searching collection ${collectionName}`);

        try {
          const searchResults = await this.qdrantSearchService.search(
            collectionName,
            embedding,
            undefined, // No specific filter mentioned here in original
            effectiveLimit,
            effectiveThreshold,
          );

          if (!searchResults || !Array.isArray(searchResults)) {
            this.logger.warn(`No results found for collection ${collectionName}`);
            return [];
          }

          this.logger.info(`Qdrant search results for ${collectionName}:`, {
            found: searchResults.length,
            firstResult: searchResults.length > 0 ? { id: searchResults[0].id, score: searchResults[0].score } : null,
          });

          return searchResults.map((result: SearchResultItem) => {
             const payload = result.payload || {};
             let content = '';
             if (typeof payload.text === 'string') content = payload.text;
             else if (typeof payload.content === 'string') content = payload.content;
             else if (typeof payload.page_content === 'string') content = payload.page_content;

             const baseMetadata = typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {};

             return {
               id: result.id,
               data_source_id: datasourceId,
               content,
               metadata: {
                 ...baseMetadata,
                 datasource_id: datasourceId,
                 collection_name: collectionName,
                 similarity: result.score,
               },
               similarity: result.score,
             } as SearchResultWithMetadata;
           });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Error searching collection ${collectionName}:`, errorMessage);
          // Don't throw here, let Promise.all handle failed searches if needed, return empty array
          return [];
        }
      });

      const results = await Promise.all(searchPromises);

      const flattenedResults = results
        .flat()
        .filter((result): result is SearchResultWithMetadata => result.similarity !== undefined && result.similarity >= effectiveThreshold)
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, effectiveLimit); // Apply final limit

      this.logger.info(`Returning ${flattenedResults.length} results from embedding search.`);
      return flattenedResults;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error in searchDocumentChunks:', errorMessage);
      throw new InternalServerErrorException(`Failed to search document chunks: ${errorMessage}`);
    }
  }

  /**
   * Search document chunks by text content matching
   */
  async textSearchDocumentChunks(
    text: string,
    collections: string[], // Expects collection names like 'datasource_123'
    limit: number = 50,
    documentId?: string, // Keep param, might be used later
  ) {
    try {
      const isAnalyticalQuery = this.queryAnalysisService.isAnalyticalQuery(text);
      this.logger.info(`Text searching for "${text}"`, {
        collections,
        limit,
        isAnalyticalQuery,
      });

      const textLower = text.toLowerCase();
      let combinedResults: any[] = [];

      for (const collectionName of collections) {
        try {
          this.logger.info(`Text searching Qdrant collection: ${collectionName}`);

          const collectionExists = await this.qdrantSearchService.collectionExists(collectionName);
          if (!collectionExists) {
            this.logger.warn(`Skipping missing Qdrant collection for text search: ${collectionName}`);
            continue;
          }

          // Simplified Qdrant filter assuming 'text' field holds the main content
           const filter = {
             must: [ // Using 'must' to ensure text match
               { key: 'text', match: { text: textLower } }
             ]
             // Removed 'should' as it might be too broad; requires text field.
             // If content is split across fields, adjust filter logic.
           };

          const scrollLimit = isAnalyticalQuery ? 10000 : Math.max(limit * 5, 500);
          this.logger.info(`Scrolling collection ${collectionName} with text filter and limit ${scrollLimit}`);
          const client = this.qdrantClientService.getClient();
          if (client) {
            const response = await client.scroll(collectionName, {
              filter: filter,
              limit: scrollLimit,
              with_payload: true,
            });

            const points = response.points;
            this.logger.info(`Retrieved ${points.length} pre-filtered points from collection ${collectionName}.`);

            const formattedMatches = points.map((match: any) => {
              const id = typeof match.id === 'string' ? match.id : String(match.id);
              const metadata = match.payload?.metadata as Record<string, any> || {};
              const content = match.payload?.text || ""; // Prioritize 'text' based on filter

              return {
                id,
                content: content,
                pageContent: content, // Use same content for consistency
                text: content, // Use same content
                metadata: {
                  ...metadata,
                  similarity: 1.0, // Explicit text match = max similarity
                  source: metadata.source || 'unknown',
                  sourceId: metadata.sourceId || collectionName,
                  sourceType: metadata.sourceType || 'document',
                  timestamp: metadata.timestamp || new Date().toISOString(),
                },
              };
            });

            combinedResults = [...combinedResults, ...formattedMatches];
          } else {
            this.logger.error(`Qdrant client is not available. Cannot scroll collection ${collectionName}.`);
            // Continue to next collection on error, or handle as appropriate
          }
        } catch (error) {
          this.logger.error(`Error searching collection ${collectionName} for text:`, error);
          // Continue to next collection on error
        }
      }

      // Simple sort (already filtered by Qdrant, just apply limit if needed)
      let finalResults = combinedResults;
      if (!isAnalyticalQuery) {
        finalResults = combinedResults.slice(0, limit);
      }

      this.logger.info(`Returning ${finalResults.length} results from text search${isAnalyticalQuery ? ' (analytical query - no limit applied)' : ''}`);
      return finalResults;

    } catch (error) {
      this.logger.error('Error in textSearchDocumentChunks:', error);
      throw new InternalServerErrorException(`Failed to perform text search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 