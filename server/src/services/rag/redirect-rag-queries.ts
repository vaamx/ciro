import { RagIntegrationService } from '../rag/integration.service';

// Get singleton instance
const ragIntegrationService = RagIntegrationService.getInstance();

/**
 * Interface for RAG response that includes metadata
 */
interface RagResponse {
  sources: any[];
  content: string;
  model?: string;
  analysis?: {
    steps: string[];
    summary: string;
  };
  metadata?: {
    isRagResponse?: boolean;
    dataSourceIds?: string[];
    [key: string]: any;
  };
}

/**
 * Redirects RAG queries to appropriate handlers
 * Updated to use the modular RAG implementation
 */
export const redirectRagQueries = async (query: string, dataSourceIds: string[] | number[]): Promise<RagResponse> => {
  console.log(`Processing query: "${query}" with data sources: ${dataSourceIds.join(', ')}`);
  
  try {
    // Process the query using the new modular RAG integration service
    const response = await ragIntegrationService.processQuery(query, dataSourceIds) as RagResponse;
    
    // Add a metadata field to help the frontend know this is a RAG response
    if (response && !response.metadata) {
      response.metadata = {
        isRagResponse: true,
        dataSourceIds: dataSourceIds.map(id => String(id))
      };
    } else if (response && response.metadata) {
      response.metadata.isRagResponse = true;
      response.metadata.dataSourceIds = dataSourceIds.map(id => String(id));
    }
    
    console.log(`Query processing complete with ${response?.sources?.length || 0} sources`);
    return response;
  } catch (error) {
    console.error(`Error in redirectRagQueries:`, error);
    return {
      content: `Sorry, there was an error processing your query. Please try again or rephrase your question. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      sources: [],
      model: 'fallback'
    };
  }
}; 