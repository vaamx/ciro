import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServiceLogger } from '../../common/utils/logger-factory';
// We'll likely need a way to make HTTP requests, e.g., axios or built-in fetch
// For now, let's assume a basic fetch-like capability will be used or added later.

export interface RerankableDocument {
  id: string; // Or any unique identifier for the document
  text: string;
  // Allow other properties that might be part of the document
  [key: string]: any;
}

export interface RerankedDocument extends RerankableDocument {
  score: number;
}

// Define an interface for the expected Cohere API rerank response structure
interface CohereRerankResultItem {
  index: number;
  relevance_score: number;
}

interface CohereRerankResponse {
  results: CohereRerankResultItem[];
  // Cohere might also include a meta field, but results is primary
  meta?: { api_version?: { version?: string } };
}

@Injectable()
export class RerankingService {
  private readonly logger = createServiceLogger(RerankingService.name);
  private readonly cohereApiKey: string | undefined;
  private readonly cohereRerankModel: string;
  private readonly cohereApiUrl = 'https://api.cohere.ai/v1/rerank'; // Standard Cohere Rerank API URL

  constructor(private readonly configService: ConfigService) {
    this.cohereApiKey = this.configService.get('COHERE_API_KEY');
    this.cohereRerankModel = this.configService.get('COHERE_RERANK_MODEL', 'rerank-english-v3.0') ?? 'rerank-english-v3.0';

    if (!this.cohereApiKey) {
      this.logger.warn('COHERE_API_KEY is not set. RerankingService will not be able to function.');
    }
    this.logger.info(`RerankingService initialized. Model: ${this.cohereRerankModel}`);
  }

  /**
   * Reranks a list of documents based on their relevance to a given query using Cohere's Rerank API.
   * @param query The search query.
   * @param documents An array of documents to rerank. Each document should have at least a 'text' property.
   * @param topN The number of top documents to return. Defaults to Cohere's default if not specified.
   * @returns A promise that resolves to an array of reranked documents, including their scores.
   */
  async rerankDocuments(
    query: string,
    documents: RerankableDocument[],
    topN?: number,
  ): Promise<RerankedDocument[]> {
    if (!this.cohereApiKey) {
      this.logger.error('Cohere API key is not configured. Cannot perform reranking.');
      // Return original documents with a score indicating an error or unranked status
      return documents.map(doc => ({ ...doc, score: -1 })); 
    }

    if (!documents || documents.length === 0) {
      this.logger.info('No documents provided for reranking.');
      return [];
    }

    const cohereDocs = documents.map(d => ({ text: d.text }));

    try {
      this.logger.debug(`Reranking ${documents.length} documents for query: "${query}" using model ${this.cohereRerankModel}`);
      
      const requestBody: any = {
        model: this.cohereRerankModel,
        query: query,
        documents: cohereDocs,
        return_documents: false, // We only need scores and indices to map back
      };

      if (topN !== undefined) {
        requestBody.top_n = topN;
      }
      
      const response = await fetch(this.cohereApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cohereApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json', // Good practice to include Accept header
          'Request-Source': 'unspecified:nest-js-app', // As per Cohere docs
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Cohere API error: ${response.status} ${response.statusText} - ${errorBody}`);
        throw new Error(`Cohere API request failed: ${response.statusText}`);
      }

      // Type the cohereResult with an explicit type assertion
      const cohereResult = (await response.json()) as CohereRerankResponse;
      
      if (!cohereResult || !cohereResult.results) {
        this.logger.error('Cohere API response missing results field.', { response: cohereResult });
        throw new Error('Invalid response structure from Cohere API.');
      }

      const rerankedResults: RerankedDocument[] = cohereResult.results.map((result: CohereRerankResultItem) => {
        const originalDoc = documents[result.index];
        if (!originalDoc) {
          this.logger.warn(`Original document not found at index ${result.index}. Skipping.`);
          return null; // Will be filtered out later
        }
        return {
          ...originalDoc,
          score: result.relevance_score,
        };
      }).filter((doc: RerankedDocument | null): doc is RerankedDocument => doc !== null); // Type guard for filter

      this.logger.info(`Successfully reranked and mapped ${rerankedResults.length} documents.`);
      return rerankedResults;

    } catch (error) {
      this.logger.error('Error during reranking process.', { error: error instanceof Error ? error.message : String(error) });
      // Fallback or rethrow, for now, return original documents marked with error score
      return documents.map(doc => ({ ...doc, score: -1 }));
    }
  }
} 