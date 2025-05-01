// Auto-generated interface file based on references
export interface SearchResultItem {
  id: string;
  score: number;
  content?: string;
  metadata?: Record<string, any>;
  vector?: number[];
  payload?: {
    text?: string;
    content?: string;
    metadata?: Record<string, any>;
    timestamp?: string | number;
    created_at?: string | number;
    [key: string]: any;
  };
}

export type SearchResult = SearchResultItem;

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export interface IQdrantClientService {
  createCollection(collectionName: string, dimension: number): Promise<void>;
  deleteCollection(collectionName: string): Promise<void>;
  listCollections(): Promise<string[]>;
  upsertPoints(collectionName: string, points: any[]): Promise<void>;
  search(collectionName: string, vector: number[], limit?: number, filter?: any): Promise<any[]>;
}

export interface IQdrantSearchService {
  search(collectionName: string, query: string | number[], options?: SearchOptions): Promise<SearchResultItem[]>;
  similaritySearch(collectionName: string, embedding: number[], options?: SearchOptions): Promise<SearchResultItem[]>;
}

export interface IQdrantCollectionService {
  createCollection(name: string, options?: CollectionCreateOptions): Promise<boolean>;
  deleteCollection(name: string): Promise<boolean>;
  listCollections(): Promise<string[]>;
  collectionExists(name: string): Promise<boolean>;
  reindexAllCollections(): Promise<boolean>;
}

export interface IQdrantVectorService {
  createCollection(collectionName: string, dimension: number): Promise<void>;
  upsertPoints(collectionName: string, points: VectorPoint[]): Promise<void>;
  search(collectionName: string, vector: number[], limit?: number): Promise<SearchResultItem[]>;
  delete(collectionName: string, filter: any): Promise<void>;
}

export interface SearchOptions {
  limit?: number;
  filter?: any;
  withScores?: boolean;
  withVectors?: boolean;
  offset?: number;
  score_threshold?: number;
  with_payload?: boolean;
  with_vector?: boolean;
  params?: Record<string, any>;
}

export interface UpsertOptions {
  batch_size?: number;
}

export interface CollectionCreateOptions {
  dimension: number;
  metric?: 'cosine' | 'euclid' | 'dot' | 'manhattan';
  vectors?: {
    size: number;
    distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';
    hnsw_config?: Record<string, unknown>;
  };
  shards?: number;
  replicas?: number;
  on_disk?: boolean;
}

export interface CollectionInfo {
  name: string;
  dimension?: number;
  vectors_count?: number;
  vectorCount?: number;
  created_at?: string;
  metricType?: string;
  onDiskPayload?: boolean;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload?: Record<string, any>;
}

export type PointItem = {
  id: string;
  vector: number[];
  payload?: Record<string, any>;
};

export type PointsList = PointItem[];

export interface QdrantPointStruct {
  id: string;
  vector: number[];
  payload?: Record<string, any>;
}

// RAG Interfaces
export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  score?: number;
  similarity?: number;
  sourceId?: string;
}

export interface RetrievalOptions {
  limit?: number;
  filter?: any;
  rerank?: boolean;
  model?: string;
  withScores?: boolean;
  similarityThreshold?: number;
  includeMetadata?: boolean;
  requiresFullDataset?: boolean;
}

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
  includeMetadata?: boolean;
  contextOptions?: ContextBuilderOptions;
  isAnalytical?: boolean;
}

export interface ContextBuilderOptions {
  maxChars?: number;
  maxDocuments?: number;
  format?: ContextFormat;
}

export enum ContextFormat {
  STRING = 'string',
  ARRAY = 'array',
  MARKDOWN = 'markdown'
}

export interface IBaseRetrievalService {
  retrieve(query: string, options?: RetrievalOptions): Promise<Document[]>;
}

export interface IQueryAnalyzerService {
  analyzeQuery(query: string): Promise<QueryAnalysis>;
}

export interface IChunkingService {
  chunk(text: string, options?: ChunkingOptions): Promise<Document[]>;
  chunkDocument(document: any, options?: ChunkingOptions): Promise<Document[]>;
}

export interface IGenerationService {
  generate(prompt: string, context: string | Document[], options?: GenerationOptions): Promise<string>;
}

export interface IRagIntegrationService {
  query(query: string, options?: any): Promise<RagQueryResult>;
}

export interface QueryAnalysis {
  intents: string[];
  entities: Record<string, any>;
  temporal?: {
    startDate?: string;
    endDate?: string;
  };
  complexity: string;
  isAnalytical?: boolean;
  searchLimit?: number;
  requiresFullDataset?: boolean;
  entityTypes?: string[];
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
  keepSeparators?: boolean;
  metadataExtractor?: (chunk: string) => Record<string, any>;
}

export interface RagQueryResult {
  content: string;
  answer?: string;
  sources?: Document[];
  metadata: RagResponseMetadata;
  query?: string;
}

export interface RagResponseMetadata {
  processingTime: number | string;
  tokensUsed?: number;
  model?: string;
  sourceCount?: number;
  processTimeMs?: number;
  dataSourceIds: string[];
  documentsRetrieved?: number;
  retrievalMethod: string;
  modelUsed: string;
  collectionNames?: string[];
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
  queryAnalysis: {
    complexity: string;
    intent: string;
    isAnalytical: boolean;
    entityTypes?: string[];
    requiresFullDataset?: boolean;
  };
}

export type RagResponse = RagQueryResult;
