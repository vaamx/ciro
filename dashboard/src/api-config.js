/**
 * API Configuration Override
 */

// Determine if we're in production by checking the hostname
const isProduction = window.location.hostname === 'app.ciroai.us';

// In production, always use the production API URL
// In development, use the environment variable or localhost fallback
export const API_URL = isProduction 
  ? 'https://api.ciroai.us'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001');

export const SOCKET_URL = isProduction
  ? 'https://api.ciroai.us'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001');

export const IS_DEVELOPMENT = import.meta.env.DEV || false;
export const FEATURES = {
  useLocalStorage: true,
  disableServerSync: false,
  mockResponses: false
};

// Helper function to build API URLs correctly for both environments
export const buildApiUrl = (endpoint) => {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // In production, use full URL; in development, use relative path (for proxy)
  return isProduction
    ? `${API_URL}${normalizedEndpoint}`
    : normalizedEndpoint;
};

console.log('🔧 API configuration:', API_URL);
console.log('📡 Running in:', isProduction ? 'production' : 'development'); 
