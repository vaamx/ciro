import { Injectable, Logger, Optional } from '@nestjs/common';
import { QueryAnalyzerService } from './query-analyzer.service';
import { RetrievalService } from './retrieval.service';
import { GenerationService } from './generation.service';
import { RagQueryResult, RagResponseMetadata, Document } from '../vector/vector.interfaces';
import { QdrantSearchService } from '../vector/search.service';
import { HybridSearchService } from '../vector/hybrid-search.service';
import { EnhancedMetadataService } from '../shared/metadata/enhanced-metadata.service';
import { OpenAIService } from '../ai/openai.service';
import { EnhancedRetrievalService } from './enhanced-retrieval.service';

// Define DataSourceType locally if the module cannot be found
export type DataSourceType = 
  | 'pdf' 
  | 'docx' 
  | 'excel' 
  | 'csv' 
  | 'snowflake' 
  | '***REMOVED***ql' 
  | 'mysql' 
  | 'file' 
  | 'unknown';

/**
 * Service that integrates all RAG components into a complete pipeline.
 * This is the main entry point for the RAG system.
 */
@Injectable()
export class RagIntegrationService {
  private readonly logger = new Logger(RagIntegrationService.name);
  
  private readonly queryAnalyzer: QueryAnalyzerService;
  private readonly openAIService?: OpenAIService;

  constructor(
    queryAnalyzerService: QueryAnalyzerService,
    private readonly retrievalService: RetrievalService,
    private readonly generationService: GenerationService,
    @Optional() private readonly qdrantSearchService?: QdrantSearchService,
    @Optional() private readonly hybridSearchService?: HybridSearchService,
    @Optional() private readonly enhancedMetadataService?: EnhancedMetadataService,
    @Optional() private readonly enhancedRetrievalService?: EnhancedRetrievalService,
  ) {
    this.logger.log(`${RagIntegrationService.name} initialized (DI pending)`);
    this.queryAnalyzer = queryAnalyzerService;
    
    if (!this.enhancedMetadataService) {
      this.logger.warn('EnhancedMetadataService is not available - enhanced metadata features will be limited');
    }
    
    if (!this.qdrantSearchService) {
      this.logger.warn('QdrantSearchService is not available in RagIntegrationService - vector search functionality will be limited');
    }
    
    if (!this.hybridSearchService) {
      this.logger.warn('HybridSearchService is not available in RagIntegrationService - hybrid search functionality will be limited');
    }
    
    if (!this.enhancedRetrievalService) {
      this.logger.warn('EnhancedRetrievalService is not available in RagIntegrationService - enhanced retrieval will be limited');
    }
  }

  /**
   * Process a RAG query to generate a response
   * @param query The user query
   * @param dataSourceIds Data source IDs to query
   * @param options Additional options
   * @returns The response with metadata
   */
  async processQuery(
    query: string,
    dataSourceIds: string[] | number[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      useHybridSearch?: boolean;
      semanticWeight?: number;
      keywordWeight?: number;
      includeMetadata?: boolean;
      similarityThreshold?: number;
      enhanceResults?: boolean;
    } = {}
  ): Promise<RagQueryResult> {
    const startTime = Date.now();
    this.logger.log(`Processing RAG query: "${query}"`);
    this.logger.log(`Using data sources: ${dataSourceIds.join(', ')}`);
    
    try {
      // 1. Analyze query
      const queryAnalysis = await this.queryAnalyzer.analyzeQuery(query);
      
      // 2. Retrieve relevant documents
      let documents: Document[] = [];
      let retrievalMethod = 'vector';
      
      // Determine if we should use hybrid search
      const useHybridSearch = options.useHybridSearch !== undefined 
        ? options.useHybridSearch 
        : queryAnalysis.isAnalytical;
      
      if (useHybridSearch) {
        // Use hybrid search
        retrievalMethod = 'hybrid';
        
        // Just log a warning if service isn't available but use the same retrieval method
        if (!this.qdrantSearchService) {
          this.logger.warn('QdrantSearchService not available for hybrid search, performance may be limited');
        }
        
        // Use regular vector retrieval but mark it as hybrid for metadata
        const { documents: retrievedDocs } = await this.retrievalService.retrieveDocumentsFromAllSources(
          query,
          dataSourceIds,
          {
            similarityThreshold: options.similarityThreshold || 0.3,
            includeMetadata: options.includeMetadata !== false,
            limit: queryAnalysis.searchLimit
          }
        );
        documents = retrievedDocs;
      } else {
        // Use regular vector retrieval
          const { documents: retrievedDocs } = await this.retrievalService.retrieveDocumentsFromAllSources(
            query,
            dataSourceIds,
            {
              similarityThreshold: options.similarityThreshold || 0.3,
              includeMetadata: options.includeMetadata !== false,
            limit: queryAnalysis.searchLimit
            }
          );
          
          documents = retrievedDocs;
      }
      
      // 3. Enhance results with metadata if requested
      if (options.enhanceResults && documents.length > 0) {
        documents = await this.enhanceDocumentResults(documents, query);
      }
      
      // 4. Generate response
      const response = await this.generationService.generateResponse(
        query,
        documents,
        {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          includeMetadata: options.includeMetadata !== false,
          isAnalytical: queryAnalysis.isAnalytical
        }
      );
      
      // 5. Create metadata for the response
      const metadata: RagResponseMetadata = {
        processTimeMs: Date.now() - startTime,
        processingTime: Date.now() - startTime,
        dataSourceIds: dataSourceIds.map(id => String(id)),
        documentsRetrieved: documents.length,
        retrievalMethod,
        modelUsed: response.model || options.model || 'default',
        queryAnalysis: {
          complexity: queryAnalysis.complexity,
          intent: queryAnalysis.intent,
          isAnalytical: queryAnalysis.isAnalytical,
          entityTypes: queryAnalysis.entityTypes
        }
      };
      
      return {
        query,
        content: response.content,
        sources: documents.map(doc => ({
          id: doc.id,
          content: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
          similarity: doc.similarity || 0,
          metadata: doc.metadata
        })),
        metadata
      };
    } catch (error) {
      this.logger.error(`Error processing RAG query: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate a response from a predefined set of documents
   * @param query The user query
   * @param documents The documents to use for context
   * @param options Additional options
   * @returns The response with metadata
   */
  async generateResponseFromDocuments(
    query: string,
    documents: Document[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      includeMetadata?: boolean;
      enhanceResults?: boolean;
    } = {}
  ): Promise<RagQueryResult> {
    const startTime = Date.now();
    this.logger.log(`Generating response from ${documents.length} provided documents for query: "${query}"`);
    
    try {
      // 1. Analyze query
      const queryAnalysis = await this.queryAnalyzer.analyzeQuery(query);
      
      // 2. Enhance results with metadata if requested
      let enhancedDocs = documents;
      if (options.enhanceResults && documents.length > 0) {
        enhancedDocs = await this.enhanceDocumentResults(documents, query);
      }
      
      // 3. Generate response
      const response = await this.generationService.generateResponse(
        query,
        enhancedDocs,
        {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          includeMetadata: options.includeMetadata !== false,
          isAnalytical: queryAnalysis.isAnalytical
        }
      );
      
      // 4. Create metadata for the response
      const metadata: RagResponseMetadata = {
        processTimeMs: Date.now() - startTime,
        processingTime: Date.now() - startTime,
        dataSourceIds: enhancedDocs
          .map(doc => doc.sourceId)
          .filter((value, index, self) => value && self.indexOf(value) === index) as string[],
        documentsRetrieved: enhancedDocs.length,
        retrievalMethod: 'provided',
        modelUsed: response.model || options.model || 'default',
        queryAnalysis: {
          complexity: queryAnalysis.complexity,
          intent: queryAnalysis.intent,
          isAnalytical: queryAnalysis.isAnalytical,
          entityTypes: queryAnalysis.entityTypes
        }
      };
      
      return {
        query,
        content: response.content,
        sources: enhancedDocs.map(doc => ({
          id: doc.id,
          content: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
          similarity: doc.similarity || 0,
          metadata: doc.metadata
        })),
        metadata
      };
    } catch (error) {
      this.logger.error(`Error generating response from documents: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Enhance documents with additional metadata to improve results
   * @param documents Documents to enhance
   * @param query The original query
   * @returns Enhanced documents
   */
  private async enhanceDocumentResults(documents: Document[], query: string): Promise<Document[]> {
    // Check if metadata service is available
    if (!this.enhancedMetadataService) {
      this.logger.warn('EnhancedMetadataService not available - skipping document enhancement');
      return documents;
    }
    
    try {
      this.logger.log(`Enhancing ${documents.length} documents with metadata`);
      
      // Group documents by source
      const docsBySource = documents.reduce((groups, doc) => {
        const sourceId = doc.sourceId || 'unknown';
        if (!groups[sourceId]) {
          groups[sourceId] = [];
        }
        groups[sourceId].push(doc);
        return groups;
      }, {} as Record<string, Document[]>);
      
      const enhancedDocs: Document[] = [];
      
      // Process each group of documents
      for (const [sourceId, docs] of Object.entries(docsBySource)) {
        // Determine source type based on metadata or content
        const sourceType = this.determineSourceType(docs);
        
        // Extract enhanced metadata
        const sourceData = docs.map(doc => ({
          content: doc.content,
          metadata: doc.metadata || {}
        }));
        
        const enhancedMetadata = await this.enhancedMetadataService.extractEnhancedMetadata(
          sourceData,
          sourceType,
          {
            calculateDistributions: true,
            extractDates: true,
            sampleSize: Math.min(docs.length, 100) // Sample at most 100 docs
          }
        );
        
        // Add enhanced metadata to each document
        for (const doc of docs) {
          enhancedDocs.push({
            ...doc,
            metadata: {
              ...doc.metadata,
              enhancedMetadata: {
                sourceType,
                numericRanges: enhancedMetadata.numericRanges,
                entityFrequencies: enhancedMetadata.entityFrequencies,
                uniqueValues: enhancedMetadata.uniqueValues,
                commonValues: enhancedMetadata.commonValues,
                totalProcessed: docs.length
              }
            }
          });
        }
      }
      
      this.logger.log(`Successfully enhanced ${enhancedDocs.length} documents with metadata`);
      return enhancedDocs;
    } catch (error) {
      this.logger.error(`Error enhancing document results: ${error}`);
      return documents; // Return original documents on error
    }
  }

  /**
   * Determine the source type based on document content and metadata
   * @param documents Documents to analyze
   * @returns The determined source type
   */
  private determineSourceType(documents: Document[]): DataSourceType {
    if (documents.length === 0) {
      return 'unknown';
    }
    
    // Check if metadata has source type
    const firstDoc = documents[0];
    if (firstDoc.metadata?.sourceType) {
      return firstDoc.metadata.sourceType as DataSourceType;
    }
    
    if (firstDoc.metadata?.fileType) {
      const fileType = String(firstDoc.metadata.fileType).toLowerCase();
      if (fileType.includes('pdf')) return 'pdf';
      if (fileType.includes('docx') || fileType.includes('doc')) return 'docx';
      if (fileType.includes('xlsx') || fileType.includes('xls')) return 'excel';
      if (fileType.includes('csv')) return 'csv';
    }
    
    // Look for clues in metadata
    if (firstDoc.metadata?.database) {
      const db = String(firstDoc.metadata.database).toLowerCase();
      if (db.includes('snowflake')) return 'snowflake';
      if (db.includes('***REMOVED***')) return '***REMOVED***ql';
      if (db.includes('mysql')) return 'mysql';
    }
    
    // Default to generic file type
    return 'file';
  }
} 