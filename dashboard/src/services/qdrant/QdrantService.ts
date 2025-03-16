/**
 * Service for interacting with the Qdrant vector database
 */
import axios from 'axios';
import { API_URL } from '../../api-config';

export class QdrantService {
  private apiBaseUrl: string;
  private useMockData: boolean = false; // Always disable mock data
  private debug: boolean = true;

  constructor() {
    // Use API_URL from config instead of hardcoding
    this.apiBaseUrl = API_URL;
    
    // Force disable mock data
    this.useMockData = false; 
    
    console.log(`QdrantService initialized with API URL: ${this.apiBaseUrl}`);
    console.log('Mock data is DISABLED - only real server data will be used');
    
    // Verify server connectivity on initialization
    this.checkServerConnection();
  }
  
  /**
   * Check server connection on startup
   */
  private async checkServerConnection() {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/health`);
      console.log('Qdrant server connection check:', response.status === 200 ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.warn('Could not connect to Qdrant server:', error);
      console.warn('Make sure the server is running at:', this.apiBaseUrl);
    }
  }

  /**
   * Search the Qdrant collection by vector similarity
   */
  public async search(collectionName: string, vector: number[], filter?: any, limit: number = 5): Promise<any[]> {
    try {
      if (!vector || !Array.isArray(vector)) {
        console.error('Invalid vector for search:', vector);
        return [];
      }
      
      if (this.debug) {
        console.log(`Searching collection: ${collectionName}`);
        console.log(`Vector length: ${vector.length}`);
        console.log(`Limit: ${limit}`);
      }
      
      // IMPORTANT: Mock data is completely disabled
      if (false) { // This condition will never execute
        console.log('MOCK DATA IS PERMANENTLY DISABLED');
      }
      
      // Try standard API endpoint first
      try {
        const url = `${this.apiBaseUrl}/api/qdrant/search`;
        
        // Get auth token if needed
        const token = this.getAuthToken();
        
        // Make the API call with proper payload
        const response = await axios.post(
          url,
          {
            collection_name: collectionName,
            vector: vector,
            filter: filter,
            limit: limit
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          }
        );
        
        // Process the response
        if (response.data && response.data.points) {
          console.log(`Search returned ${response.data.points.length} results from ${collectionName}`);
          return response.data.points;
        }
        
        // If no points, check other possible response formats
        if (response.data && Array.isArray(response.data)) {
          console.log(`Search returned ${response.data.length} results (array format) from ${collectionName}`);
          return response.data;
        }
        
        console.warn(`No results found in collection ${collectionName}`);
        return [];
      } catch (error) {
        // Try fallback endpoint if primary fails
        console.warn(`Error with primary search endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('Trying fallback search endpoint...');
        
        const fallbackUrl = `${this.apiBaseUrl}/api/ext/vector-search`;
        const token = this.getAuthToken();
        
        const response = await axios.post(
          fallbackUrl, 
          {
            collection: collectionName,
            vector: vector,
            limit: limit,
            filter: filter
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          }
        );
        
        if (response.data && Array.isArray(response.data)) {
          console.log(`Fallback search returned ${response.data.length} results from ${collectionName}`);
          return response.data;
        }
        
        if (response.data && response.data.results && Array.isArray(response.data.results)) {
          console.log(`Fallback search returned ${response.data.results.length} results from ${collectionName}`);
          return response.data.results;
        }
        
        console.warn('No results found with fallback endpoint');
        return [];
      }
    } catch (error) {
      console.error(`Error searching Qdrant collection ${collectionName}:`, error instanceof Error ? error.message : 'Unknown error');
      
      // No mock data - return empty array on failure
      return [];
    }
  }
  
  /**
   * Perform a text search in a collection
   */
  public async textSearch(
    collection: string,
    text: string,
    limit: number = 10,
    filter?: any
  ): Promise<any[]> {
    // Normalize collection names and try multiple variants
    const collectionNames = this.getAllPossibleCollectionNames(collection);
    console.log(`Performing text search for "${text}" in collections:`, collectionNames);
    
    if (this.useMockData) {
      console.log(`MOCK DATA: Simulating text search for "${text}"`);
      return this.generateMockResults();
    }
    
    // Try each collection name until we get results
    for (const normalizedCollection of collectionNames) {
      try {
        // Get authentication token
        const token = this.getAuthToken();
        
        // Use the direct server endpoint
        const endpoint = `${this.apiBaseUrl}/api/ext/text-search`;
        console.log(`Using text search endpoint: ${endpoint} for collection: ${normalizedCollection}`);
        
        const response = await axios.post(endpoint, {
          collection: normalizedCollection,
          text,
          limit,
          filter,
          includeMetadata: true
        }, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });

        if (response.data && Array.isArray(response.data)) {
          console.log(`Text search found ${response.data.length} results in collection ${normalizedCollection}`);
          // If we got results, return them
          if (response.data.length > 0) {
            return response.data;
          }
        } else {
          console.warn(`Unexpected response format from text search for ${normalizedCollection}:`, response.data);
        }
      } catch (error) {
        console.error(`Error in text search for collection ${normalizedCollection}:`, error);
      }
    }
    
    // If we get here, no results were found in any collection
    return [];
  }
  
  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    try {
      const token = localStorage.getItem('auth_token');
      return token;
    } catch (error) {
      console.warn('Error accessing localStorage:', error);
      return null;
    }
  }

  /**
   * Search for similar vectors in a collection
   * @param collectionName The collection name to search in
   * @param vector The query vector
   * @param limit Maximum number of results to return
   * @param filter Optional filter to apply to the search
   * @returns Array of search results
   */
  async searchSimilar(collectionName: string, vector: number[], limit: number = 10, filter?: any) {
    // Get all possible collection names to try
    const collectionNames = this.getAllPossibleCollectionNames(collectionName);
    console.log(`Searching for similar vectors in collections:`, collectionNames);
    
    if (this.useMockData) {
      console.log(`MOCK DATA: Simulating search for ${limit} similar vectors`);
      return this.generateMockResults();
    }

    // Try each possible collection name
    for (const normalizedCollection of collectionNames) {
      try {
        const token = this.getAuthToken();
        console.log(`Using vector search endpoint for collection: ${normalizedCollection}`);
        console.log(`Vector dimensions: ${vector.length}, First few values: ${vector.slice(0, 3).join(', ')}...`);
        
        // Use the normalized collection name in the request
        const response = await axios.post(
          `${this.apiBaseUrl}/api/ext/vector-search`,
          {
            collection: normalizedCollection,
            vector: vector,
            limit,
            filter,
            includeMetadata: true
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          }
        );

        if (response.data && Array.isArray(response.data)) {
          console.log(`Vector search found ${response.data.length} results in collection ${normalizedCollection}`);
          // If we got results, return them
          if (response.data.length > 0) {
            return response.data;
          }
        } else {
          console.warn(`Unexpected response format from vector search:`, response.data);
        }
      } catch (error) {
        console.error(`Error searching similar vectors in collection ${normalizedCollection}:`, error);
      }
    }
    
    // If we get here, no results were found in any collection
    console.warn(`No results found in any collection variants for: ${collectionName}`);
    return [];
  }

  /**
   * List all collections from the server
   */
  async listCollections(): Promise<string[]> {
    try {
      const token = this.getAuthToken();
      
      // First try the direct /api/collections endpoint
      try {
        const response = await axios.get(
          `${this.apiBaseUrl}/api/collections`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          }
        );
        
        if (response.data && Array.isArray(response.data)) {
          console.log(`Found ${response.data.length} collections:`, response.data);
          return response.data;
        }
      } catch (primaryError: any) {
        console.warn('Error using primary collections endpoint:', primaryError.message);
        
        // If first attempt fails, try the fallback endpoint using data sources
        try {
          const dataSources = await axios.get(
            `${this.apiBaseUrl}/api/data-sources`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              }
            }
          );
          
          if (dataSources.data && Array.isArray(dataSources.data)) {
            // Extract collection names from data sources
            const collectionNames = dataSources.data
              .filter(source => source.id)
              .map(source => `datasource_${source.id}`);
            
            console.log(`Derived ${collectionNames.length} collections from data sources`);
            return collectionNames;
          }
        } catch (fallbackError: any) {
          console.error('Fallback collection listing also failed:', fallbackError.message);
          throw primaryError; // Re-throw original error
        }
      }
      
      console.warn('Unexpected response format from collections endpoint');
      return [];
    } catch (error) {
      console.error('Error listing collections:', error);
      return [];
    }
  }
  
  /**
   * Check if a collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const collections = await this.listCollections();
      const exists = collections.includes(collectionName);
      
      if (!exists) {
        // Try additional variations of the collection name
        const variants = this.getAllPossibleCollectionNames(collectionName);
        for (const variant of variants) {
          if (collections.includes(variant)) {
            console.log(`Collection exists with variant name: ${variant}`);
            return true;
          }
        }
      }
      
      return exists;
    } catch (error) {
      console.error(`Error checking if collection exists: ${error}`);
      return false;
    }
  }

  /**
   * Get all possible collection naming formats
   */
  private getAllPossibleCollectionNames(collectionName: string): string[] {
    // Generate all possible collection name formats 
    const normalizeName = this.getNormalizedCollectionName(collectionName);
    
    // Build array of possible names to try
    return [
      normalizeName,
      normalizeName.toLowerCase(),
      normalizeName.replace(/-/g, '_'),
      normalizeName.replace(/[^a-zA-Z0-9]/g, '_'),
      collectionName // Original as fallback
    ];
  }

  /**
   * Normalize a collection name (use for backward compatibility)
   */
  getNormalizedCollectionName(collectionName: string): string {
    return collectionName;
  }

  /**
   * Get a sample of data points from a collection
   * @param collectionName The name of the collection to fetch from
   * @param limit Maximum number of data points to retrieve (default: 20)
   * @returns Promise<Array<{ id: string, payload: Record<string, any> }>>
   */
  async getCollectionPoints(collectionName: string, limit: number = 20): Promise<Array<{ id: string, payload: Record<string, any> }>> {
    // Try all possible collection name variants
    const collectionNames = this.getAllPossibleCollectionNames(collectionName);
    console.log(`Attempting to fetch data points from collections:`, collectionNames);
    
    // Never use mock data
    if (false) { // This condition will never be true
      console.log('MOCK DATA DISABLED - Using real data only');
    }
    
    // Build the request URL
    const url = `${this.apiBaseUrl}/api/qdrant/points`;
    
    try {
      // Make the API request
      const response = await axios.post(url, {
        collection_name: collectionName,
        limit
      });
      
      // Process the response
      if (response.data && response.data.points) {
        console.log(`Retrieved ${response.data.points.length} points from collection ${collectionName}`);
        return response.data.points;
      }
      
      console.warn(`No points found in collection ${collectionName}`);
      return [];
    } catch (error) {
      console.error(`Error getting collection points for ${collectionName}:`, error);
      // Try alternative collection names if the first one fails
      for (const altName of collectionNames.slice(1)) {
        try {
          console.log(`Trying alternative collection name: ${altName}`);
          const response = await axios.post(url, {
            collection_name: altName,
            limit
          });
          
          if (response.data && response.data.points) {
            console.log(`Retrieved ${response.data.points.length} points from collection ${altName}`);
            return response.data.points;
          }
        } catch (innerError) {
          console.error(`Error with alternative collection name ${altName}:`, innerError);
        }
      }
      
      // Return empty array if all attempts fail - never use mock data
      return [];
    }
  }

  /**
   * Generate mock results for testing
   * @deprecated This function is deprecated and should not be used
   */
  private generateMockResults(): any[] {
    console.warn('MOCK DATA GENERATION IS DEPRECATED AND DISABLED');
    // Return empty array instead of mock data
    return [];
  }

  /**
   * Run diagnostics to check what might be wrong with Qdrant connection
   * @returns Promise<Object> Diagnostic results
   */
  async runDiagnostics(collectionName?: string): Promise<{ 
    serverConnection: boolean; 
    collections: string[]; 
    errors: string[];
    suggestions: string[];
  }> {
    console.log('Running Qdrant diagnostics...');
    const result = {
      serverConnection: false,
      collections: [] as string[],
      errors: [] as string[],
      suggestions: [] as string[]
    };
    
    // Step 1: Check server connection
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/health`);
      result.serverConnection = response.status === 200;
      
      if (!result.serverConnection) {
        result.errors.push('Could not connect to Qdrant server');
        result.suggestions.push('Make sure the server is running and accessible at ' + this.apiBaseUrl);
      }
    } catch (error: any) {
      result.errors.push(`Server connection failed: ${error.message || 'Unknown error'}`);
      result.suggestions.push('Check if the server is running at ' + this.apiBaseUrl);
      result.suggestions.push('Verify network connectivity and firewall settings');
      return result; // Return early if we can't even connect
    }
    
    // Step 2: List collections
    try {
      const collections = await this.listCollections();
      result.collections = collections;
      
      if (collections.length === 0) {
        result.errors.push('No collections found on the server');
        result.suggestions.push('Make sure data has been properly indexed into Qdrant');
      }
    } catch (error: any) {
      result.errors.push(`Failed to list collections: ${error.message || 'Unknown error'}`);
      result.suggestions.push('Check if you have permission to list collections');
    }
    
    // Step 3: If a specific collection is provided, check it
    if (collectionName) {
      const allVariants = this.getAllPossibleCollectionNames(collectionName);
      
      let collectionFound = false;
      // Check each variant
      for (const variant of allVariants) {
        if (result.collections.includes(variant)) {
          collectionFound = true;
          console.log(`Collection found with name: ${variant}`);
          
          // Try to get some sample points
          try {
            const points = await this.getCollectionPoints(variant, 1);
            if (points.length === 0) {
              result.errors.push(`Collection "${variant}" exists but appears to be empty`);
              result.suggestions.push('Verify that data has been properly indexed into this collection');
            } else {
              console.log(`Collection "${variant}" contains data!`);
              result.suggestions.push(`Use collection name "${variant}" for queries`);
            }
          } catch (error: any) {
            result.errors.push(`Failed to get points from collection "${variant}": ${error.message || 'Unknown error'}`);
          }
          
          break;
        }
      }
      
      if (!collectionFound) {
        result.errors.push(`Collection "${collectionName}" not found (tried variants: ${allVariants.join(', ')})`);
        result.suggestions.push('Check the collection name is correct');
        result.suggestions.push('Make sure the collection has been created and data has been indexed');
      }
    }
    
    // Step 4: Provide general suggestions
    if (result.errors.length === 0) {
      result.suggestions.push('Qdrant connection appears to be working correctly');
    } else {
      result.suggestions.push('Check server logs for more information');
      result.suggestions.push('Try reindexing your data if collections exist but queries return no results');
    }
    
    console.log('Qdrant diagnostics complete:', result);
    return result;
  }
} 