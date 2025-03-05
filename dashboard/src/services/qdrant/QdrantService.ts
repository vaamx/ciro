/**
 * Service for interacting with the Qdrant vector database
 */
import axios from 'axios';

export class QdrantService {
  private apiBaseUrl: string;
  private useMockData: boolean;

  constructor() {
    // Always use the direct server connection
    this.apiBaseUrl = 'http://localhost:3001';
    this.useMockData = false; // Disable mock data by default
    console.log(`QdrantService initialized with API URL: ${this.apiBaseUrl}`);
    console.log('Mock data is DISABLED - only real server data will be used');
  }

  /**
   * Search for similar vectors in a collection
   * This is kept for backward compatibility - redirects to searchSimilar
   */
  public async search(
    collection: string,
    vector: number[],
    limit: number = 10,
    filter?: any
  ): Promise<any[]> {
    // Just call the new searchSimilar method
    return this.searchSimilar(collection, vector, limit, filter);
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
    // Normalize collection name
    const normalizedCollection = this.getNormalizedCollectionName(collection);
    console.log(`Performing text search in collection ${normalizedCollection} for "${text}"`);
    
    if (this.useMockData) {
      console.log(`MOCK DATA: Simulating text search for "${text}" in ${normalizedCollection}`);
      return this.generateMockResults(limit);
    }
    
    try {
      // Get authentication token
      const token = this.getAuthToken();
      
      // Use the direct server endpoint
      const endpoint = `${this.apiBaseUrl}/api/ext/text-search`;
      console.log(`Using text search endpoint: ${endpoint}`);
      
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
        return response.data;
      } else {
        console.warn(`Unexpected response format from text search:`, response.data);
        return [];
      }
    } catch (error) {
      console.error(`Error in text search: ${error}`);
      return [];
    }
  }
  
  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      // Check multiple possible token storage keys
      return localStorage.getItem('auth_token') || 
             localStorage.getItem('token') || 
             localStorage.getItem('jwt_token') || 
             null;
    }
    return null;
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
    // Get the correct normalized collection name as it would be stored on the server
    const normalizedCollection = this.getNormalizedCollectionName(collectionName);
    console.log(`Searching for similar vectors in collection ${collectionName} (normalized to ${normalizedCollection})`);
    
    if (this.useMockData) {
      console.log(`MOCK DATA: Simulating search for ${limit} similar vectors in ${normalizedCollection}`);
      return this.generateMockResults(limit);
    }

    // First attempt with normalized collection name
    try {
      const token = this.getAuthToken();
      console.log(`Using vector search endpoint: ${this.apiBaseUrl}/api/ext/vector-search`);
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
        if (response.data.length === 0) {
          console.log(`No results found in first attempt, will try alternative collection names`);
        } else {
          return response.data;
        }
      } else {
        console.warn(`Unexpected response format from vector search:`, response.data);
      }
    } catch (error: any) {
      console.error(`Error searching similar vectors in collection ${normalizedCollection}:`, error);
      console.log(`Will try alternative collection names`);
    }
    
    // If we get here, either the first attempt returned no results or failed
    // Try to extract a possible UUID from localStorage based on the collection name
    let uuidFromLocalStorage = null;
    let isCsvDataSource = false;
    try {
      // Remove datasource_ prefix if present
      const rawId = collectionName.replace('datasource_', '');
      const storedDataSources = localStorage.getItem('dataSources');
      
      if (storedDataSources) {
        const dataSources = JSON.parse(storedDataSources);
        
        // Try to find by ID
        const matchedSource = dataSources.find((ds: any) => 
          ds.id === rawId || 
          (typeof ds.id === 'string' && ds.id === rawId) ||
          (typeof ds.id === 'number' && ds.id === parseInt(rawId, 10)) ||
          (typeof ds.id === 'string' && parseInt(ds.id, 10) === parseInt(rawId, 10))
        );
        
        if (matchedSource) {
          // Check if this is a CSV data source
          isCsvDataSource = matchedSource.type === 'csv';
          console.log(`Data source type: ${matchedSource.type}, Is CSV: ${isCsvDataSource}`);
          
          if (matchedSource.metadata && matchedSource.metadata.id) {
            uuidFromLocalStorage = matchedSource.metadata.id;
            console.log(`Found UUID ${uuidFromLocalStorage} for ID ${rawId} in localStorage`);
          }
        }
      }
    } catch (err) {
      console.error('Error parsing localStorage for UUIDs:', err);
    }
    
    // Create a list of alternative names to try
    const alternativeNames = [
      normalizedCollection,
      `datasource_${collectionName.replace('datasource_', '')}`,
      `datasource_${collectionName}`,
    ];
    
    // Add UUID-based alternatives if available
    if (uuidFromLocalStorage) {
      alternativeNames.push(`datasource_${uuidFromLocalStorage}`);
    }
    
    // Try to extract the UUID if the collection name is complex
    const uuidMatch = collectionName.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (uuidMatch) {
      alternativeNames.push(`datasource_${uuidMatch[1]}`);
    }
    
    // Add attempt with just the original name
    if (!alternativeNames.includes(collectionName)) {
      alternativeNames.push(collectionName);
    }
    
    // Special handling for CSV files - add the numeric ID format as high priority
    if (isCsvDataSource) {
      const numericId = collectionName.replace('datasource_', '');
      if (!isNaN(parseInt(numericId, 10))) {
        console.log(`Adding CSV-specific format with numeric ID: datasource_${numericId}`);
        // Add this at the beginning of the array to try it first
        alternativeNames.unshift(`datasource_${numericId}`);
      }
    }
    
    // Try each alternative name
    for (const altName of alternativeNames) {
      if (altName === normalizedCollection) continue; // Skip the one we already tried
      
      try {
        console.log(`Trying alternative collection name: ${altName}`);
        const token = this.getAuthToken();
        
        const response = await axios.post(
          `${this.apiBaseUrl}/api/ext/vector-search`,
          {
            collection: altName,
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
          console.log(`Vector search found ${response.data.length} results with alternative name ${altName}`);
          if (response.data.length > 0) {
            return response.data;
          }
        }
      } catch (err: any) {
        console.log(`Alternative name ${altName} also failed:`, err.message);
        // Continue to the next alternative
      }
    }
    
    // If all attempts failed, return empty array
    console.warn(`All vector search attempts failed for collection ${collectionName}`);
    return [];
  }

  /**
   * Get the normalized collection name as it would be on the server
   * This should match the server-side normalization logic
   */
  private getNormalizedCollectionName(collectionName: string): string {
    console.log(`Normalizing collection name for ID: ${collectionName}`);
    
    // Make sure the collection name has the 'datasource_' prefix
    const prefixedCollection = collectionName.startsWith('datasource_') 
      ? collectionName 
      : `datasource_${collectionName}`;
    
    // Extract the ID part after the prefix
    const idPart = prefixedCollection.replace('datasource_', '');
    
    // If it already looks like a UUID (contains hyphens), return as is
    if (idPart.includes('-')) {
      console.log(`Collection name is already in UUID format: ${prefixedCollection}`);
      return prefixedCollection;
    }
    
    // Try to map the ID to a UUID using localStorage data sources
    try {
      const storedDataSources = localStorage.getItem('dataSources');
      if (storedDataSources) {
        const dataSources = JSON.parse(storedDataSources);
        console.log(`Found ${dataSources.length} data sources in localStorage`);
        
        // Log each data source for debugging
        dataSources.forEach((ds: any, index: number) => {
          console.log(`Data source ${index}: ID=${ds.id}, Type=${ds.type}, MetadataID=${ds.metadata?.id || 'N/A'}`);
        });
        
        // First try exact match with numeric ID
        let matchedSource = dataSources.find((ds: any) => ds.id === idPart || ds.id === parseInt(idPart, 10));
        
        // If not found with exact match, try parsing as numeric
        if (!matchedSource && !isNaN(parseInt(idPart, 10))) {
          const numericId = parseInt(idPart, 10);
          matchedSource = dataSources.find((ds: any) => 
            (typeof ds.id === 'number' && ds.id === numericId) ||
            (typeof ds.id === 'string' && parseInt(ds.id, 10) === numericId)
          );
        }
        
        // Special handling for CSV files
        if (matchedSource && matchedSource.type === 'csv') {
          console.log(`Found CSV data source with ID ${matchedSource.id}`);
          
          // Check multiple potential collection name formats for CSVs
          if (matchedSource.metadata && matchedSource.metadata.id) {
            // Primary format: Use the UUID from metadata
            const normalizedName = `datasource_${matchedSource.metadata.id}`;
            console.log(`Using metadata UUID for CSV collection: ${normalizedName}`);
            return normalizedName;
          } else {
            // For CSV files, if no metadata.id, just return with numeric ID
            console.log(`Using numeric ID for CSV: datasource_${matchedSource.id}`);
            return `datasource_${matchedSource.id}`;
          }
        }
        
        if (matchedSource && matchedSource.metadata && matchedSource.metadata.id) {
          // Found the internal UUID for this data source
          const normalizedName = `datasource_${matchedSource.metadata.id}`;
          console.log(`Mapped collection ID ${idPart} to internal ID: ${matchedSource.metadata.id}`);
          console.log(`Using normalized collection name: ${normalizedName}`);
          return normalizedName;
        }
        
        // If no match was found by ID, try to find by metadata.id
        if (!matchedSource) {
          matchedSource = dataSources.find((ds: any) => 
            ds.metadata && (ds.metadata.id === idPart)
          );
          
          if (matchedSource) {
            console.log(`Found collection directly by metadata.id: ${idPart}`);
            return prefixedCollection;
          }
        }
      }
    } catch (err) {
      console.error('Error parsing data sources from localStorage:', err);
    }
    
    // If all else fails, return the original prefixed collection name
    console.log(`No mapping found in localStorage, using default: ${prefixedCollection}`);
    return prefixedCollection;
  }

  /**
   * Generate mock search results for testing
   */
  private generateMockResults(count: number) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push({
        id: `mock-id-${i}`,
        score: 0.95 - (i * 0.05),
        payload: {
          content: `This is mock content for result ${i}`,
          metadata: {
            source: `mock-source-${i}.txt`,
            page: i + 1,
            timestamp: new Date().toISOString()
          }
        }
      });
    }
    return results;
  }

  /**
   * Get a sample of data points from a collection
   * @param collectionName The name of the collection to fetch from
   * @param limit Maximum number of data points to retrieve (default: 20)
   * @returns Promise<Array<{ id: string, payload: Record<string, any> }>>
   */
  async getCollectionPoints(collectionName: string, limit: number = 20): Promise<Array<{ id: string, payload: Record<string, any> }>> {
    // Normalize collection name
    const normalizedCollection = this.getNormalizedCollectionName(collectionName);
    console.log(`Fetching data points from collection ${collectionName} (normalized to ${normalizedCollection})`);
    
    if (this.useMockData) {
      console.log(`MOCK DATA: Simulating collection points for ${normalizedCollection}`);
      return this.generateMockResults(limit).map(result => ({
        id: result.id,
        payload: result.payload || {}
      }));
    }

    try {
      const token = this.getAuthToken();
      // Create a dummy vector of appropriate dimensions for a simple closest-points query
      // This is a workaround since we don't have a direct "get all points" endpoint
      // We use a zero vector to essentially get random points from the collection
      const dummyVector = Array(1536).fill(0);
      
      const response = await axios.post(
        `${this.apiBaseUrl}/api/ext/vector-search`,
        {
          collection: normalizedCollection,
          vector: dummyVector,
          limit,
          includeMetadata: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        }
      );
      
      if (response.data && response.data.results && Array.isArray(response.data.results)) {
        console.log(`Retrieved ${response.data.results.length} points from collection ${normalizedCollection}`);
        return response.data.results.map((item: any) => ({
          id: item.id,
          payload: item.payload || {}
        }));
      } else {
        console.warn(`Unexpected response format from ext/vector-search:`, response.data);
        return [];
      }
    } catch (error: any) {
      console.error(`Error fetching collection points from ${normalizedCollection}:`, error);
      return [];
    }
  }
} 