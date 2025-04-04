/**
 * Cache utility for storing and retrieving visualization data
 * Implements LRU (Least Recently Used) caching strategy
 */

interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  lastAccessed: number;
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;
  
  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 5 * 60 * 1000; // Default: 5 minutes
  }
  
  /**
   * Generate a cache key from the data and config
   */
  private generateKey(data: any, config: any): string {
    // Create a deterministic key from the data and config
    const configStr = JSON.stringify(config);
    
    // For data, we use a hash of the first few and last few items
    // plus the length to avoid stringifying the entire dataset
    const dataPreview = data.slice(0, 3);
    const dataEnd = data.length > 3 ? data.slice(-3) : [];
    const dataStr = JSON.stringify({
      preview: dataPreview,
      end: dataEnd,
      length: data.length
    });
    
    return `${dataStr}:${configStr}`;
  }
  
  /**
   * Store a value in the cache
   */
  set(data: any, config: any, value: T): void {
    const key = this.generateKey(data, config);
    const now = Date.now();
    
    this.cache.set(key, {
      value,
      timestamp: now,
      lastAccessed: now
    });
    
    // If cache exceeds max size, remove least recently used entries
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
    
    // Clean expired entries
    this.cleanExpired();
  }
  
  /**
   * Retrieve a value from the cache
   * Returns undefined if not found or expired
   */
  get(data: any, config: any): T | undefined {
    const key = this.generateKey(data, config);
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
    
    return entry.value;
  }
  
  /**
   * Check if a value exists in the cache and is not expired
   */
  has(data: any, config: any): boolean {
    const key = this.generateKey(data, config);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Remove a value from the cache
   */
  delete(data: any, config: any): boolean {
    const key = this.generateKey(data, config);
    return this.cache.delete(key);
  }
  
  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Remove expired entries from the cache
   */
  private cleanExpired(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
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
} 