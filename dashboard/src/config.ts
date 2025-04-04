/**
 * API base URL - configurable from environment variables
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Other application-wide configuration
 */
export const config = {
  // Debounce timeout for search input (ms)
  searchDebounceTimeout: 300,
  
  // Default pagination limit
  defaultPageLimit: 20,
  
  // Default chart dimensions
  defaultChartDimensions: {
    width: 12,
    height: 8
  }
}; 