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
 * Normalize collection name for the vector database
 * Handles both general collection names and data source IDs
 * 
 * @param nameOrId Collection name or data source ID
 * @param type Optional type parameter to force specific normalization ('collection' or 'datasource')
 * @returns Normalized collection name
 */
export function normalizeCollectionName(nameOrId: string | number, type?: 'collection' | 'datasource'): string {
  const stringValue = String(nameOrId);
  
  // For data source normalization
  if (type === 'datasource' || (!type && stringValue.match(/^\d+$/) || stringValue.startsWith('datasource_'))) {
    // If already prefixed with datasource_, return as is
    if (stringValue.startsWith('datasource_')) {
      return stringValue;
    }
    
    // Otherwise add the prefix
    return `datasource_${stringValue}`;
  }
  
  // For general collection name normalization
  // Remove special characters and convert to lowercase
  let normalized = stringValue
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

/**
 * Common utilities for vector search services
 */

/**
 * Combine filters for Qdrant search
 * @param baseFilter Base filter object
 * @param additionalFilter Additional filter to add
 * @returns Combined filter
 */
export function combineFilters(baseFilter: any, additionalFilter: any): any {
  // If either filter is undefined, return the other
  if (!baseFilter) return additionalFilter;
  if (!additionalFilter) return baseFilter;

  // If both filters have 'must' property, combine them
  if (baseFilter.must && additionalFilter.must) {
    return {
      must: [...baseFilter.must, ...additionalFilter.must]
    };
  }

  // If only one filter has 'must', add the other as a complete condition
  if (baseFilter.must) {
    return {
      must: [...baseFilter.must, additionalFilter]
    };
  }

  if (additionalFilter.must) {
    return {
      must: [baseFilter, ...additionalFilter.must]
    };
  }

  // If neither has 'must', create a new 'must' array with both filters
  return {
    must: [baseFilter, additionalFilter]
  };
}

/**
 * Extract meaningful keywords from a query
 * @param query The user query
 * @returns Array of keywords
 */
export function extractKeywords(query: string): string[] {
  // Common words to exclude
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'of', 'from',
    'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them',
    'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how'
  ]);
  
  // Split by whitespace, convert to lowercase, remove punctuation
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && // Filter out short words
      !stopWords.has(word) // Filter out common words
    );
}

/**
 * Create a keyword filter for text search
 * @param keywords Keywords to search for
 * @param fields Fields to search in
 * @returns Qdrant filter object
 */
export function createKeywordFilter(keywords: string[], fields: string[]): any {
  if (keywords.length === 0 || fields.length === 0) {
    return undefined;
  }
  
  // Create conditions for each field and keyword
  const conditions = [];
  
  for (const field of fields) {
    for (const keyword of keywords) {
      conditions.push({
        text: {
          [field]: {
            match: {
              text: keyword
            }
          }
        }
      });
    }
  }
  
  // Return as a 'should' filter (equivalent to OR)
  return {
    should: conditions
  };
}

/**
 * Calculate the text match score based on keyword frequency
 * @param text The text to analyze
 * @param keywords Keywords to match
 * @returns Score between 0 and 1
 */
export function calculateKeywordMatchScore(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) {
    return 0;
  }
  
  const lowercaseText = text.toLowerCase();
  let matchCount = 0;
  
  for (const keyword of keywords) {
    // Count occurrences
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = lowercaseText.match(regex);
    
    if (matches) {
      matchCount += matches.length;
    }
  }
  
  // Calculate score based on match density
  // Higher score for more matches and shorter text (higher concentration)
  const textLength = text.length;
  const keywordCount = keywords.length;
  
  return Math.min(1, (matchCount / keywordCount) * Math.min(1, 1000 / textLength));
} 