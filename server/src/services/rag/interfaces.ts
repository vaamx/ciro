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
}

// Retrieval options
export interface RetrievalOptions {
  limit?: number;
  filter?: Record<string, any>;
  similarityThreshold?: number;
  includeMetadata?: boolean;
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