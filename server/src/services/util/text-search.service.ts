import { createServiceLogger } from '../../common/utils/logger-factory';
import { injectable } from 'inversify';

/**
 * Service for handling text search functionality
 */
@injectable()
export class TextSearchService {
  private readonly logger = createServiceLogger('TextSearchService');
  private readonly apiUrl: string;
  private readonly useMockData: boolean;

  constructor() {
    // Get config values with fallbacks
    this.apiUrl = process.env.TEXT_SEARCH_API_URL || 'http://localhost:3001';
    this.useMockData = process.env.USE_MOCK_DATA === 'true' || false;
    
    this.logger.info(`TextSearch initialized with API URL: ${this.apiUrl}`);
    this.logger.info(`Mock data is ${this.useMockData ? 'ENABLED' : 'DISABLED'} - ${this.useMockData ? 'using mock data' : 'only real server data will be used'}`);
  }

  /**
   * Search for text in documents
   * @param query Search query
   * @param options Search options
   * @returns Search results
   */
  async search(query: string, options: any = {}): Promise<any[]> {
    try {
      this.logger.debug(`Performing text search for: "${query}"`, { options });
      
      if (this.useMockData) {
        return this.getMockSearchResults(query);
      }
      
      // In a real implementation, we would call an external search API here
      // For now, return an empty array
      return [];
    } catch (error) {
      this.logger.error(`Error during text search: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get mock search results for testing
   * @param query Search query
   * @returns Mock search results
   */
  private getMockSearchResults(query: string): any[] {
    this.logger.debug(`Generating mock search results for: "${query}"`);
    
    // Return mock data for testing
    return [
      {
        id: '1',
        content: `This is a mock search result for "${query}"`,
        score: 0.95,
        source: 'mock-data'
      }
    ];
  }
} 