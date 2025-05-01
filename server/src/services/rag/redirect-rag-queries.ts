import { RagIntegrationService } from '../rag/integration.service';
import { RagQueryResult } from '../vector/vector.interfaces'; // Import the correct interface

// Remove singleton instance fetching
// const ragIntegrationService = RagIntegrationService.getInstance();

/**
 * Interface for RAG response (redefine or import if needed, ensure consistency)
 */
interface RagResponse extends RagQueryResult { // Extend the official interface
  // Potentially add frontend specific fields if needed, but prefer using metadata
}

/**
 * Redirects RAG queries to the integration service.
 * NOTE: This function should ideally be replaced by a Controller or Service method using DI.
 * @param ragIntegrationService - The instance of RagIntegrationService (passed in).
 * @param query - The user query.
 * @param dataSourceIds - Data source IDs.
 */
export const processRagQueryWithMetadata = async (
  ragIntegrationService: RagIntegrationService, // Accept service instance
  query: string, 
  dataSourceIds: string[] | number[]
): Promise<RagResponse> => {
  console.log(`Processing query: "${query}" with data sources: ${dataSourceIds.join(', ')}`);
  
  try {
    // Process the query using the passed-in service instance
    const response = await ragIntegrationService.processQuery(query, dataSourceIds);
    
    // Ensure metadata object exists and add fields
    const metadata = response.metadata || {};
    metadata.isRagResponse = true;
    metadata.dataSourceIds = dataSourceIds.map(id => String(id));
    
    // Construct the final response adhering to RagResponse (which extends RagQueryResult)
    const finalResponse: RagResponse = {
        ...response,
        metadata: metadata
    };
    
    console.log(`Query processing complete with ${finalResponse.sources?.length || 0} sources`);
    return finalResponse;
  } catch (error) {
    console.error(`Error processing RAG query via processRagQueryWithMetadata:`, error);
    // Return a structure consistent with RagResponse
    return {
      content: `Sorry, there was an error processing your query. Please try again or rephrase your question. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      sources: [],
      metadata: { // Include metadata even in error cases
          isRagResponse: true,
          dataSourceIds: dataSourceIds.map(id => String(id)),
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now(), // Add current timestamp as processing time
          retrievalMethod: 'error', // Indicate error in retrieval method
          modelUsed: 'none', // No model was successfully used
          queryAnalysis: { // Add minimal query analysis
            complexity: 'unknown',
            intent: 'unknown',
            isAnalytical: false
          }
      }
    };
  }
}; 

// Remove the old export if it exists
// export const redirectRagQueries = ... 