import { RagService } from './rag.service';

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
 * Modified to use a universal approach without special cases for specific domains
 */
export const redirectRagQueries = async (query: string, dataSourceIds: string[] | number[]): Promise<RagResponse> => {
  const ragService = new RagService();
  
  console.log(`Processing universal query: "${query}" with data sources: ${dataSourceIds.join(', ')}`);
  
  try {
    // Process the query with no special handling - let the universal processor handle all cases
    const response = await ragService.processQuery(query, dataSourceIds) as RagResponse;
    
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
      content: `Sorry, there was an error processing your query. Please try again or rephrase your question. Error: ${error.message}`,
      sources: [],
      model: 'fallback'
    };
  }
}; 