import { useMemo } from 'react';
import { getAuthToken } from './authToken';

/**
 * Hook to generate Axios config with JWT authorization headers
 * @returns Configuration object with authorization headers
 */
export const useJwtConfig = () => {
  const token = getAuthToken();
  
  return useMemo(() => {
    return {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
  }, [token]);
};

/**
 * Generate Axios config with JWT authorization headers
 * @returns Configuration object with authorization headers
 */
export const getJwtConfig = () => {
  const token = getAuthToken();
  
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
};

/**
 * Generate Axios config with multipart/form-data content type and JWT headers
 * @returns Configuration object for file uploads
 */
export const getFileUploadConfig = () => {
  const token = getAuthToken();
  
  return {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
};

/**
 * Generate Axios config with specific content type and JWT headers
 * @param contentType - The content type to use
 * @returns Configuration object with specified content type
 */
export const getConfigWithContentType = (contentType: string) => {
  const token = getAuthToken();
  
  return {
    headers: {
      'Content-Type': contentType,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
}; 