/**
 * API Configuration Override
 */

// Use environment variables if available, otherwise fallback to localhost
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Ensure we're using the correct protocol for sockets (ws:// instead of http://)
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001').replace(/^http/, 'ws');
export const IS_DEVELOPMENT = import.meta.env.DEV;
export const FEATURES = {
  useLocalStorage: true,
  disableServerSync: false,
  mockResponses: false
};

console.log(`🔧 API configuration: USING ENVIRONMENT ${API_URL}`);
console.log(`🔌 Socket configuration: USING ${SOCKET_URL}`); 
