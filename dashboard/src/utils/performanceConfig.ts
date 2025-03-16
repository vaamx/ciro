/**
 * Configuration settings for performance optimizations
 */

// Add type declaration for navigator.deviceMemory
declare global {
  interface Navigator {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  }
}

// Cache settings
export const CACHE_CONFIG = {
  // Maximum number of items to store in the visualization cache
  maxCacheSize: 50,
  
  // Time to live for cached items in milliseconds (10 minutes)
  cacheTTL: 10 * 60 * 1000,
  
  // Whether to enable caching
  enableCache: true
};

// Data sampling settings
export const SAMPLING_CONFIG = {
  // Maximum number of data points to display in a visualization
  maxDataPoints: 1000,
  
  // Default sampling strategy
  defaultStrategy: 'uniform' as 'uniform' | 'random' | 'aggregate',
  
  // Threshold for when to apply sampling (number of data points)
  samplingThreshold: 500,
  
  // Whether to enable sampling
  enableSampling: true
};

// Worker settings
export const WORKER_CONFIG = {
  // Whether to use web workers for data processing
  useWorkers: true,
  
  // Maximum time (ms) to wait for a worker before falling back to main thread
  workerTimeout: 5000,
  
  // Whether to show loading indicators during processing
  showLoadingIndicators: true
};

// Lazy loading settings
export const LAZY_LOADING_CONFIG = {
  // Whether to lazy load visualization components
  enableLazyLoading: true,
  
  // Whether to prefetch visualization components on page load
  prefetchComponents: false
};

// Responsive rendering settings
export const RESPONSIVE_CONFIG = {
  // Whether to use responsive containers for visualizations
  useResponsiveContainers: true,
  
  // Default height for visualizations
  defaultHeight: 300,
  
  // Default aspect ratio for responsive visualizations
  defaultAspectRatio: 16 / 9
};

/**
 * Get performance configuration based on device capabilities
 * Automatically adjusts settings based on device performance
 */
export function getOptimizedConfig() {
  // Check if running in a low-memory environment
  const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  
  // Check if running on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check if the device has a slow CPU
  const isSlowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
  
  // Adjust settings based on device capabilities
  if (isLowMemory || isMobile || isSlowCPU) {
    return {
      ...CACHE_CONFIG,
      ...SAMPLING_CONFIG,
      ...WORKER_CONFIG,
      ...LAZY_LOADING_CONFIG,
      ...RESPONSIVE_CONFIG,
      // Override settings for low-performance devices
      maxDataPoints: 500,
      samplingThreshold: 200,
      useWorkers: !isSlowCPU, // Disable workers on slow CPUs
      prefetchComponents: false,
      maxCacheSize: 20
    };
  }
  
  return {
    ...CACHE_CONFIG,
    ...SAMPLING_CONFIG,
    ...WORKER_CONFIG,
    ...LAZY_LOADING_CONFIG,
    ...RESPONSIVE_CONFIG
  };
} 