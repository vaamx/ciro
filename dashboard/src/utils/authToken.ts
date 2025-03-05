/**
 * Get the authentication token from localStorage
 * @returns The JWT token or null if not found
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

/**
 * Set the authentication token in localStorage
 * @param token - JWT token
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

/**
 * Remove the authentication token from localStorage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};

/**
 * Check if the authentication token exists
 * @returns True if the token exists
 */
export const hasAuthToken = (): boolean => {
  return !!getAuthToken();
};

/**
 * Get the JWT token and format it for use in headers
 * @returns Formatted Bearer token or empty string
 */
export const getAuthorizationHeader = (): string => {
  const token = getAuthToken();
  return token ? `Bearer ${token}` : '';
};

/**
 * Extract user info from JWT token
 * @returns User information or null if token is invalid
 */
export const getUserFromToken = (): any | null => {
  try {
    const token = getAuthToken();
    if (!token) return null;
    
    // JWT tokens are in the format: header.payload.signature
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return null;
  }
}; 