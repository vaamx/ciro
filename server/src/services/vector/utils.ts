/**
 * Vector service utilities
 * 
 * This module contains utility functions for vector operations.
 */

/**
 * Calculate cosine similarity between two vectors
 */
export function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error(`Vector dimensions don't match: ${vectorA.length} vs ${vectorB.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  // Handle zero vectors to avoid division by zero
  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  // Handle zero vector
  if (magnitude === 0) {
    return [...vector];
  }
  
  return vector.map(val => val / magnitude);
}

/**
 * Generate a random unit vector of the specified dimension
 * Useful for testing
 */
export function randomUnitVector(dimension: number): number[] {
  // Create a random vector
  const vector = Array.from({ length: dimension }, () => Math.random() * 2 - 1);
  
  // Normalize to unit length
  return normalizeVector(vector);
}

/**
 * Format vector to a fixed precision for display
 */
export function formatVector(vector: number[], precision: number = 4): string {
  return `[${vector.map(v => v.toFixed(precision)).join(', ')}]`;
}

/**
 * Check if a collection name follows our naming convention
 */
export function isValidCollectionName(name: string): boolean {
  // Collection names should be lowercase alphanumeric with underscores
  // and should not start with a number
  const validPattern = /^[a-z][a-z0-9_]*$/;
  return validPattern.test(name);
}

/**
 * Normalize a collection name to follow our naming convention
 */
export function normalizeCollectionName(name: string): string {
  // Remove special characters and convert to lowercase
  let normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^[0-9]/, 'collection_$&')
    .replace(/_+/g, '_');
  
  // Ensure it starts with a letter
  if (!/^[a-z]/.test(normalized)) {
    normalized = 'collection_' + normalized;
  }
  
  return normalized;
}

/**
 * Calculate the vector centroid (average) of multiple vectors
 */
export function calculateCentroid(vectors: number[][]): number[] {
  if (!vectors.length) {
    throw new Error('Cannot calculate centroid of empty vector set');
  }
  
  const dimension = vectors[0].length;
  
  // Initialize centroid with zeros
  const centroid = new Array(dimension).fill(0);
  
  // Sum all vectors
  for (const vector of vectors) {
    if (vector.length !== dimension) {
      throw new Error('All vectors must have the same dimension');
    }
    
    for (let i = 0; i < dimension; i++) {
      centroid[i] += vector[i];
    }
  }
  
  // Divide by count to get average
  return centroid.map(val => val / vectors.length);
} 