/**
 * Types for Text Search
 */
export interface RagTextResponse {
  id: string;
  score: number;
  text: string;
  content: string;
  metadata: any;
}

/**
 * Search filter interface for filtering results
 */
export interface SearchFilter {
  [key: string]: any;
}

/**
 * Service for text-based search functionality
 */
export class TextSearch {
  private apiBaseUrl: string;
  private defaultLimit: number;

  // Constructor to ensure we never use mock data
  constructor() {
    // Always use the direct server connection
    this.apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    console.log(`TextSearch initialized with API URL: ${this.apiBaseUrl}`);
    console.log('Mock data is DISABLED - only real server data will be used');
    this.defaultLimit = 50;
  }

  /**
   * Perform a text search in the API
   */
  public async searchByText(
    query: string,
    dataSourceId: string,
    options: {
      limit?: number;
      filter?: SearchFilter;
      conversationId?: string;
      useRag?: boolean;
      documentId?: string;
    } = {}
  ): Promise<RagTextResponse[]> {
    try {
      console.log(`[TextSearch] Searching for query: "${query}"`);

      // Ensure consistent collection naming - standardize on datasource_ prefix
      const normalizedCollectionName = this.normalizeCollectionName(dataSourceId);
      console.log(`[TextSearch] Using normalized collection name: ${normalizedCollectionName}`);
      
      // Try text search with normalized collection name
      try {        
        // Build the request body
        const body: any = {
          collection: normalizedCollectionName,
          text: query,
          limit: options.limit || this.defaultLimit
        };
        
        // Add filter if provided
        if (options.filter) {
          body.filter = options.filter;
        }
        
        // Add document ID if provided and not 'none'
        if (options.documentId && options.documentId !== 'none') {
          body.documentId = options.documentId;
        }
        
        try {
          const response = await fetch(`${this.apiBaseUrl}/api/ext/text-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.getAuthToken()}`,
            },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            const data = await response.json();
            
            console.log(`[TextSearch] Found ${data.length} results`);
            return this.formatResponse(data);
          } else {
            const errorText = await response.text();
            console.error(`[TextSearch] API error (${response.status}): ${errorText}`);
            
            // If we get a collection doesn't exist error, try the next sequential ID
            if (errorText.includes("doesn't exist") && normalizedCollectionName.startsWith('datasource_')) {
              // Extract number part from datasource_XXX
              const idPart = normalizedCollectionName.substring(11); // Remove 'datasource_'
              if (!isNaN(parseInt(idPart))) {
                const nextId = (parseInt(idPart) + 1).toString();
                const nextCollectionName = `datasource_${nextId}`;
                
                console.log(`[TextSearch] First collection failed, trying next sequential collection: ${nextCollectionName}`);
                
                // Create a new body with the next collection name
                const nextBody = {
                  ...body,
                  collection: nextCollectionName
                };
                
                const nextResponse = await fetch(`${this.apiBaseUrl}/api/ext/text-search`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                  },
                  body: JSON.stringify(nextBody),
                });
                
                if (nextResponse.ok) {
                  const nextData = await nextResponse.json();
                  console.log(`[TextSearch] Found ${nextData.length} results in next sequential collection`);
                  return this.formatResponse(nextData);
                } else {
                  console.error(`[TextSearch] Second attempt also failed: ${await nextResponse.text()}`);
                }
              }
            }
            
            return [];
          }
        } catch (error) {
          console.error('[TextSearch] Fetch error:', error);
          return [];
        }
      } catch (error) {
        console.error(`[TextSearch] Error during text search:`, error);
        return [];
      }
    } catch (error) {
      console.error('[TextSearch] Search error:', error);
      return [];
    }
  }

  /**
   * Helper method to normalize collection names
   */
  private normalizeCollectionName(dataSourceId: string): string {
    try {
      console.log(`[TextSearch] Normalizing collection name for ID: ${dataSourceId}`);
      
      // Extract the ID if it's already prefixed
      let unprefixedId = dataSourceId;
      if (dataSourceId.startsWith('datasource_')) {
        unprefixedId = dataSourceId.substring(11);
        console.log(`[TextSearch] ID is already prefixed, extracted part: ${unprefixedId}`);
      }
      
      // First, check if we have a UUID-style ID, which could be the internal metadata ID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(unprefixedId)) {
        console.log(`[TextSearch] ID is a UUID format: ${unprefixedId}`);
        return `datasource_${unprefixedId}`;
      }
      
      // Parse to number if possible
      const numericId = parseInt(unprefixedId, 10);
      
      // If numeric ID, try to fetch the internal metadata ID first
      if (!isNaN(numericId)) {
        // For fallback, always return the numeric ID format
        let collectionName = `datasource_${numericId}`;
        
        try {
          // Attempt to check if we have this collection in the storage
          if (window.localStorage) {
            const storedDataSources = JSON.parse(window.localStorage.getItem('dataSources') || '[]');
            console.log(`[TextSearch] Found ${storedDataSources.length} data sources in localStorage`);
            
            // Debug what's in localStorage
            storedDataSources.forEach((ds: any, index: number) => {
              console.log(`[TextSearch] Data source ${index}: ID=${ds.id}, Type=${ds.type}, MetadataID=${ds.metadata?.id || 'none'}`);
            });
            
            // First check by exact numeric ID
            let matchedSource = storedDataSources.find((ds: any) => {
              // Handle both string and numeric IDs
              return (typeof ds.id === 'number' && ds.id === numericId) || 
                     (typeof ds.id === 'string' && parseInt(ds.id, 10) === numericId);
            });
            
            // If not found by ID, check metadata
            if (!matchedSource && storedDataSources.length > 0) {
              matchedSource = storedDataSources.find((ds: any) => 
                ds.metadata && ds.metadata.datasourceId === numericId.toString()
              );
            }
            
            if (matchedSource?.metadata?.id) {
              console.log(`[TextSearch] Found internal ID ${matchedSource.metadata.id} for datasource ${numericId}`);
              collectionName = `datasource_${matchedSource.metadata.id}`;
            } else {
              console.log(`[TextSearch] No internal ID found for datasource ${numericId} in localStorage - using default collection name`);
            }
          } else {
            console.log(`[TextSearch] localStorage not available`);
          }
        } catch (err) {
          console.warn(`[TextSearch] Error checking for internal ID:`, err);
        }
        
        return collectionName;
      }
      
      // Default fallback - just return with prefix
      console.log(`[TextSearch] Using default normalization for: ${unprefixedId}`);
      return `datasource_${unprefixedId}`;
    } catch (error) {
      console.error(`[TextSearch] Error normalizing collection name:`, error);
      // Return the original ID with prefix as fallback
      return dataSourceId.startsWith('datasource_') ? dataSourceId : `datasource_${dataSourceId}`;
    }
  }

  /**
   * Get the authentication token from sessionStorage
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

  private formatResponse(data: any[]): RagTextResponse[] {
    return data.map(item => ({
      id: `rag-response-${Date.now()}`,
              score: 1.0,
      text: item.text,
      content: item.text,
          metadata: {
        sources: item.sources,
        isRagResponse: true,
        query: item.query
      }
    }));
  }
} 