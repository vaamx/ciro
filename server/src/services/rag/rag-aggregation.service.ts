import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantSearchService } from '../vector/search.service';

// Add analytics cache class
/**
 * Cache for storing analytical query results
 * Implements LRU (Least Recently Used) caching strategy
 */
class AnalyticsCache {
  private cache: Map<string, any>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  
  constructor(maxSize = 100, ttlMinutes = 15) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000; // Convert minutes to milliseconds
  }
  
  /**
   * Generate a cache key from the query and data source ID
   */
  private generateKey(query: string, dataSourceId: number | string): string {
    const normalizedQuery = query.toLowerCase().trim();
    return `${dataSourceId}:${normalizedQuery}`;
  }
  
  /**
   * Store a result in the cache
   */
  set(query: string, dataSourceId: number | string, result: any): void {
    const key = this.generateKey(query, dataSourceId);
    const now = Date.now();
    
    this.cache.set(key, {
      result,
      timestamp: now,
      lastAccessed: now
    });
    
    // If cache exceeds max size, remove least recently used entries
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }
  
  /**
   * Retrieve a result from the cache
   * Returns undefined if not found or expired
   */
  get(query: string, dataSourceId: number | string): any | undefined {
    const key = this.generateKey(query, dataSourceId);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    const now = Date.now();
    
    // Check if entry has expired
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Update last accessed time
    entry.lastAccessed = now;
    
    return entry.result;
  }
  
  /**
   * Remove the least recently used entry from the cache
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }
}

const logger = createServiceLogger('RagAggregationService');

/**
 * Query options interface
 */
export interface QueryOptions {
  limit?: number;
  filter?: Record<string, any>;
  threshold?: number;
  includeMetadata?: boolean;
  [key: string]: any;
}

/**
 * Enhanced RAG service with support for aggregation queries
 * This service handles specialized processing for queries that can benefit 
 * from aggregation over retrieved documents
 */
@Injectable()
export class RagAggregationService {
  private readonly searchService: QdrantSearchService;
  private readonly analyticsCache: AnalyticsCache;
  private readonly logger = logger;
  
  constructor(
    qdrantSearchService: QdrantSearchService,
  ) {
    this.searchService = qdrantSearchService;
    this.analyticsCache = new AnalyticsCache(200, 30); // 200 items, 30 min TTL
    this.logger.info('RagAggregationService initialized');
  }
  
  /**
   * Process a query that might benefit from aggregations over retrieved data
   * @param query The user's query
   * @param dataSourceId The data source ID to query
   * @param options Additional query options
   */
  async processAggregationQuery(
    query: string,
    dataSourceId: number,
    options: QueryOptions = {}
  ): Promise<{ results: any; explanation: string }> {
    this.logger.info(`Processing aggregation query: ${query} for data source ${dataSourceId}`);
    
    try {
      // Check if we have a cached result for this query
      const isCachingEnabled = options.skipCache !== true;
      if (isCachingEnabled) {
        const cachedResult = this.analyticsCache.get(query, dataSourceId);
        if (cachedResult) {
          this.logger.info(`Using cached result for query: ${query}`);
          return {
            ...cachedResult,
            explanation: cachedResult.explanation + " (cached result)"
          };
        }
      }
      
      // Normalize collection name
      const collectionName = `datasource_${dataSourceId}`;
      
      // Check if collection exists using searchService
      const collectionExists = await this.searchService.collectionExists(collectionName);
      if (!collectionExists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return { 
          results: [], 
          explanation: `No data found for the specified data source (ID: ${dataSourceId})` 
        };
      }
      
      // Get query embedding if not explicitly provided (and query is not empty)
      const searchOptions = {
        limit: options.limit || 10,
        filter: options.filter || {},
        threshold: options.threshold || 0.7,
        includeMetadata: options.includeMetadata !== false
      };
      
      // Execute the query using the vector search service
      const searchResults = await this.searchService.search(
        collectionName,
        [] as number[], // Empty array instead of null for vector
        {
          ...searchOptions,
          filter: {
            ...searchOptions.filter,
            text: query // Add text to filter for keyword search
          }
        }
      );
      
      // Determine if this is an aggregation type query
      const isAggregation = this.isAggregationQuery(query);
      
      // Format results based on query type
      if (isAggregation) {
        const result = this.formatAggregationResults(query, {
          results: searchResults,
          executionDetails: {
            strategy: 'semantic_search_with_aggregation',
            confidence: 0.8
          }
        });
        
        // Cache the result if caching is enabled
        if (isCachingEnabled) {
          this.analyticsCache.set(query, dataSourceId, result);
        }
        
        return result;
      } else {
        // Regular search results
        return {
          results: searchResults,
          explanation: `Found ${searchResults.length} results relevant to your query using vector search.`
        };
      }
    } catch (error) {
      this.logger.error(`Error processing aggregation query: ${error}`);
      throw error;
    }
  }
  
  /**
   * Check if a query is requesting aggregation
   */
  private isAggregationQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const aggregationKeywords = [
      'average', 'avg', 'mean', 'median', 
      'sum', 'total', 'count', 'how many',
      'maximum', 'max', 'highest', 'top',
      'minimum', 'min', 'lowest', 'bottom'
    ];
    
    return aggregationKeywords.some(keyword => lowerQuery.includes(keyword));
  }
  
  /**
   * Format results specifically for aggregation queries
   * @param query The original query
   * @param queryResult The result from search
   */
  private formatAggregationResults(
    query: string,
    queryResult: any
  ): { results: any; explanation: string } {
    const { results, executionDetails = { confidence: 0.8 } } = queryResult;
    
    // Enhanced aggregation processing for large datasets
    let numericValues: number[] = [];
    let aggregationType = 'unknown';
    let subject = 'unknown';
    let totalProcessed = 0;
    
    // Identify which fields likely contain the relevant numeric data
    // by analyzing the first few results
    const sampleResults = Array.isArray(results) && results.length > 0 
      ? results.slice(0, Math.min(10, results.length)) 
      : [];
    
    // Extract field names that might contain numeric values
    const potentialNumericFields: Record<string, number> = {};
    
    // Step 1: Find potential numeric fields from the sample
    if (sampleResults.length > 0) {
      sampleResults.forEach(result => {
        if (result.payload && typeof result.payload === 'object') {
          Object.entries(result.payload).forEach(([key, value]) => {
            // Check if this is a numeric field or can be parsed as a number
            if (typeof value === 'number') {
              potentialNumericFields[key] = (potentialNumericFields[key] || 0) + 1;
            } else if (typeof value === 'string') {
              const parsed = parseFloat(value);
              if (!isNaN(parsed)) {
                potentialNumericFields[key] = (potentialNumericFields[key] || 0) + 1;
              }
            }
          });
        }
      });
    }
    
    // Sort fields by frequency to find the most likely candidates
    const likelyNumericFields = Object.entries(potentialNumericFields)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    this.logger.info(`Identified likely numeric fields: ${likelyNumericFields.join(', ')}`);
    
    // Determine aggregation type from query
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('average') || lowerQuery.includes('avg') || lowerQuery.includes('mean')) {
      aggregationType = 'average';
    } else if (lowerQuery.includes('sum') || lowerQuery.includes('total')) {
      aggregationType = 'sum';
    } else if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      aggregationType = 'count';
    } else if (lowerQuery.includes('max') || lowerQuery.includes('highest') || lowerQuery.includes('top')) {
      aggregationType = 'maximum';
    } else if (lowerQuery.includes('min') || lowerQuery.includes('lowest') || lowerQuery.includes('bottom')) {
      aggregationType = 'minimum';
    }
    
    // Try to determine subject from query
    const subjectPatterns = [
      { regex: /of\s+([a-z0-9\s]+)/i, group: 1 },
      { regex: /(sales|revenue|profit|cost|expense|income|growth|production|inventory)/i, group: 1 }
    ];
    
    for (const pattern of subjectPatterns) {
      const match = lowerQuery.match(pattern.regex);
      if (match && match[pattern.group]) {
        subject = match[pattern.group].trim();
        break;
      }
    }
    
    if (subject === 'unknown') {
      // Fallback to simple word extraction
      const words = query.split(' ');
      subject = words.length > 2 ? words.slice(2).join(' ') : 'data';
    }
    
    // Step 2: Process the full dataset more efficiently by focusing on relevant fields
    const startTime = Date.now();
    
    // Initialize aggregation variables based on type
    let sum = 0;
    let count = 0;
    let min = Number.MAX_VALUE;
    let max = Number.MIN_VALUE;
    
    // Process all results, focusing on the identified fields
    if (Array.isArray(results)) {
      totalProcessed = results.length;
      
      results.forEach(result => {
        if (result.payload && typeof result.payload === 'object') {
          // First try to get values from the likely fields
          let foundValue = false;
          
          for (const field of likelyNumericFields) {
            const value = result.payload[field];
            if (value !== undefined) {
              const numValue = typeof value === 'number' ? value : parseFloat(value);
              if (!isNaN(numValue)) {
                numericValues.push(numValue);
                sum += numValue;
                count++;
                min = Math.min(min, numValue);
                max = Math.max(max, numValue);
                foundValue = true;
                break;
              }
            }
          }
          
          // If we didn't find a value in the likely fields, try a more general approach
          if (!foundValue) {
            // Recursive function to extract numeric values from nested objects
            const extractNumbers = (obj: any) => {
              if (typeof obj === 'number') {
                numericValues.push(obj);
                sum += obj;
                count++;
                min = Math.min(min, obj);
                max = Math.max(max, obj);
              } else if (typeof obj === 'string') {
                const parsed = parseFloat(obj);
                if (!isNaN(parsed)) {
                  numericValues.push(parsed);
                  sum += parsed;
                  count++;
                  min = Math.min(min, parsed);
                  max = Math.max(max, parsed);
                }
              } else if (obj && typeof obj === 'object') {
                if (Array.isArray(obj)) {
                  obj.forEach(item => extractNumbers(item));
                } else {
                  Object.values(obj).forEach(value => extractNumbers(value));
                }
              }
            };
            
            extractNumbers(result.payload);
          }
        }
      });
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    // Calculate the result based on aggregation type
    let value: number;
    switch (aggregationType) {
      case 'average':
        value = count > 0 ? sum / count : 0;
        break;
      case 'sum':
        value = sum;
        break;
      case 'count':
        value = count;
        break;
      case 'maximum':
        value = max !== Number.MIN_VALUE ? max : 0;
        break;
      case 'minimum':
        value = min !== Number.MAX_VALUE ? min : 0;
        break;
      default:
        value = numericValues.length > 0 ? numericValues[0] : 0;
    }
    
    // Format the result
    const formattedResult = {
      type: 'aggregation',
      aggregationType,
      subject,
      value,
      valueFormatted: this.formatNumber(value, aggregationType),
      confidence: executionDetails?.confidence || 0.8,
      sourceCount: numericValues.length,
      totalProcessed,
      processingTimeMs,
      precomputed: false
    };
    
    const explanation = `This answer was calculated by analyzing ${numericValues.length} values across ${totalProcessed} documents that match your query. The system identified that you were asking for the ${aggregationType.replace(/_/g, ' ')} for ${subject}.`;
    
    return { results: formattedResult, explanation };
  }
  
  /**
   * Format a number based on aggregation type
   */
  private formatNumber(value: number, aggregationType: string): string {
    if (isNaN(value)) return '0';
    
    // Format based on type
    switch (aggregationType) {
      case 'average':
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'sum':
      case 'count':
      case 'maximum':
      case 'minimum':
        return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
      default:
        return value.toLocaleString();
    }
  }
} 
