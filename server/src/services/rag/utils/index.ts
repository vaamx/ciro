/**
 * RAG Utilities
 * 
 * This module contains utility functions for RAG (Retrieval Augmented Generation) operations.
 */

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate dot product between two vectors
 */
export function dotProduct(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let result = 0;
  for (let i = 0; i < vectorA.length; i++) {
    result += vectorA[i] * vectorB[i];
  }
  
  return result;
}

/**
 * Normalize a vector to unit length
 * Renamed to avoid conflict with vector/utils.ts normalizeVector
 */
export function ragNormalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  if (norm === 0) {
    return vector.map(() => 0);
  }
  
  return vector.map(val => val / norm);
}

/**
 * Simple text preprocessing for RAG
 */
export function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chunk text into smaller segments
 */
export function chunkText(text: string, chunkSize: number, overlap: number = 0): string[] {
  const words = text.split(' ');
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }
  
  return chunks;
} 