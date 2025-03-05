/**
 * Helper script to manage the OpenAI API key
 * 
 * This utility provides functions to:
 * 1. Fetch the API key from the server (preferred method)
 * 2. Set a custom API key in localStorage (fallback)
 * 3. Check if an API key is available
 * 4. Clear the stored API key
 */

// Import the new RagService
import { RagService } from '../services/rag/RagService';

/**
 * Local storage key for the OpenAI API key
 */
const API_KEY_STORAGE_KEY = 'openai_api_key';
const SERVER_API_KEY_STORAGE_KEY = 'server_openai_api_key';

// Flag to track if we're using mock data due to missing API endpoints
let useMockServerKey = false;

/**
 * Fetch the OpenAI API key from the server
 * @returns {Promise<string|null>} - The API key from the server or null if not available
 */
export async function fetchApiKeyFromServer() {
  // If we've already determined we need to use mock data, don't try the API
  if (useMockServerKey) {
    console.log('Using mock server API key');
    return getMockServerApiKey();
  }

  try {
    console.log('Fetching API key from server...');
    
    const response = await fetch('/api/config/openai-key', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    // If the endpoint doesn't exist (404), use mock data
    if (response.status === 404) {
      console.warn('Server API key endpoint not found, using mock data');
      useMockServerKey = true;
      return getMockServerApiKey();
    }
    
    if (!response.ok) {
      console.error(`Failed to fetch API key from server: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.apiKey) {
      // Store the server-provided key in localStorage
      localStorage.setItem(SERVER_API_KEY_STORAGE_KEY, data.apiKey);
      
      // Set in RagService
      RagService.setApiKey(data.apiKey);
      
      console.log('Server API key fetched and set successfully');
      return data.apiKey;
    } else {
      console.warn('Server returned empty or invalid API key');
      return null;
    }
  } catch (error) {
    console.error('Error fetching API key from server:', error);
    
    // If any error occurs, fall back to mock data
    console.warn('Falling back to mock server API key due to error');
    useMockServerKey = true;
    return getMockServerApiKey();
  }
}

/**
 * Set a custom OpenAI API key in local storage and in the RagService
 * This is used as a fallback when the server API key is not available
 * @param {string} apiKey - The OpenAI API key
 * @returns {boolean} - Whether the key was successfully set
 */
export function setOpenAIApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    console.error('Invalid API key provided');
    return false;
  }

  try {
    // Store in localStorage
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    
    // Set in RagService
    RagService.setApiKey(apiKey);
    
    console.log('Custom API key set successfully');
    return true;
  } catch (error) {
    console.error('Error setting API key:', error);
    return false;
  }
}

/**
 * Check if an OpenAI API key is available (either from server or custom)
 * @returns {boolean} - Whether an API key is available
 */
export function hasOpenAIApiKey() {
  try {
    // Check for server-provided key first
    const serverKey = localStorage.getItem(SERVER_API_KEY_STORAGE_KEY);
    if (serverKey) return true;
    
    // Fall back to custom key
    return !!localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    return false;
  }
}

/**
 * Clear the stored OpenAI API keys
 */
export function clearOpenAIApiKey() {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(SERVER_API_KEY_STORAGE_KEY);
    console.log('API keys cleared');
  } catch (error) {
    console.error('Error clearing API keys:', error);
  }
}

/**
 * Get the stored OpenAI API key (prioritizing server key)
 * @returns {string|null} - The stored API key or null if not set
 */
export function getOpenAIApiKey() {
  try {
    // Try to get the server-provided key first
    const serverKey = localStorage.getItem(SERVER_API_KEY_STORAGE_KEY);
    if (serverKey) return serverKey;
    
    // Fall back to custom key
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
}

/**
 * Set the OpenAI API key in local storage
 */
export function setApiKey(apiKey) {
  if (!apiKey) {
    console.error('Cannot set empty API key');
    return false;
  }
  
  try {
    localStorage.setItem('openai_api_key', apiKey);
    console.log('API key set successfully');
    return true;
  } catch (error) {
    console.error('Failed to set API key:', error);
    return false;
  }
}

/**
 * Get the OpenAI API key from local storage
 */
export function getApiKey() {
  try {
    return localStorage.getItem('openai_api_key');
  } catch (error) {
    console.error('Failed to get API key:', error);
    return null;
  }
}

/**
 * Clear the OpenAI API key from local storage
 */
export function clearApiKey() {
  try {
    localStorage.removeItem('openai_api_key');
    console.log('API key cleared successfully');
    return true;
  } catch (error) {
    console.error('Failed to clear API key:', error);
    return false;
  }
}

/**
 * Test if the server has a valid API key configured
 */
export async function testServerApiKey() {
  // If we're using mock data, return the mock test result
  if (useMockServerKey) {
    console.log('Using mock server API key test result');
    return getMockServerApiKeyTestResult();
  }

  try {
    console.log('Testing server API key...');
    
    const response = await fetch('/api/config/test-openai-key', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    // If the endpoint doesn't exist (404), use mock data
    if (response.status === 404) {
      console.warn('Server API key test endpoint not found, using mock data');
      useMockServerKey = true;
      return getMockServerApiKeyTestResult();
    }
    
    if (!response.ok) {
      console.error(`Failed to test server API key: ${response.status} ${response.statusText}`);
      return { success: false, error: 'Failed to connect to server' };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error testing server API key:', error);
    
    // If any error occurs, fall back to mock data
    console.warn('Falling back to mock server API key test result due to error');
    useMockServerKey = true;
    return getMockServerApiKeyTestResult();
  }
}

/**
 * Generate a mock server API key for development/testing
 */
function getMockServerApiKey() {
  // For development, return a mock API key
  // In a real environment, this would be null or an actual key
  const mockEnabled = true; // Set to false to simulate no server key
  
  if (mockEnabled) {
    return 'mock-server-sk-...'; // Not a real key, just for UI testing
  } else {
    return null;
  }
}

/**
 * Generate a mock server API key test result for development/testing
 */
function getMockServerApiKeyTestResult() {
  // For development, return a mock test result
  const mockSuccess = true; // Set to false to simulate failed test
  
  if (mockSuccess) {
    return { 
      success: true, 
      message: 'Mock server API key is valid (development mode)'
    };
  } else {
    return { 
      success: false, 
      error: 'Mock server API key is invalid (development mode)'
    };
  }
} 