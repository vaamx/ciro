import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantSearchService } from '../vector/search.service';
import { RerankingService } from './reranking.service';
import { EmbeddingService } from '../llm';
import { GenerationService } from './generation.service';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { RerankableDocument } from './reranking.service';
import { SearchResultItem, GenerationOptions } from '../vector/vector.interfaces';

export interface DirectRAGQueryResponse {
  answer: string;
  sourceDocuments?: RerankableDocument[];
  strategyTrace?: string[];
}

@Injectable()
export class DirectRAGService {
  private readonly logger = createServiceLogger(DirectRAGService.name);
  private readonly generationModel: string;
  private readonly maxContextTokens: number;
  private readonly defaultCollectionName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly searchService: QdrantSearchService,
    private readonly rerankingService: RerankingService,
    private readonly embeddingService: EmbeddingService,
    private readonly generationService: GenerationService,
  ) {
    this.generationModel = this.configService.get('GENERATION_LLM_MODEL', 'gpt-4o-mini') ?? 'gpt-4o-mini';
    this.maxContextTokens = parseInt(this.configService.get('MAX_CONTEXT_TOKENS', '4096') ?? '4096');
    this.defaultCollectionName = this.configService.get('DEFAULT_QDRANT_COLLECTION_NAME', 'default_collection') ?? 'default_collection';
    this.logger.info(
      `DirectRAGService initialized with LLM abstraction layer. Generation Model: ${this.generationModel}, Max Context Tokens: ${this.maxContextTokens}, Default Collection: ${this.defaultCollectionName}`,
    );
  }

  private static normalizeCollectionName(name: string): string {
    return name.replace(/\\s+/g, '_').toLowerCase();
  }

  async answerQuery(
    query: string,
    collectionNameOverride?: string,
    topK: number = 5,
    useReranker: boolean = true,
  ): Promise<DirectRAGQueryResponse> {
    const targetCollection = DirectRAGService.normalizeCollectionName(collectionNameOverride || this.defaultCollectionName);
    this.logger.debug(
      `Received query for Direct RAG on collection "${targetCollection}": "${query}", topK: ${topK}, useReranker: ${useReranker}`,
    );

    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingService.createEmbedding(query);
      this.logger.debug(`Generated query embedding with dimension: ${queryEmbedding.length}`);
    } catch (error) {
      this.logger.error('Error generating query embedding:', error);
      return { answer: 'Error: Could not process query due to embedding failure.', sourceDocuments: [] };
    }

    let searchResults: SearchResultItem[];
    try {
      searchResults = await this.searchService.search(targetCollection, queryEmbedding, undefined, topK);
    } catch (error) {
      this.logger.error(`Error searching collection ${targetCollection}:`, error);
      return { answer: 'Error: Could not retrieve documents from knowledge base.', sourceDocuments: [] };
    }
    
    const initialDocs: RerankableDocument[] = searchResults.map(item => {
      const text = item.payload?.text || item.payload?.content || item.content || '';
      if (!text) {
        this.logger.warn(`Search result item with id ${item.id} has no text content. Skipping.`);
      }
      return {
        id: String(item.id),
        text: text,
        score: item.score,
        originalPayload: item.payload, 
      };
    }).filter(doc => doc.text);

    if (initialDocs.length === 0) {
      this.logger.info('No documents found after initial search or mapping.');
    }

    let finalDocs: RerankableDocument[] = initialDocs;

    if (useReranker && initialDocs.length > 0) {
      this.logger.debug(`Reranking ${initialDocs.length} documents for collection ${targetCollection}.`);
      try {
        finalDocs = await this.rerankingService.rerankDocuments(query, initialDocs, topK);
      } catch (error) {
        this.logger.error('Error during reranking:', error);
      }
    } else {
      this.logger.debug(`Skipping reranking for collection ${targetCollection}.`);
    }
    
    const contextForLLM = this.buildContextString(finalDocs);
    this.logger.debug(`Context prepared for ${targetCollection} with ${finalDocs.length} documents. Character length: ${contextForLLM.length}`);

    const prompt = this.constructPrompt(query, contextForLLM);
    this.logger.debug(`Constructed prompt for LLM (collection ${targetCollection}): ${prompt.substring(0, 500)}...`);

    let answer: string;
    try {
      const generationOptions: GenerationOptions = {
        model: this.generationModel,
      };
      answer = await this.generationService.generateFromPreformattedPrompt(prompt, generationOptions);
      this.logger.info(`Received answer from GenerationService for collection ${targetCollection}. Length: ${answer.length}`);
    } catch (error) {
      this.logger.error('Error calling GenerationService from DirectRAGService:', error);
      answer = 'Error: Could not generate an answer at this time.';
    }

    return {
      answer,
      sourceDocuments: finalDocs.map(doc => ({ ...doc })),
    };
  }

  private buildContextString(documents: RerankableDocument[]): string {
    let context = '';
    let currentTokenCount = 0;
    const estimatedCharsPerToken = 4; // A common rough estimate

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const docText = `Document ${i + 1} (ID: ${doc.id}):\n${doc.text}\n\n---\n\n`;
      const docTokens = Math.ceil(docText.length / estimatedCharsPerToken);

      if (currentTokenCount + docTokens > this.maxContextTokens) {
        this.logger.warn(
          `Context token limit (${this.maxContextTokens}) reached. Including ${i} documents out of ${documents.length}.`,
        );
        break;
      }
      context += docText;
      currentTokenCount += docTokens;
    }
    // Remove trailing '---\n\n' if it exists and context is not empty
    if (context.endsWith('\n\n---\n\n')) {
      context = context.substring(0, context.length - '\n\n---\n\n'.length);
    }
    return context;
  }
  
  private constructPrompt(query: string, context: string): string {
    return `Answer the following query based *only* on the provided documents. If the answer is not found in the documents, state that clearly. Do not use any external knowledge.

Query: ${query}

Documents:
${context}

Answer:`;
  }
} 