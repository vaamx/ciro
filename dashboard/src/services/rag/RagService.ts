import { OpenAIService } from '../openai/OpenAIService';
import { QdrantService } from '../qdrant/QdrantService';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { UniversalDataHandler } from './DirectExcelHandler';
import { DataSourceType } from '../processors/UniversalDataProcessor';

/**
 * Document interface for RAG
 */
interface Document {
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Structured Analysis Response for visualization
 */
interface StructuredAnalysisResponse {
  summary: string;
  steps: Array<{
    id: string;
    type: string;
    description: string;
    content?: string;
    order: number;
    insights?: string[];
  }>;
  insights: string[];
  visualization: any | null;
}

/**
 * RAG Service for answering questions from knowledge base
 */
export class RagService {
  private openaiService: OpenAIService;
  private qdrantService: QdrantService;
  private universalDataHandler: UniversalDataHandler;
  
  constructor() {
    this.openaiService = new OpenAIService();
    this.qdrantService = new QdrantService();
    this.universalDataHandler = new UniversalDataHandler();
  }
  
  /**
   * Query Qdrant collections for relevant data and generate a response
   * 
   * @param question The user's question
   * @param dataSources Array of data source IDs to query
   * @returns The response with content and metadata
   */
  public async query(
    question: string, 
    dataSources: string[]
  ): Promise<any> {
    console.log('RAG query:', { question, dataSources });
    
    try {
      // Check for empty question
      if (!question.trim()) {
        return {
          content: "Please provide a question to search for information.",
          metadata: { error: 'empty_query' }
        };
      }
      
      // Ensure we have data sources
      if (!dataSources || dataSources.length === 0) {
        console.error('No data sources provided for RAG query');
        return {
          content: "I need to be connected to a data source to answer questions. Please select a data source from the knowledge base.",
          metadata: { error: 'no_data_sources' }
        };
      }
      
      // Detect entities in the question to improve search
      let entities: string[] = [];
      try {
        // Use simple keyword extraction as a fallback
        entities = question.split(' ')
          .filter(word => word.length > 3)
          .map(word => word.replace(/[^\w\s]/g, ''))
          .filter(word => word.length > 3);
        console.log('Detected entities:', entities);
      } catch (error) {
        console.warn('Error detecting entities:', error);
        // Continue anyway - entities are helpful but not required
      }
      
      // Process each data source
      let allDocuments: Document[] = [];
      let collectionNames: string[] = [];
      let documentTypes: string[] = [];
      
      // Process each data source to get relevant documents
      for (const dataSourceId of dataSources) {
        try {
          console.log(`Processing data source ID: ${dataSourceId}`);
          // Normalize collection name - important for Qdrant
          const collectionName = this.normalizeCollectionName(dataSourceId);
          collectionNames.push(collectionName);
          
          // Get documents from vector search
          const documents = await this.vectorSearch(question, dataSourceId);
          
          if (documents && documents.length > 0) {
            console.log(`Found ${documents.length} documents in ${collectionName}`);
            allDocuments = [...allDocuments, ...documents];
            
            // Track document types
            if (documents[0]?.metadata?.dataSourceType) {
              documentTypes.push(documents[0].metadata.dataSourceType);
            }
          } else {
            console.warn(`No documents found in collection ${collectionName}`);
          }
        } catch (error) {
          console.error(`Error processing data source ${dataSourceId}:`, error);
        }
      }
      
      // If we couldn't find any documents, try a more flexible approach
      if (allDocuments.length === 0) {
        console.log('No documents found with vector search, trying text search');
        allDocuments = await this.fallbackTextSearch(question, dataSources);
      }
      
      // Process the documents to generate a response
      if (allDocuments.length > 0) {
        console.log(`Processing ${allDocuments.length} documents to generate response`);
        
        // Determine the dominant document type for appropriate response formatting
        const documentType = this.detectDocumentType(documentTypes, allDocuments);
        
        // Generate the response with the documents
        const response = await this.generateResponseWithDocuments(question, allDocuments, documentType);
        
        // Enhance metadata for visualization
        const enhancedMetadata = {
          ...response.metadata,
          collectionNames,
          dataSourceIds: dataSources,
          dataSourceType: documentType || 'qdrant',
          isQdrantResponse: true,
          useEnhancedVisualization: true,
          hasVisualization: true
        };
        
        // If there's structured analysis, add it to the metadata
        if (response.structuredResponse) {
          enhancedMetadata.structuredResponse = response.structuredResponse;
          enhancedMetadata.steps = response.structuredResponse.steps;
          
          // Create visualization data from the structured response if possible
          if (response.structuredResponse.visualization) {
            enhancedMetadata.visualizationData = response.structuredResponse.visualization;
          } else {
            // Try to extract visualization data from documents
            const visData = this.extractVisualizationData(allDocuments, documentType);
            if (visData) {
              enhancedMetadata.visualizationData = visData;
            }
          }
        }
        
        return {
          content: response.content,
          metadata: enhancedMetadata
        };
      }
      
      // If we still couldn't find any documents, generate a fallback response
      console.log('No documents found, generating fallback response');
      return {
        content: `I searched through the data sources but couldn't find information related to "${question}". Could you try rephrasing your question or selecting a different data source?`,
        metadata: {
          error: 'no_documents_found',
          dataSourceIds: dataSources
        }
      };
      
    } catch (error: any) {
      console.error('Error in RAG query:', error);
      return {
        content: `I encountered an error while processing your question: ${error.message || 'Unknown error'}`,
        metadata: {
          error: true,
          errorMessage: error.message
        }
      };
    }
  }
  
  /**
   * Process a query with data sources
   */
  public async processQuery(
    query: string, 
    dataSourceIds: string[] | number[]
  ): Promise<any> {
    console.log(`Processing query "${query}" with data sources:`, dataSourceIds);
    
    if (!dataSourceIds || dataSourceIds.length === 0) {
      return {
        content: "I need access to a data source to answer that question. Please select a data source.",
        metadata: {
          error: 'no_data_source'
        }
      };
    }
    
    // Convert all IDs to strings for consistency
    const dataSourceIdStrs = dataSourceIds.map(id => String(id));
    
    // Track total processing time for metrics
    const startTime = Date.now();
    
    try {
      // Get all documents for each data source
      const allDocuments: Document[] = [];
      const documentTypes: string[] = [];
      
      // Check if this is an analytical query that needs special handling
      const isAnalyticalQuery = this.universalDataHandler.isAnalyticalQuery(query);
      console.log(`Query "${query}" is analytical: ${isAnalyticalQuery}`);
      
      // Iterate through each data source to gather documents
      for (const dataSourceId of dataSourceIdStrs) {
        try {
          console.log(`Searching in data source: ${dataSourceId}`);
          const documents = await this.vectorSearch(query, dataSourceId, 20);
          
          // Skip sources that return no documents
          if (!documents || documents.length === 0) {
            console.log(`No documents found for data source ${dataSourceId}`);
            continue;
          }
          
          allDocuments.push(...documents);
          
          // Detect document type for each source
          const docType = this.detectDataSourceType(dataSourceId, documents);
          documentTypes.push(docType); 
          
          console.log(`Found ${documents.length} documents for ${dataSourceId}, type: ${docType}`);
        } catch (error) {
          console.error(`Error searching data source ${dataSourceId}:`, error);
        }
      }
      
      // If we couldn't find any documents, try text search as fallback
      if (allDocuments.length === 0) {
        console.log('No documents found from vector search, trying text search fallback');
        const textSearchDocs = await this.fallbackTextSearch(query, dataSourceIdStrs);
        if (textSearchDocs && textSearchDocs.length > 0) {
          allDocuments.push(...textSearchDocs);
          
          // Also detect type for text search results
          for (const dataSourceId of dataSourceIdStrs) {
            const docType = this.detectDataSourceType(dataSourceId, textSearchDocs);
            documentTypes.push(docType);
          }
        }
      }
      
      // If still no documents found, return error
      if (allDocuments.length === 0) {
        return {
          content: "I couldn't find any relevant information to answer your question. Please try rephrasing or selecting a different data source.",
          metadata: {
            error: 'no_results',
            processingTime: Date.now() - startTime
          }
        };
      }
      
      // Determine the document type for response generation
      let documentType = 'qdrant';
      if (documentTypes.length > 0) {
        // If Excel is among the types, prioritize it
        if (documentTypes.includes('excel')) {
          documentType = 'excel';
        } else {
          documentType = this.detectDocumentType(documentTypes, allDocuments);
        }
      }
      
      console.log(`Using document type for response: ${documentType}`);
      
      // For Excel files, use the specialized handler
      if (documentType === 'excel' && isAnalyticalQuery) {
        try {
          console.log('Using specialized Excel handler for analytical query');
          return this.processExcelData(query, allDocuments, dataSourceIdStrs[0]);
        } catch (error) {
          console.error('Error processing Excel data:', error);
          // Fall back to regular handling
        }
      }
      
      // Generate response using the documents
      return this.generateResponseWithDocuments(query, allDocuments, documentType);
    } catch (error: any) {
      console.error('Error processing query:', error);
      return {
        content: `I encountered an error while processing your question: ${error.message}`,
        metadata: {
          error: error.message,
          processingTime: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Normalize a collection name for Qdrant
   */
  private normalizeCollectionName(dataSourceId: string): string {
    // Ensure it's a string
    dataSourceId = String(dataSourceId);
    
    // Check if it already has the prefix
    if (dataSourceId.startsWith('datasource_')) {
      return dataSourceId;
    }
    
    // Add the prefix
    return `datasource_${dataSourceId}`;
  }
  
  /**
   * Detect data source type based on file extension or metadata
   */
  private detectDataSourceType(dataSourceId: string, documents: Document[]): string {
    // First, check if we can determine from the data source ID
    try {
      // Check with server-side data source info if available
      if (typeof fetch !== 'undefined') {
        const dataSourceInfo = localStorage.getItem(`datasource_info_${dataSourceId}`);
        if (dataSourceInfo) {
          const info = JSON.parse(dataSourceInfo);
          if (info && info.type) {
            console.log(`Detected data source type from cached info: ${info.type}`);
            
            // Map server type names to client type names
            if (info.type.includes('xlsx') || info.type.includes('excel') || info.type.includes('csv')) {
              return 'excel';
            }
            
            if (info.type.includes('pdf')) {
              return 'pdf';
            }
            
            if (info.type.includes('json')) {
              return 'json';
            }
            
            return info.type;
          }
        }
      }
    } catch (e) {
      console.warn('Error detecting data source type from cached info:', e);
    }
    
    // If no cached info, try to infer from documents
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (!doc.metadata) continue;
        
        // Check source file extension
        if (doc.metadata.source_file) {
          const filename = String(doc.metadata.source_file).toLowerCase();
          if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
            console.log('Detected Excel file from document metadata:', filename);
            return 'excel';
          }
          if (filename.endsWith('.pdf')) return 'pdf';
          if (filename.endsWith('.json')) return 'json';
        }
        
        // Check content type
        if (doc.metadata.content_type) {
          const contentType = String(doc.metadata.content_type).toLowerCase();
          if (contentType.includes('excel') || contentType.includes('spreadsheet') || contentType.includes('csv')) {
            return 'excel';
          }
          if (contentType.includes('pdf')) return 'pdf';
          if (contentType.includes('json')) return 'json';
        }
        
        // Check source name
        if (doc.metadata.source_name) {
          const sourceName = String(doc.metadata.source_name).toLowerCase();
          if (sourceName.endsWith('.xlsx') || sourceName.endsWith('.xls') || sourceName.endsWith('.csv')) {
            console.log('Detected Excel file from source name:', sourceName);
            return 'excel';
          }
        }
      }
    }
    
    // If we couldn't detect from documents, check the data source ID itself
    if (dataSourceId.includes('xlsx') || dataSourceId.includes('excel') || dataSourceId.includes('csv')) {
      console.log('Detected Excel file from data source ID:', dataSourceId);
      return 'excel';
    }
    
    // Default to qdrant if cannot determine
    return 'qdrant';
  }
  
  /**
   * Detects the most likely document type from metadata and content
   */
  private detectDocumentType(types: string[], documents: Document[]): string {
    // If we got empty documents, return a default type
    if (!documents || documents.length === 0) {
      return 'text';
    }
    
    // First, check explicit types from metadata
    for (const doc of documents) {
      const metadata = doc.metadata || {};
      
      // Check for direct file extension indicators in metadata
      if (metadata.source_file && typeof metadata.source_file === 'string') {
        const file = metadata.source_file.toLowerCase();
        
        if (file.endsWith('.xlsx') || file.endsWith('.xls') || file.endsWith('.csv')) {
          console.log('Detected Excel document type from file extension:', file);
          return 'excel';
        }
        
        if (file.endsWith('.json')) {
          return 'json';
        }
        
        if (file.endsWith('.pdf')) {
          return 'pdf';
        }
      }
      
      // Check for explicit content_type in metadata
      if (metadata.content_type) {
        const contentType = metadata.content_type.toLowerCase();
        
        if (contentType.includes('excel') || 
            contentType.includes('spreadsheet') || 
            contentType.includes('csv')) {
          console.log('Detected Excel document type from content_type:', contentType);
          return 'excel';
        }
        
        if (contentType.includes('json')) {
          return 'json';
        }
        
        if (contentType.includes('pdf')) {
          return 'pdf';
        }
      }
    }
    
    // If no explicit type was found in metadata, check content patterns
    const combinedContent = documents.map(doc => doc.content).join(' ');
    
    // Check for tabular data patterns in the content
    if (combinedContent.includes('|') && combinedContent.includes('\n')) {
      const lines = combinedContent.split('\n');
      // If multiple lines have the same number of | characters, this is likely a table
      const pipeCounts = lines.map(line => (line.match(/\|/g) || []).length);
      const hasConsistentPipes = pipeCounts.length > 2 && 
                               new Set(pipeCounts.filter(count => count > 0)).size <= 2;
      
      if (hasConsistentPipes) {
        console.log('Detected tabular data from content pattern analysis');
        return 'table';
      }
    }
    
    // Check for JSON patterns in the content
    if ((combinedContent.includes('{') && combinedContent.includes('}')) ||
        (combinedContent.includes('[') && combinedContent.includes(']'))) {
      try {
        JSON.parse(combinedContent.trim());
        return 'json';
      } catch (e) {
        // Not valid JSON, continue checking other patterns
      }
    }
    
    // Default to text if nothing else matched
    return types[0] || 'text';
  }
  
  /**
   * Extract visualization data from documents if possible
   */
  private extractVisualizationData(documents: Document[], documentType: string): any {
    // For tabular data (CSV/Excel), try to extract a table
    if (['csv', 'excel'].includes(documentType.toLowerCase())) {
      try {
        // Look for tabular data in documents
        for (const doc of documents) {
          // Check for tableData in metadata
          if (doc.metadata?.tableData && Array.isArray(doc.metadata.tableData)) {
            const tableData = doc.metadata.tableData;
            
            // Create visualization config
            return {
              type: 'bar',
              data: tableData,
              xKey: Object.keys(tableData[0])[0],
              yKey: Object.keys(tableData[0])[1]
            };
          }
          
          // Try to extract table from content
          const content = doc.content;
          if (content && typeof content === 'string') {
            // Look for JSON data
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
              try {
                const jsonData = JSON.parse(jsonMatch[1]);
                if (Array.isArray(jsonData) && jsonData.length > 0) {
                  return {
                    type: 'bar',
                    data: jsonData,
                    xKey: Object.keys(jsonData[0])[0],
                    yKey: Object.keys(jsonData[0])[1]
                  };
                }
              } catch (e) {
                console.warn('Failed to parse JSON in document content');
              }
            }
            
            // Look for Markdown tables
            const tableMatch = content.match(/\|([^|]*)\|([^|]*)\|.*?\n\|[\s-]+\|[\s-]+\|[\s-]*\n((?:\|[^|]*\|[^|]*\|.*?\n)+)/);
            if (tableMatch) {
              try {
                const headers = [
                  tableMatch[1].trim(),
                  tableMatch[2].trim()
                ];
                
                const rows = tableMatch[3].split('\n')
                  .filter((line: string) => line.trim().length > 0)
                  .map((line: string) => {
                    const cols = line.split('|').filter((col: string) => col.trim().length > 0);
                    if (cols.length >= 2) {
                      const obj: Record<string, any> = {};
                      obj[headers[0]] = cols[0].trim();
                      obj[headers[1]] = isNaN(Number(cols[1].trim())) ? cols[1].trim() : Number(cols[1].trim());
                      return obj;
                    }
                    return null;
                  })
                  .filter((row: any) => row !== null);
                
                if (rows.length > 0) {
                  return {
                    type: 'bar',
                    data: rows,
                    xKey: headers[0],
                    yKey: headers[1]
                  };
                }
              } catch (e) {
                console.warn('Failed to parse table in document content');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error extracting visualization data:', error);
      }
    }
    
    // For now, return null if we can't extract visualization data
    return null;
  }
  
  /**
   * Vector search in Qdrant
   */
  private async vectorSearch(query: string, dataSourceId: string, limit: number = 10): Promise<Document[]> {
    try {
      console.log(`Beginning vector search for query: "${query}" in data source: ${dataSourceId}`);
      
      // Get embedding for the query with enhanced error handling
      let embedding;
      try {
        console.log('Generating embedding for query...');
        embedding = await this.openaiService.createEmbedding(query);
        console.log(`Embedding generated: ${embedding ? 'success' : 'failed'} with length: ${embedding?.length || 0}`);
        
        // Validate embedding
        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error('Invalid embedding returned');
        }
      } catch (embeddingError) {
        console.error('Error generating embedding:', embeddingError);
        
        // FALLBACK: If we can't generate an embedding, try a random embedding
        // This will at least return results for debugging purposes
        console.log('Using fallback random embedding');
        embedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      }
      
      // Create an array of possible collection names to try
      const possibleCollectionNames = [
        this.normalizeCollectionName(dataSourceId),
        `datasource_${dataSourceId}`,
        dataSourceId.toString(),
        // If dataSourceId might be a UUID, also try numeric version
        dataSourceId.includes('-') ? `datasource_${parseInt(dataSourceId, 10) || ''}` : null
      ].filter((name): name is string => name !== null); // Type guard to ensure only strings are kept
      
      console.log(`Will try these collection names: ${possibleCollectionNames.join(', ')}`);
      
      // Try each possible collection name until we get results
      let results: any[] = [];
      let usedCollectionName = '';
      
      for (const collectionName of possibleCollectionNames) {
        try {
          console.log(`Trying collection: ${collectionName}`);
          
          // Try searchSimilar first (which might have better handling)
          try {
            results = await this.qdrantService.searchSimilar(collectionName, embedding, limit);
            if (results && results.length > 0) {
              console.log(`Found ${results.length} results using searchSimilar in ${collectionName}`);
              usedCollectionName = collectionName;
              break;
            }
          } catch (error) {
            const searchError = error as Error;
            console.log(`searchSimilar failed for ${collectionName}:`, searchError.message);
          }
          
          // Try direct search method as fallback
          try {
            results = await this.qdrantService.search(collectionName, embedding, undefined, limit);
            if (results && results.length > 0) {
              console.log(`Found ${results.length} results using direct search in ${collectionName}`);
              usedCollectionName = collectionName;
              break;
            }
          } catch (error) {
            const directSearchError = error as Error;
            console.log(`direct search failed for ${collectionName}:`, directSearchError.message);
          }
        } catch (error) {
          const collectionError = error as Error;
          console.warn(`Error with collection ${collectionName}:`, collectionError.message);
        }
      }
      
      // If we still have no results, try text search as a last resort
      if (results.length === 0) {
        console.log('No results from vector search, trying text search as last resort');
        for (const collectionName of possibleCollectionNames) {
          try {
            const textResults = await this.qdrantService.textSearch(collectionName, query, limit);
            if (textResults && textResults.length > 0) {
              console.log(`Found ${textResults.length} results using text search in ${collectionName}`);
              results = textResults;
              usedCollectionName = collectionName;
              break;
            }
          } catch (error) {
            const textSearchError = error as Error;
            console.warn(`Text search failed for ${collectionName}:`, textSearchError.message);
          }
        }
      }
      
      if (results.length === 0) {
        console.warn(`No results found in any collections for data source ${dataSourceId}`);
        return [];
      }
      
      // Log successful retrieval
      console.log(`Successfully retrieved ${results.length} results from ${usedCollectionName}`);
      
      // Sample the first result for debugging
      if (results.length > 0) {
        const sample = results[0];
        console.log(`Sample result: ID ${sample.id || 'unknown'}, Score: ${sample.score || 'unknown'}`);
        
        if (sample.payload) {
          const content = sample.payload.text || sample.payload.content;
          if (content) {
            console.log(`Content preview: "${content.substring(0, 100)}..."`);
          } else {
            console.warn('Result payload does not contain text or content field');
          }
        }
      }
      
      // Map the results to Document objects
      return results.map(result => {
        // Extract content and metadata from the result
        let content = '';
        let metadata: Record<string, any> = {};
        
        // Handle different result formats
        if (result.payload) {
          // Standard Qdrant format
          content = result.payload.text || result.payload.content || '';
          metadata = { ...result.payload };
          
          // If there's a metadata field, merge it
          if (result.payload.metadata) {
            metadata = { ...metadata, ...result.payload.metadata };
          }
          
          // Add score if available
          if (result.score !== undefined) {
            metadata.score = result.score;
          }
        } else {
          // Direct format (text only)
          content = result.text || result.content || JSON.stringify(result);
        }
        
        console.log(`Processed document with content length: ${content.length}`);
        
        return {
          content,
          metadata: {
            ...metadata,
            dataSourceId,
            collectionName: usedCollectionName
          }
        };
      });
    } catch (error) {
      console.error(`Vector search error:`, error);
      return [];
    }
  }
  
  /**
   * Fallback to text search when vector search fails
   */
  private async fallbackTextSearch(query: string, dataSources: string[]): Promise<Document[]> {
    console.log(`Attempting fallback text search for query: ${query}`);
    const allResults: Document[] = [];
    
    for (const dataSourceId of dataSources) {
      try {
        // Try multiple collection name formats
        const possibleCollectionNames = [
          this.normalizeCollectionName(dataSourceId),
          `datasource_${dataSourceId}`,
          dataSourceId.toString(),
          // If dataSourceId might be a UUID, also try numeric version
          dataSourceId.includes('-') ? `datasource_${parseInt(dataSourceId, 10) || ''}` : null
        ].filter((name): name is string => name !== null); // Type guard to ensure only strings are kept
        
        console.log(`Trying these collections for fallback text search: ${possibleCollectionNames.join(', ')}`);
        
        // Try each collection
        let foundResults = false;
        
        for (const collectionName of possibleCollectionNames) {
          try {
            console.log(`Attempting text search in collection: ${collectionName}`);
            
            const results = await this.qdrantService.textSearch(collectionName, query, 10);
            
            if (results && results.length > 0) {
              console.log(`Text search found ${results.length} results in ${collectionName}`);
              
              const documents = results.map((result: any) => ({
                content: result.payload?.text || result.payload?.content || 'No content available',
                metadata: {
                  score: result.score,
                  id: result.id,
                  dataSourceId,
                  collectionName,
                  ...result.payload
                }
              }));
              
              allResults.push(...documents);
              foundResults = true;
              break; // Found results, no need to try other name formats
            }
          } catch (error) {
            console.warn(`Error in text search for ${collectionName}:`, error);
          }
        }
        
        // Log if no results found for this data source
        if (!foundResults) {
          console.warn(`No results found in any collections for data source ${dataSourceId}`);
        }
      } catch (error) {
        console.error(`Error processing data source ${dataSourceId} for text search:`, error);
      }
    }
    
    console.log(`Fallback text search found ${allResults.length} total results across all data sources`);
    return allResults;
  }
  
  /**
   * Generate a response from documents
   */
  private async generateResponseWithDocuments(
    query: string, 
    documents: Document[],
    documentType: string
  ): Promise<any> {
    console.log(`Generating response for query: "${query}" with ${documents.length} documents`);
    
    // Sort documents by score (if available) and limit to reasonable amount
    const sortedDocs = documents
      .sort((a: any, b: any) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
      .slice(0, 5); // Limit to top 5 documents to avoid token limits
    
    // Prepare document context
    const context = sortedDocs.map((doc: any) => doc.content).join('\n\n---\n\n');
    
    // Determine the prompt based on document type
    let systemPrompt = '';
    let prompt = '';
    
    // Check if this is a tabular data query
    const isTabularData = ['csv', 'excel', 'spreadsheet'].includes(documentType.toLowerCase());
    
    if (isTabularData) {
      // Use specialized tabular data prompting
      const contentInfo = {
        contentType: 'tabular',
        subType: documentType,
        structure: 'spreadsheet',
        detectedEntities: []
      };
      
      // Process as tabular query
      return this.processContextAwareTabularQuery(query, documents, contentInfo);
    } else {
      // Use general RAG prompting
      systemPrompt = this.getDefaultSystemPrompt(documentType);
      prompt = this.getDefaultRagPrompt()
        .replace('{context}', context)
        .replace('{query}', query);
    }
    
    // Generate response with OpenAI
    const response = await this.openaiService.createChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.2
      }
    );
    
    // Generate a structured response for visualization
    const structuredResponse = await this.generateStructuredAnalysis(
      query, 
      response
    );
    
    // Return the response with metadata
    return {
      content: response,
      structuredResponse,
      metadata: {
        documentType,
        sources: sortedDocs.map((doc: any) => ({
          id: doc.metadata?.id,
          score: doc.metadata?.score,
          dataSourceId: doc.metadata?.dataSourceId,
          filename: doc.metadata?.filename,
          title: doc.metadata?.title
        })),
        model: 'gpt-4o-mini'
      }
    };
  }
  
  /**
   * Generate a structured analysis from a query and response
   */
  private async generateStructuredAnalysis(
    query: string, 
    response: string
  ): Promise<StructuredAnalysisResponse> {
    try {
      console.log(`Generating structured analysis for visualization`);
      
      // Create a prompt to convert response to structured format
      const structurePrompt = `
You are analyzing a response to a user query. Convert the response into a structured step-by-step analysis that can be visualized.

USER QUERY: ${query}

RESPONSE: 
${response}

Please structure your response in the following JSON format:
{
  "summary": "1-2 sentence summary of the response",
  "steps": [
    {
      "id": "step-1",
      "type": "filter",
      "description": "First step description",
      "content": "Detailed content for this step",
      "order": 1
    },
    {
      "id": "step-2",
      "type": "aggregate",
      "description": "Second step description",
      "content": "Detailed content for this step",
      "order": 2
    }
  ],
  "insights": ["Key insight 1", "Key insight 2", "Key insight 3"]
}

Instructions:
1. The "type" field should be one of: filter, aggregate, sort, insight, visualization, table, compare, or default
2. Choose the most appropriate type for each step
3. Include 3-5 steps in your analysis
4. Extract 2-4 key insights
5. Write the summary to capture the essence of the response in 1-2 sentences
`;

      // Generate structured analysis
      const structuredResult = await this.openaiService.createChatCompletion(
        [
          { role: 'system', content: 'You are an AI that creates structured analysis from responses. Return your response as a valid JSON object with summary, steps, and insights fields.' },
          { role: 'user', content: structurePrompt }
        ],
        {
          model: 'gpt-4o-mini',
          temperature: 0.1
        }
      );
      
      // Parse the structured result
      try {
        const parsedResult = JSON.parse(structuredResult);
        
        // Fill in default values if missing
        if (!parsedResult.summary) {
          parsedResult.summary = "Analysis of the query results";
        }
        
        if (!parsedResult.steps || !Array.isArray(parsedResult.steps) || parsedResult.steps.length === 0) {
          parsedResult.steps = [
            {
              id: "step-1",
              type: "default",
              description: "Response Analysis",
              content: response,
              order: 1
            }
          ];
        }
        
        if (!parsedResult.insights || !Array.isArray(parsedResult.insights)) {
          parsedResult.insights = ["No specific insights were extracted from this response"];
        }
        
        // Add visualization data if possible based on document type
        parsedResult.visualization = null;
        
        return parsedResult;
      } catch (error) {
        console.error('Error parsing structured result:', error);
        
        // Return a default structured response
        return {
          summary: "Analysis of the query results",
          steps: [
            {
              id: "step-1",
              type: "default",
              description: "Response Analysis",
              content: response,
              order: 1
            }
          ],
          insights: ["No specific insights were extracted from this response"],
          visualization: null
        };
      }
    } catch (error) {
      console.error('Error generating structured analysis:', error);
      
      // Return a basic structured response
      return {
        summary: "Analysis of the query results",
        steps: [
          {
            id: "step-1",
            type: "default",
            description: "Response Analysis",
            content: response,
            order: 1
          }
        ],
        insights: ["No specific insights were extracted from this response"],
        visualization: null
      };
    }
  }
  
  /**
   * Process a query specifically for tabular data
   */
  private async processContextAwareTabularQuery(
    query: string, 
    documents: Document[],
    contentInfo: { 
      contentType: string; 
      subType?: string; 
      structure: string;
      detectedEntities?: string[];
    }
  ): Promise<any> { // Changed return type to any to include metadata
    // Prepare the document context
    const context = documents
      .map((doc: Document) => doc.content)
      .join('\n\n---\n\n');
      
    // Base template for RAG prompting
    const baseTemplate = `
I need to analyze this tabular data and answer a specific question.

CONTEXT:
{context}

QUESTION:
{query}

Please provide a detailed answer with analysis where appropriate.
Include relevant data points in your response.
If asked for calculations, show the reasoning step-by-step.
Present any data tables in markdown format.
`;

    // Determine the system prompt based on content type
    let systemPrompt: string;
    
    switch (contentInfo.contentType) {
      case 'technical':
        systemPrompt = `You are a specialized technical analyst. Extract precise information from ${contentInfo.subType || ''} data and format it as clean tables. Preserve exact values and technical details. Entity types detected: ${contentInfo.detectedEntities?.join(', ')}.`;
        break;
      case 'financial':
        systemPrompt = `You are a financial analyst. Analyze financial data, calculate metrics as needed, and present results in well-formatted tables. Focus on accuracy with financial figures. Key topics: ${contentInfo.detectedEntities?.join(', ')}.`;
        break;
      case 'product':
        systemPrompt = `You are a product analyst. Extract product information, inventory details, or catalog data. Format as well-structured tables suitable for product analysis. Key product entities: ${contentInfo.detectedEntities?.join(', ')}.`;
        break;
      case 'people':
        systemPrompt = `You are an HR/personnel analyst. Handle personnel or organizational data with appropriate sensitivity. Format as clear, well-organized tables. Key entity types: ${contentInfo.detectedEntities?.join(', ')}.`;
        break;
      default:
        systemPrompt = `You are a specialized data analyst. Extract and format ${contentInfo.contentType} data with precision. Present your findings in well-structured tables. Key terms detected: ${contentInfo.detectedEntities?.join(', ')}.`;
    }
    
    // Create prompt with context and query
    const userContent = baseTemplate
      .replace('{context}', context)
      .replace('{query}', query);
    
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];
    
    // Use a capable model with low temperature for maximum accuracy
    const response = await this.openaiService.createChatCompletion(
      messages, 
      {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_completion_tokens: 1000
      }
    );
    
    // Extract table data if present
    const tableData = this.extractTableFromResponse(response);
    
    // Generate structured analysis
    const structuredResponse = await this.generateStructuredAnalysis(
      query,
      response
    );
    
    // If we extracted table data, add it to the visualization
    if (tableData && tableData.length > 0) {
      structuredResponse.visualization = {
        type: 'table',
        data: tableData,
        xKey: Object.keys(tableData[0])[0],
        yKey: Object.keys(tableData[0])[1]
      };
    }
    
    return {
      content: response,
      structuredResponse,
      metadata: {
        dataSourceType: contentInfo.subType || 'tabular',
        tableData: tableData
      }
    };
  }
  
  /**
   * Extract table data from a text response
   */
  private extractTableFromResponse(response: string): any[] | null {
    try {
      // Look for markdown tables
      const tableRegex = /\|([^|]*)\|([^|]*)\|.*?\n\|[\s-]+\|[\s-]+\|[\s-]*\n((?:\|[^|]*\|[^|]*\|.*?\n)+)/g;
      const match = tableRegex.exec(response);
      
      if (match) {
        const headers = match[1].trim().split('|').map(h => h.trim()).filter(h => h);
        if (headers.length === 0) {
          headers.push(match[1].trim());
          headers.push(match[2].trim());
        }
        
        const rows = match[3].split('\n')
          .filter(line => line.trim().length > 0 && line.includes('|'))
          .map(line => {
            const cells = line.split('|').filter(cell => cell.trim().length > 0);
            
            if (cells.length >= headers.length) {
              const row: Record<string, any> = {};
              headers.forEach((header, i) => {
                const value = cells[i]?.trim();
                row[header] = isNaN(Number(value)) ? value : Number(value);
              });
              return row;
            }
            return null;
          })
          .filter(row => row !== null);
        
        if (rows.length > 0) {
          return rows as any[];
        }
      }
      
      // Look for JSON data
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            return jsonData;
          }
        } catch (e) {
          console.warn('Failed to parse JSON in response');
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting table from response:', error);
      return null;
    }
  }

  /**
   * Get default system prompt if PromptTemplates not available
   */
  private getDefaultSystemPrompt(documentType: string): string {
    // Default system prompt based on document type
    switch (documentType.toLowerCase()) {
      case 'pdf':
        return `You are an AI assistant specialized in analyzing PDF documents. 
                Extract relevant information and provide clear, concise responses.`;
      case 'excel':
      case 'csv':
        return `You are an AI assistant specialized in analyzing tabular data. 
                Provide numerical insights, identify patterns, and explain data relationships clearly.`;
      case 'docx':
      case 'doc':
        return `You are an AI assistant specialized in analyzing text documents.
                Summarize key points and provide clear, structured responses.`;
      case 'qdrant':
        return `You are an AI assistant with access to a vector database.
                Provide accurate information based on the retrieved documents.`;
      default:
        return `You are an AI assistant. Provide helpful, accurate, and clear responses
                based on the provided context.`;
    }
  }

  /**
   * Get default RAG prompt template
   */
  private getDefaultRagPrompt(): string {
    return `
I need you to answer a question based on the following context:

CONTEXT:
{context}

QUESTION:
{query}

Provide a comprehensive and accurate answer based only on the information in the context.
If the context doesn't contain relevant information, say so rather than making things up.
`;
  }

  /**
   * Run diagnostics on the RAG service and Qdrant collections
   * @param dataSourceId Optional data source ID to test specific collection
   * @returns Diagnostic information
   */
  public async runDiagnostics(dataSourceId?: string): Promise<{
    status: boolean;
    errors: string[];
    warnings: string[];
    info: Record<string, any>;
    collections: string[];
    suggestions: string[];
  }> {
    console.log('Running RAG diagnostics...');
    const result = {
      status: false,
      errors: [] as string[],
      warnings: [] as string[],
      info: {} as Record<string, any>,
      collections: [] as string[],
      suggestions: [] as string[]
    };
    
    try {
      // Step 1: Check Qdrant connection
      const qdrantDiagnostics = await this.qdrantService.runDiagnostics(dataSourceId ? `datasource_${dataSourceId}` : undefined);
      
      result.status = qdrantDiagnostics.serverConnection;
      result.errors.push(...qdrantDiagnostics.errors);
      result.collections = qdrantDiagnostics.collections;
      result.suggestions.push(...qdrantDiagnostics.suggestions);
      
      // Step 2: Check for Excel-specific issues if the data source appears to be Excel
      if (dataSourceId) {
        // Normalize collection name
        const collectionName = this.normalizeCollectionName(dataSourceId);
        result.info.collectionName = collectionName;
        
        // Try to detect the data source type
        try {
          // Get a sample of documents from the collection 
          const documents = await this.vectorSearch('sample', dataSourceId, 5);
          
          if (documents.length > 0) {
            // Attempt to detect document type
            const documentTypes = documents
              .map(doc => {
                const metadata = doc.metadata || {};
                // Check different metadata fields for type indicators
                if (metadata.source_file && typeof metadata.source_file === 'string') {
                  const file = metadata.source_file.toLowerCase();
                  if (file.endsWith('.xlsx') || file.endsWith('.xls') || file.endsWith('.csv')) {
                    return 'excel';
                  }
                }
                return null;
              })
              .filter(Boolean);
            
            // If any document appears to be Excel
            if (documentTypes.includes('excel')) {
              result.info.documentType = 'excel';
              
              // Add Excel-specific checks and suggestions
              result.suggestions.push('For Excel files, ensure data is properly structured in tables');
              result.suggestions.push('Make sure Excel data has proper headers in the first row');
              
              // Check if we can detect any tabular structure in the documents
              const hasTabularContent = documents.some(doc => 
                doc.content.includes('|') && 
                doc.content.includes('\n') && 
                doc.content.split('\n').some(line => line.includes('|'))
              );
              
              if (!hasTabularContent) {
                result.warnings.push('Excel data does not appear to be properly formatted as tables');
                result.suggestions.push('Check if Excel data was correctly processed during indexing');
              }
            }
          } else {
            result.warnings.push(`No documents found in collection ${collectionName}`);
          }
        } catch (error: any) {
          result.warnings.push(`Error examining documents: ${error.message}`);
        }
      }
      
      // Step 3: Check UniversalDataHandler for Excel capabilities
      result.info.excelHandlerAvailable = !!this.universalDataHandler;
      if (!this.universalDataHandler) {
        result.warnings.push('UniversalDataHandler is not available, Excel handling may be limited');
      }
      
      // Step 4: Test a simple query to check overall system functionality
      if (result.status && dataSourceId && result.collections.length > 0) {
        try {
          // Find the right collection name for this data source
          const collection = this.normalizeCollectionName(dataSourceId);
          
          // Check if the collection exists
          if (result.collections.includes(collection)) {
            result.info.collectionExists = true;
          } else {
            result.info.collectionExists = false;
            result.errors.push(`Collection ${collection} not found in available collections`);
          }
        } catch (error: any) {
          result.errors.push(`Error testing query capability: ${error.message}`);
        }
      }
      
      // Final status assessment
      result.status = result.errors.length === 0;
      
      // Add general suggestions if issues were found
      if (!result.status) {
        result.suggestions.push('Check if the data source has been properly indexed');
        result.suggestions.push('Try refreshing the browser and reconnecting to the data source');
      }
      
      return result;
    } catch (error: any) {
      console.error('RAG diagnostics failed:', error);
      result.status = false;
      result.errors.push(`Diagnostics failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Process Excel data with specialized handling
   */
  private async processExcelData(query: string, documents: Document[], dataSourceId: string): Promise<any> {
    console.log('Processing Excel data for query:', query);
    
    try {
      // Extract structured data from the documents
      const excelData = this.extractExcelData(documents);
      
      if (!excelData || (Array.isArray(excelData) && excelData.length === 0)) {
        console.warn('No Excel data could be extracted from documents');
        return this.generateResponseWithDocuments(query, documents, 'excel');
      }
      
      console.log('Extracted Excel data:', typeof excelData, Array.isArray(excelData) ? excelData.length : 'non-array');
      
      // Process using the specialized handler
      const response = await this.universalDataHandler.processDataQuery(
        query, 
        excelData, 
        DataSourceType.EXCEL
      );
      
      // Add metadata to indicate it's Excel
      if (response && response.metadata) {
        response.metadata.dataSourceType = 'excel';
        response.metadata.dataSourceId = dataSourceId;
      } else if (response) {
        response.metadata = {
          dataSourceType: 'excel',
          dataSourceId: dataSourceId
        };
      }
      
      return response;
    } catch (error: any) {
      console.error('Error in specialized Excel processing:', error);
      return {
        content: `I encountered an error while analyzing the Excel data: ${error.message}`,
        metadata: {
          error: error.message,
          dataSourceType: 'excel'
        }
      };
    }
  }
  
  /**
   * Extract structured Excel data from documents
   */
  private extractExcelData(documents: Document[]): any {
    // First, try to find a document with JSON data in the content
    for (const doc of documents) {
      if (!doc.content) continue;
      
      try {
        // Check if the content is JSON
        if (doc.content.trim().startsWith('{') || doc.content.trim().startsWith('[')) {
          const parsed = JSON.parse(doc.content);
          if (parsed) {
            console.log('Found JSON data in document content');
            return parsed;
          }
        }
      } catch (e) {
        // Not JSON, continue checking
      }
    }
    
    // Next, try to convert tabular content into structured data
    const tabularDocs = documents.filter(doc => 
      doc.content && 
      doc.content.includes('|') && 
      doc.content.includes('\n')
    );
    
    if (tabularDocs.length > 0) {
      try {
        console.log('Found tabular data in documents, converting to structured format');
        return this.convertTableToJSON(tabularDocs[0].content);
      } catch (e) {
        console.warn('Error converting table to JSON:', e);
      }
    }
    
    // If we couldn't extract structured data, combine all content
    console.log('Using combined document content as Excel data');
    return documents.map(doc => doc.content).join('\n\n');
  }
  
  /**
   * Convert markdown table to JSON
   */
  private convertTableToJSON(tableContent: string): any[] {
    const lines = tableContent.split('\n').filter(line => line.trim().length > 0);
    
    // Need at least header and separator
    if (lines.length < 2) {
      return [];
    }
    
    // Extract headers from the first line
    const headerLine = lines[0].trim();
    const headers = headerLine
      .split('|')
      .map(header => header.trim())
      .filter(header => header.length > 0);
    
    if (headers.length === 0) {
      return [];
    }
    
    // Skip the separator line
    const dataLines = lines.slice(2);
    
    // Parse each line into a row object
    return dataLines.map(line => {
      const values = line
        .split('|')
        .map(cell => cell.trim())
        .filter((_, i) => i > 0 && i <= headers.length); // Skip first and extra columns
      
      const row: Record<string, string> = {};
      
      // Map values to headers
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      
      return row;
    });
  }
} 