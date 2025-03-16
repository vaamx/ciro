import { useState, useEffect, useRef } from 'react';
import { createWorker } from '../utils/worker';
import { Cache } from '../utils/cache';
import { 
  CACHE_CONFIG, 
  SAMPLING_CONFIG, 
  WORKER_CONFIG 
} from '../utils/performanceConfig';

// Create a singleton cache for visualization data
const visualizationCache = new Cache<any>({
  maxSize: CACHE_CONFIG.maxCacheSize,
  ttl: CACHE_CONFIG.cacheTTL
});

/**
 * Hook for processing visualization data using a web worker
 * Handles caching, data sampling, and worker lifecycle
 */
export function useVisualizationWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<ReturnType<typeof createWorker> | null>(null);
  const workerTimeoutRef = useRef<number | null>(null);
  
  // Initialize worker on first use
  useEffect(() => {
    // Only create worker if enabled in config
    if (WORKER_CONFIG.useWorkers && !workerRef.current) {
      workerRef.current = createWorker('/workers/visualization-worker.js');
    }
    
    // Clean up worker on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      
      if (workerTimeoutRef.current) {
        clearTimeout(workerTimeoutRef.current);
        workerTimeoutRef.current = null;
      }
    };
  }, []);
  
  /**
   * Process data for visualization
   * Checks cache first, then uses worker if needed
   */
  const processData = async (data: any[], config: any) => {
    // Return empty array for empty data
    if (!data || data.length === 0) {
      return [];
    }
    
    // Check if we should apply sampling based on data size
    const shouldSample = SAMPLING_CONFIG.enableSampling && 
      data.length > SAMPLING_CONFIG.samplingThreshold;
    
    // Add sampling options to config if needed
    const enhancedConfig = {
      ...config,
      options: {
        ...config.options,
        sampling: shouldSample ? {
          maxPoints: SAMPLING_CONFIG.maxDataPoints,
          strategy: SAMPLING_CONFIG.defaultStrategy,
          ...config.options?.sampling
        } : undefined
      }
    };
    
    // Check cache first if enabled
    if (CACHE_CONFIG.enableCache) {
      const cachedResult = visualizationCache.get(data, enhancedConfig);
      if (cachedResult) {
        return cachedResult;
      }
    }
    
    // If workers are disabled or no worker is available, process synchronously
    if (!WORKER_CONFIG.useWorkers || !workerRef.current) {
      console.warn('Visualization worker not available, processing synchronously');
      return data;
    }
    
    try {
      setIsProcessing(true);
      
      // Create a promise that will reject after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        workerTimeoutRef.current = setTimeout(() => {
          reject(new Error('Worker processing timed out'));
        }, WORKER_CONFIG.workerTimeout);
      });
      
      // Process data in worker with timeout
      const result = await Promise.race([
        workerRef.current.executeTask('processChart', {
          data,
          config: enhancedConfig
        }),
        timeoutPromise
      ]);
      
      // Clear timeout
      if (workerTimeoutRef.current) {
        clearTimeout(workerTimeoutRef.current);
        workerTimeoutRef.current = null;
      }
      
      // Cache the result if caching is enabled
      if (CACHE_CONFIG.enableCache) {
        visualizationCache.set(data, enhancedConfig, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error processing visualization data:', error);
      return data; // Return original data on error
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Calculate statistics for a dataset
   */
  const calculateStatistics = async (data: any[], field: string) => {
    if (!data || data.length === 0 || !field) {
      return null;
    }
    
    // Use a different cache key for statistics
    const statsConfig = { type: 'statistics', field };
    
    // Check cache first if enabled
    if (CACHE_CONFIG.enableCache) {
      const cachedResult = visualizationCache.get(data, statsConfig);
      if (cachedResult) {
        return cachedResult;
      }
    }
    
    // If workers are disabled or no worker is available, return null
    if (!WORKER_CONFIG.useWorkers || !workerRef.current) {
      console.warn('Visualization worker not available for statistics calculation');
      return null;
    }
    
    try {
      // Calculate statistics in worker
      const result = await workerRef.current.executeTask('statistics', {
        data,
        field
      });
      
      // Cache the result if caching is enabled
      if (CACHE_CONFIG.enableCache) {
        visualizationCache.set(data, statsConfig, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error calculating statistics:', error);
      return null;
    }
  };
  
  /**
   * Sample a large dataset
   */
  const sampleData = async (data: any[], options = {}) => {
    if (!data || data.length === 0) {
      return [];
    }
    
    // Skip sampling if disabled or data is small enough
    if (!SAMPLING_CONFIG.enableSampling || 
        data.length <= SAMPLING_CONFIG.samplingThreshold) {
      return data;
    }
    
    // Merge default options with provided options
    const samplingOptions = {
      maxPoints: SAMPLING_CONFIG.maxDataPoints,
      strategy: SAMPLING_CONFIG.defaultStrategy,
      ...options
    };
    
    // Use a different cache key for sampling
    const sampleConfig = { type: 'sample', options: samplingOptions };
    
    // Check cache first if enabled
    if (CACHE_CONFIG.enableCache) {
      const cachedResult = visualizationCache.get(data, sampleConfig);
      if (cachedResult) {
        return cachedResult;
      }
    }
    
    // If workers are disabled or no worker is available, return original data
    if (!WORKER_CONFIG.useWorkers || !workerRef.current) {
      console.warn('Visualization worker not available for data sampling');
      return data;
    }
    
    try {
      // Sample data in worker
      const result = await workerRef.current.executeTask('sample', {
        data,
        options: samplingOptions
      });
      
      // Cache the result if caching is enabled
      if (CACHE_CONFIG.enableCache) {
        visualizationCache.set(data, sampleConfig, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error sampling data:', error);
      return data;
    }
  };
  
  /**
   * Clear the visualization cache
   */
  const clearCache = () => {
    visualizationCache.clear();
  };
  
  return {
    processData,
    calculateStatistics,
    sampleData,
    clearCache,
    isProcessing
  };
} 