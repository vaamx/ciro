/**
 * Core interfaces for RAG (Retrieval Augmented Generation) services
 */

// Document interface for retrieved content
export interface Document {
  id?: string;
  content: string;
  sourceId?: string;
  sourceName?: string;
  metadata?: Record<string, any>;
  similarity?: number;
}

// Query analysis result
export interface QueryAnalysis {
  intent: string;
  complexity: 'high' | 'medium' | 'low';
  dataVisualization: boolean;
  entities: string[];
  timeFrame?: string;
  countType?: 'entity' | 'document' | 'vcfund' | 'general';
  entityType?: string;
  searchLimit: number;
  similarityThreshold: number;
  isAnalytical: boolean;
  entityTypes?: string[];
  requiresFullDataset?: boolean;
}

// Retrieval options
export interface RetrievalOptions {
  limit?: number;
  filter?: Record<string, any>;
  similarityThreshold?: number;
  includeMetadata?: boolean;
  requiresFullDataset?: boolean;
}

// Generation options
export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  extraSystemPrompt?: string;
  isAnalytical?: boolean;
  includeMetadata?: boolean;
}

// RAG response metadata
export interface RagResponseMetadata {
  processingTime?: number;
  processTimeMs?: number;
  model?: string;
  modelUsed?: string;
  collectionNames?: string[];
  dataSourceIds: string[];
  dataSourceType?: string;
  isQdrantResponse?: boolean;
  isRagResponse?: boolean;
  useEnhancedVisualization?: boolean;
  hasVisualization?: boolean;
  error?: string;
  errorMessage?: string;
  visualizationData?: {
    type: string;
    data: any[];
  };
  documentsRetrieved?: number;
  retrievalMethod?: string;
  queryAnalysis?: {
    complexity: string;
    intent: string;
    isAnalytical: boolean;
    entityTypes?: string[];
    requiresFullDataset?: boolean;
  };
}

// RAG query result
export interface RagQueryResult {
  content: string;
  sources: any[];
  model?: string;
  metadata: RagResponseMetadata;
  query?: string;
}

/**
 * Interface for the Query Analyzer Service
 */
export interface IQueryAnalyzerService {
  /**
   * Analyze a query to determine intent, complexity, and requirements
   * @param query The user query
   * @returns Analysis of the query including intent, complexity, entities, etc.
   */
  analyzeQuery(query: string): Promise<QueryAnalysis>;

  /**
   * Basic analysis of query intent and complexity (potentially deprecated by analyzeQuery)
   * @param query The user query
   * @returns Basic analysis of the query
   */
  analyzeQueryIntent(query: string): QueryAnalysis;
}

/**
 * Interface for the Generation Service
 */
export interface IGenerationService {
  /**
   * Generate a response based on the query and retrieved documents
   * @param query User query
   * @param documents Retrieved documents
   * @param options Generation options
   * @returns Generated content and model used
   */
  generateResponse(
    query: string,
    documents: Document[],
    options?: GenerationOptions
  ): Promise<{
    content: string;
    model: string;
  }>;
}

/**
 * Options for chunking text
 */
export interface ChunkingOptions {
    chunkSize?: number;
    overlap?: number;
    minChunkSize?: number;
    maxChunkSize?: number;
    splitBySection?: boolean;
    preserveParagraphs?: boolean;
    smartChunking?: boolean; // New option for smart chunking
    respectDocumentStructure?: boolean; // New option to respect document structure
    adaptiveChunking?: boolean; // New option for adaptive chunking
    semanticSplitting?: boolean; // New option for semantic-based splitting
}

/**
 * Interface for the Chunking Service
 */
export interface IChunkingService {
  /**
   * Create chunks from text with enhanced options
   * @param text Text to chunk
   * @param options Chunking options
   * @returns Array of text chunks
   */
  createChunks(text: string, options?: ChunkingOptions): string[];

  /**
   * Create chunks from structured document elements
   * @param elements Array of elements with text and metadata
   * @param options Chunking options for elements
   * @returns Array of chunks, each associated with original elements
   */
  createChunksFromElements(
    elements: Array<{
      element_id: string;
      type: string;
      text: string;
      metadata?: Record<string, any>;
    }>,
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      smartChunking?: boolean;
    }
  ): Array<{
    text: string;
    element_ids: string[];
    element_types: string[];
    metadata: Record<string, any>;
  }>;

  /**
   * Perform semantic chunking based on sentence meaning
   * @param text Text to chunk
   * @param options Options for semantic chunking
   * @returns Array of semantically coherent chunks
   */
  semanticChunking(
    text: string,
    options?: {
      targetChunkSize?: number;
      minChunkSize?: number;
      maxChunkSize?: number;
      overlap?: number;
    }
  ): string[];
}

/**
 * Interface for the Base Retrieval Service
 */
export interface IBaseRetrievalService {
  /**
   * Retrieve documents from multiple data sources
   * @param query User query
   * @param dataSourceIds Array of data source IDs to search in
   * @param options Retrieval options
   * @returns Object containing documents and collection names
   */
  retrieveDocumentsFromAllSources(
    query: string,
    dataSourceIds: string[] | number[],
    options?: RetrievalOptions
  ): Promise<{
    documents: Document[];
    collectionNames: string[];
  }>;
}

/**
 * Interface for the RAG Integration Service
 */
export interface IRagIntegrationService {
  /**
   * Process a RAG query to generate a response
   * @param query The user query
   * @param dataSourceIds Data source IDs to query
   * @param options Additional options for processing
   * @returns The response with content, sources, and metadata
   */
  processQuery(
    query: string,
    dataSourceIds: string[] | number[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      useHybridSearch?: boolean;
      semanticWeight?: number;
      keywordWeight?: number;
      includeMetadata?: boolean;
      similarityThreshold?: number;
      enhanceResults?: boolean;
    }
  ): Promise<RagQueryResult>;

  /**
   * Generate a response directly from provided documents
   * @param query The user query
   * @param documents Pre-retrieved documents
   * @param options Generation options
   * @returns The response with content, sources, and metadata
   */
  generateResponseFromDocuments(
    query: string,
    documents: Document[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      includeMetadata?: boolean;
      enhanceResults?: boolean;
    }
  ): Promise<RagQueryResult>;

  /**
   * Process a RAG query and provide a streaming response
   * @param query The user query
   * @param dataSourceIds Data source IDs to query
   * @param options Additional options, including progress callback
   * @returns A ReadableStream for the response
   */
  processQueryWithStreaming(
    query: string,
    dataSourceIds: string[] | number[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      useHybridSearch?: boolean;
      semanticWeight?: number;
      keywordWeight?: number;
      includeMetadata?: boolean;
      similarityThreshold?: number;
      enhanceResults?: boolean;
      progressCallback?: (progress: any) => void;
    }
  ): Promise<ReadableStream>;
}

/**
 * Context format options
 */
export type ContextFormat = 'default' | 'numbered' | 'markdown' | 'compact';

/**
 * Options for building context
 */
export interface ContextBuilderOptions {
  maxTokens?: number;
  format?: ContextFormat;
  includeMetadata?: boolean;
  deduplicate?: boolean;
} 