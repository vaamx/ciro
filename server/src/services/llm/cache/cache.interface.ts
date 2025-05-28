/**
 * Cache Service Interface
 * Defines the contract for caching services (e.g., Redis, in-memory).
 */

export interface ICacheService {
  /**
   * Get a value from the cache.
   * @param key The cache key.
   * @returns The cached value, or null if not found or expired.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache.
   * @param key The cache key.
   * @param value The value to cache.
   * @param ttlSeconds Optional. Time-to-live in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a value from the cache.
   * @param key The cache key.
   */
  delete(key: string): Promise<void>;

  /**
   * Clear the entire cache (use with caution).
   */
  clear?(): Promise<void>;

  /**
   * Check if a key exists in the cache.
   */
  has?(key: string): Promise<boolean>;
} 