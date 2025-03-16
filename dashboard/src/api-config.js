/**
 * API Configuration Override - LOCAL ENVIRONMENT
 */

// Changed to use localhost instead of 192.168.0.10
export const API_URL = 'http://localhost:3001';
export const SOCKET_URL = 'http://localhost:3001';
export const IS_DEVELOPMENT = true;
export const FEATURES = {
  useLocalStorage: true,
  disableServerSync: false,
  mockResponses: false
};

console.log('🔧 API configuration: USING ENVIRONMENT localhost:3001'); 
