/**
 * Core interfaces for vector database services
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Configuration options for Qdrant
 */
export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

/**
 * Collection creation options
 */
export interface CollectionCreateOptions {
  vectors: {
    size: number;
    distance: 'Cosine' | 'Euclid' | 'Dot';
  };
  optimizers_config?: {
    default_segment_number?: number;
    memmap_threshold?: number;
    indexing_threshold?: number;
  };
  hnsw_config?: {
    m?: number;
    ef_construct?: number;
    full_scan_threshold?: number;
    on_disk?: boolean;
  };
  on_disk_payload?: boolean;
  wal_config?: {
    wal_capacity_mb?: number;
    wal_segments_ahead?: number;
  };
}

/**
 * Collection information
 */
export interface CollectionInfo {
  name: string;
  vectorCount: number;
  dimension: number;
  metricType: string;
  onDiskPayload?: boolean;
}

/**
 * Search options
 */
export interface SearchOptions {
  filter?: any;
  limit?: number;
  offset?: number;
  with_payload?: boolean;
  with_vector?: boolean;
  score_threshold?: number;
  params?: {
    hnsw_ef?: number;
    exact?: boolean;
  };
}

/**
 * Search result item
 */
export interface SearchResultItem {
  id: string | number;
  score: number;
  payload: Record<string, any>;
  vector?: number[];
}

/**
 * Vector point for upsert
 */
export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload: Record<string, any>;
}

/**
 * Vector database error
 */
export interface VectorDatabaseError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Interface for client factory
 */
export interface QdrantClientFactory {
  createClient(config: QdrantConfig): QdrantClient;
}

/**
 * Client service interface
 */
export interface IQdrantClientService {
  getClient(): QdrantClient;
  getApiUrl(): string;
  hasApiKey(): boolean;
}

/**
 * Collection service interface
 */
export interface IQdrantCollectionService {
  collectionExists(collectionName: string): Promise<boolean>;
  createCollection(collectionName: string, options: CollectionCreateOptions): Promise<boolean>;
  getCollectionInfo(collectionName: string): Promise<number>; // Returns vector count
  deleteCollection(collectionName: string): Promise<boolean>;
  listCollections(): Promise<string[]>;
  optimizeCollection(collectionName: string): Promise<boolean>;
  updateCollection(collectionName: string, options: Partial<CollectionCreateOptions>): Promise<boolean>;
}

/**
 * Vector service interface
 */
export interface IQdrantVectorService {
  storeVectors(collectionName: string, vectors: number[][], payloads: Record<string, any>[], ids?: (string | number)[]): Promise<string[]>;
  upsertVectors(collectionName: string, points: VectorPoint[]): Promise<boolean>;
  deleteVectors(collectionName: string, ids: (string | number)[]): Promise<boolean>;
  deleteVectorsByFilter(collectionName: string, filter: any): Promise<boolean>;
}

/**
 * Search service interface
 */
export interface IQdrantSearchService {
  search(
    collectionName: string,
    vector: number[],
    filter?: any,
    limit?: number,
    scoreThreshold?: number
  ): Promise<SearchResultItem[]>;
  searchBatch(
    collectionName: string,
    vectors: number[][],
    filter?: any,
    limit?: number
  ): Promise<SearchResultItem[][]>;
  searchWithParams(
    collectionName: string,
    vector: number[],
    options: SearchOptions
  ): Promise<SearchResultItem[]>;
} 