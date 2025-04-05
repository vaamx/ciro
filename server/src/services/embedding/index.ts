/**
 * Embedding services
 * 
 * This module contains services for generating and managing vector embeddings.
 */

// This is just a placeholder file until the actual embedding services are implemented
// The code will be updated when actual embedding services are developed

// Placeholder exports (will be replaced with actual exports when the service is implemented)
export interface EmbeddingService {
  createEmbedding(text: string): Promise<number[]>;
  createEmbeddings(texts: string[]): Promise<number[][]>;
}

// Export types that might be useful for other modules
export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  normalize?: boolean;
}

export type EmbeddingVector = number[]; 