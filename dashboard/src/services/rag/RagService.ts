import { OpenAIService } from '../openai/OpenAIService';
import { QdrantService } from '../qdrant/QdrantService';
import { EntityDetection } from './EntityDetection';
import { TextSearch } from './TextSearch';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { PromptTemplates } from './PromptTemplates';
import { DirectExcelHandler } from './DirectExcelHandler';

/**
 * Document interface for RAG
 */
interface Document {
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Query result interface
 */
interface QueryResult {
  query: string;
  result: string;
  entities?: string[];
  count?: number;
  entityType?: string;
}

/**
 * RAG Service for answering questions from knowledge base
 */
export class RagService {
  private openaiService: OpenAIService;
  private qdrantService: QdrantService;
  private entityDetection: EntityDetection;
  private textSearch: TextSearch;
  private directExcelHandler: DirectExcelHandler;
  
  // Cache for documents to reduce repeated searches
  private documentsCache: Map<string, { documents: Document[], timestamp: number }>;
  
  // Cache timeout in milliseconds (5 minutes)
  private readonly CACHE_TIMEOUT = 5 * 60 * 1000;
  
  constructor() {
    this.openaiService = new OpenAIService();
    this.qdrantService = new QdrantService();
    this.entityDetection = new EntityDetection();
    this.textSearch = new TextSearch();
    this.directExcelHandler = new DirectExcelHandler();
    this.documentsCache = new Map();
    
    console.log('RAG Service initialized');
  }
  
  /**
   * Query the knowledge base with a question
   */
  public async query(
    question: string, 
    dataSources: string[],
    options: {
      documentId?: string;
      recentDocumentIds?: string[];
    } = {}
  ): Promise<string> {
    console.log(`RAG query: "${question}" for sources: ${dataSources.join(', ')}`);
    
    try {
      // Check if this is an Excel data query - if so, use our direct handler
      if (this.directExcelHandler.isExcelDataQuery(question)) {
        console.log('Using direct Excel handler for query');
        return this.directExcelHandler.processExcelQuery(question);
      }
      
      // Continue with standard RAG processing if not an Excel query
      // Retrieve relevant documents for RAG
      const limit = 20; // Default limit for documents
      console.log(`Retrieving documents with limit ${limit}...`);
      const documents = await this.retrieveDocuments(question, dataSources, limit, options.documentId);
      
      if (documents.length === 0) {
        console.log('No relevant documents found for the query');
        
        if (this.isDocumentOverviewQuery(question)) {
          return "I couldn't find enough reliable content from your document to generate a summary. This could be because:\n\n" +
            "1. The document embeddings weren't properly stored in the vector database\n" +
            "2. The document processing pipeline may need to be rerun\n\n" +
            "I recommend refreshing the knowledge base and trying again, or re-uploading the document.";
        } else {
          return "I couldn't find enough relevant information to answer your question. If you're asking about a specific document, please make sure it has been properly processed.";
        }
      }
      
      // Log what we found for debugging purposes
      console.log(`Found ${documents.length} relevant documents for processing`);
      if (documents.length > 0) {
        console.log(`First document content preview (first 100 chars): ${documents[0].content.substring(0, 100)}`);
      }
      
      // Process the query with the retrieved documents
      return this.processQuery(question, documents);
    } catch (error: any) {
      console.error('Error in RAG query:', error);
      return `I encountered an error while processing your question: ${error.message || 'Unknown error'}`;
    }
  }
  
  /**
   * Retrieve documents from various data sources
   */
  private async retrieveDocuments(
    query: string, 
    dataSources: string[], 
    limit: number = 10,
    documentId?: string
  ): Promise<Document[]> {
    try {
      // If no data sources provided, return empty array
      if (!dataSources || dataSources.length === 0) {
        return [];
      }
      
      // Check if this is an analytical query or entity count query
      const isAnalytical = this.entityDetection.isAnalyticalQuery(query);
      const entityCountInfo = this.extractEntityCountInfo(query);
      const isVCFundQuery = this.entityDetection.isVCFundCountQuery(query);
      const isDocumentSummary = this.isDocumentOverviewQuery(query);
      
      // For analytical queries, we want to retrieve more context
      if (isAnalytical || entityCountInfo || isVCFundQuery) {
      console.log(`Analytical query detected: "${query}"`);
        console.log(`Using increased retrieval limits: vector=${limit * 10}, text=${limit * 20}`);
        limit = limit * 10; // Increase limit for analytical queries
    }
    
    // Process each data source
      const allDocuments: Document[] = [];
      const metadataFromTextSearch: Map<string, any> = new Map();
      
    for (const dataSourceId of dataSources) {
        console.log(`Retrieving documents from data source: ${dataSourceId}`);
        
        // For analytical and entity counting queries, use comprehensive search
        if (isAnalytical || entityCountInfo || isVCFundQuery) {
          console.log(`Using comprehensive parallel search in data source ${dataSourceId}`);
          
          // Use both vector search and text search in parallel for more complete results
          const [vectorResults, textResults] = await Promise.all([
            this.vectorSearch(query, dataSourceId, limit),
            this.textSearchFallback(query, dataSourceId, limit * 2, documentId)
          ]);
          
          // For entity counting and analytical queries, try additional search with alternate query
          // formulations to get more complete coverage
            const mainTopic = this.extractMainTopic(query);
          let alternativeResults: Document[] = [];
          
            if (mainTopic) {
              console.log(`Identified main topic for analytical query: "${mainTopic}"`);
              const alternativeQuery = `all information about ${mainTopic}`;
              console.log(`Using alternative query to retrieve more context: "${alternativeQuery}"`);
              
              try {
              // Get additional results with alternative query
              alternativeResults = await this.textSearchFallback(
                alternativeQuery, 
                dataSourceId, 
                limit, 
                documentId
              );
              
              console.log(`Alternative query returned ${alternativeResults.length} additional results`);
            } catch (error: any) {
              console.error(`Error with alternative query search: ${error.message}`);
            }
          }
          
          // If we have entity-specific information, try searches with entity names
          if (entityCountInfo && entityCountInfo.entityType) {
            try {
              // Try to get more results with direct entity type query
              const entityTypeQuery = entityCountInfo.entityType;
              console.log(`Using entity type query to get more results: "${entityTypeQuery}"`);
              
              const entityResults = await this.textSearchFallback(
                entityTypeQuery,
                dataSourceId,
                limit,
                documentId
              );
              
              console.log(`Entity type query returned ${entityResults.length} additional results`);
              alternativeResults = [...alternativeResults, ...entityResults];
            } catch (error: any) {
              console.error(`Error with entity type search: ${error.message}`);
            }
          }
          
          // Combine all results
          allDocuments.push(...vectorResults, ...textResults, ...alternativeResults);
          
          console.log(`Vector search returned ${vectorResults.length} results, text search returned ${textResults.length} results, alternative search returned ${alternativeResults.length} results`);
        }
        // For regular queries, just use vector search with text search fallback
        else {
          // Check if we have a document ID and we're looking for a document overview
          if (documentId && this.isDocumentOverviewQuery(query)) {
            console.log(`Document overview query with ID: ${documentId}`);
            
            // First try vector search as it's more reliable
            let vectorResults = await this.vectorSearch(query, dataSourceId, limit);
            
            // Next, also get text search results in parallel - we'll validate and use them even if vector search finds results
            const textResults = await this.textSearchFallback(query, dataSourceId, Math.max(limit * 2, 30), documentId);
            
            // Store metadata from text search for potential use later
            if (textResults.length > 0) {
              textResults.forEach(doc => {
                if (doc.metadata && doc.content) {
                  // Use content as key since we need to match it with vector results
                  metadataFromTextSearch.set(doc.content, doc.metadata);
                }
              });
            }
            
            // For document summaries, we need to validate content
            let hasValidContent = false;
            
            if (vectorResults.length > 0) {
              console.log(`Using ${vectorResults.length} vector search results for document overview`);
              
              // Validate that vector results are actually from a structured document
              // This helps prevent using vector results that might be from wrong documents
              const documentPatterns = [
                /CHAPTER \d+/i,
                /Table of Contents/i,
                /Section \d+/i,
                /A\.\s+[A-Z]/,  // Pattern like "A. PURPOSE"
                /\w+\s+\d+\-\d+/, // Pattern like "PURPOSE1-1"
                /^\d+\.\s+\w+/m,  // Numbered list items
              ];
              
              // Check if any vector result has document structure
              for (const doc of vectorResults) {
                if (doc.content) {
                  for (const pattern of documentPatterns) {
                    if (pattern.test(doc.content)) {
                      hasValidContent = true;
                      break;
                    }
                  }
                  if (hasValidContent) break;
                }
              }
              
              if (!hasValidContent) {
                console.log("Vector results don't seem to match document structure, will validate text results too");
              }
            }
            
            // If vector search returned insufficient or invalid results, try to use text search results
            if (vectorResults.length < 5 || !hasValidContent) {
              console.log(`Vector search returned ${vectorResults.length} results, validating text search results`);
              
              if (textResults.length > 0) {
                // For document summaries, we want to make sure we have document-like content
                // This helps prevent fabricated responses
                let validTextResults: Document[] = [];
                let unrelatedCount = 0;
                
                // Less strict document validation - we use multiple patterns that might indicate document content
                const documentPatterns = [
                  /CHAPTER \d+/i,
                  /Table of Contents/i,
                  /Section \d+/i,
                  /A\.\s+[A-Z]/,  // Pattern like "A. PURPOSE"
                  /\w+\s+\d+\-\d+/, // Pattern like "PURPOSE1-1"
                  /^\d+\.\s+\w+/m,  // Numbered list items
                ];
                
                for (const doc of textResults) {
                  if (!doc.content) continue;
                  
                  let isDocumentContent = false;
                  for (const pattern of documentPatterns) {
                    if (pattern.test(doc.content)) {
                      isDocumentContent = true;
                      break;
                    }
                  }
                  
                  if (isDocumentContent) {
                    validTextResults.push(doc);
                  } else {
                    unrelatedCount++;
                  }
                }
                
                console.log(`Found ${validTextResults.length} validated text results, filtered out ${unrelatedCount} unrelated results`);
                
                // If we found any valid document content, use it
                if (validTextResults.length > 0) {
                  // Use both vector results and validated text results
                  if (vectorResults.length > 0) {
                    console.log("Combining validated vector and text results");
                    allDocuments.push(...vectorResults, ...validTextResults);
                  } else {
                    console.log("Using only validated text results");
                    allDocuments.push(...validTextResults);
                  }
                } else if (vectorResults.length > 0) {
                  // If no valid text results but we have vector results, use them
                  console.log("No valid text results, using vector results");
                  allDocuments.push(...vectorResults);
                } else if (textResults.length > 0) {
                  // Last resort: if we have no valid results but we have some text results, use those
                  // Better to have some results than none
                  console.log("No valid results found, using all available text results as fallback");
                  allDocuments.push(...textResults);
                }
              } else if (vectorResults.length > 0) {
                // If no text results but we have vector results, use them
                console.log("No text results, using vector results");
                allDocuments.push(...vectorResults);
              }
            } else {
              // Vector search returned sufficient results, use them
              allDocuments.push(...vectorResults);
            }
          } else {
            // Standard retrieval flow: first try vector search
            const vectorResults = await this.vectorSearch(query, dataSourceId, limit);
            
            // If vector search didn't return enough results, try text search
            if (vectorResults.length < limit / 2) {
              console.log(`Vector search returned only ${vectorResults.length} results, trying text search fallback`);
              const textResults = await this.textSearchFallback(query, dataSourceId, limit, documentId);
              allDocuments.push(...vectorResults, ...textResults);
            } else {
              allDocuments.push(...vectorResults);
            }
          }
        }
      }
      
      // Sort and deduplicate documents
      const processedDocuments = this.sortAndDeduplicateDocuments(allDocuments);
      console.log(`Retrieved ${processedDocuments.length} total documents after deduplication`);
      
      // Attempt to enhance metadata from text search results if we have them
      if (metadataFromTextSearch.size > 0 && processedDocuments.length > 0) {
        console.log(`Enhancing document metadata with text search results (${metadataFromTextSearch.size} entries)`);
        for (const doc of processedDocuments) {
          if (doc.content && metadataFromTextSearch.has(doc.content)) {
            doc.metadata = { ...(doc.metadata || {}), ...metadataFromTextSearch.get(doc.content) };
          }
        }
      }
      
      return processedDocuments;
    } catch (error: any) {
      console.error(`Error retrieving documents:`, error);
      return [];
    }
  }
  
  /**
   * Perform vector search using the normalized collection name approach
   */
  private async vectorSearch(query: string, dataSourceId: string, limit: number = 10): Promise<Document[]> {
    try {
      // Normalize the collection name to use numeric IDs when possible
      const normalizedCollectionName = this.normalizeCollectionName(dataSourceId);
      
      // Generate embedding for the query
      const embedding = await this.openaiService.createEmbedding(query);
      
      console.log(`Trying vector search in normalized collection ${normalizedCollectionName}`);
      
      // Try with normalized collection name
      try {
        const searchResults = await this.qdrantService.search(
          normalizedCollectionName,
          embedding,
          limit
        );
        
        console.log(`Vector search returned ${searchResults.length} results from collection`);
        
        if (searchResults.length > 0) {
          // Transform the results into Document format with safety checks
          return searchResults.map(result => {
            // Log the raw result payload for debugging
            if (!result.payload) {
              console.warn('Received search result with undefined payload:', result);
              return {
                content: '',
                metadata: { error: 'Missing payload' }
              };
            }
            
            const text = result.payload.text || result.payload.content || result.payload.page_content || '';
            let metadata = result.payload.metadata || {};
            
            // If similarity score is in payload but not in metadata, move it to metadata
            if (result.score !== undefined && (!metadata || metadata.similarity === undefined)) {
              metadata = { ...metadata, similarity: result.score };
            }
            
            return {
              content: text,
              metadata
            };
          });
        }
      } catch (error) {
        console.warn(`Error searching normalized collection ${normalizedCollectionName}:`, error);
        
        // If error, try with numeric fallback if possible
        const numericId = parseInt(dataSourceId, 10);
        if (!isNaN(numericId) && normalizedCollectionName !== `datasource_${numericId}`) {
          const numericCollectionName = `datasource_${numericId}`;
          console.log(`Trying fallback with numeric collection ${numericCollectionName}`);
          
          try {
            const numericResults = await this.qdrantService.search(
              numericCollectionName,
              embedding,
              limit
            );
            
            if (numericResults.length > 0) {
              console.log(`Found ${numericResults.length} results in numeric collection`);
              return numericResults.map(result => ({
                content: result.payload?.text || result.payload?.content || '',
                metadata: { 
                  ...result.payload?.metadata || {},
                  similarity: result.score 
                }
              }));
            }
          } catch (fallbackError) {
            console.warn(`Error searching numeric fallback collection:`, fallbackError);
          }
        }
      }
      
      return [];
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }
  
  /**
   * Normalize collection name to use numeric IDs consistently
   */
  private normalizeCollectionName(dataSourceId: string): string {
    try {
      // Parse to number if possible
      const numericId = parseInt(dataSourceId, 10);
      
      // Always use numeric IDs for collection names when possible
      if (!isNaN(numericId)) {
        return `datasource_${numericId}`;
      }
      
      // If it's already prefixed, check if the ID part is numeric
      if (dataSourceId.startsWith('datasource_')) {
        const idPart = dataSourceId.substring(11);
        const numericIdPart = parseInt(idPart, 10);
        
        if (!isNaN(numericIdPart)) {
          return `datasource_${numericIdPart}`;
        }
        
        return dataSourceId; // Keep as is if not numeric
      }
      
      // If it has data_source_ prefix, convert it and check if numeric
      if (dataSourceId.startsWith('data_source_')) {
        const idPart = dataSourceId.substring(12);
        const numericIdPart = parseInt(idPart, 10);
        
        if (!isNaN(numericIdPart)) {
          return `datasource_${numericIdPart}`;
        }
        
        return `datasource_${idPart}`;
      }
      
      // Fallback to the original ID if not numeric (legacy support)
      return `datasource_${dataSourceId}`;
    } catch (error) {
      console.error(`Error normalizing collection name:`, error);
      // Default fallback
      return `datasource_${dataSourceId}`;
    }
  }
  
  /**
   * Perform text search as a fallback using normalized collection name
   */
  private async textSearchFallback(
    query: string,
    dataSourceId: string,
    limit: number = 50,
    documentId?: string
  ): Promise<Document[]> {
    try {
      console.log(`Running text search fallback for query: ${query}`);
      
      // Use normalized collection name
      const normalizedCollectionName = this.normalizeCollectionName(dataSourceId);
      console.log(`Trying text search in collection ${normalizedCollectionName}`);
      
      // Call the text search service with the normalized collection name
      const searchResults = await this.textSearch.searchByText(
        query,
        normalizedCollectionName,
        {
          limit,
          documentId
        }
      );
      
      console.log(`Text search returned ${searchResults.length} results`);
      
      if (searchResults.length > 0) {
        return searchResults.map(result => ({
          content: result.content || result.text || '',
          metadata: result.metadata || {}
        }));
      }
      
      // If no results from normalized collection name, try fallback to numeric ID if possible
      const numericId = parseInt(dataSourceId, 10);
      if (!isNaN(numericId) && normalizedCollectionName !== `datasource_${numericId}`) {
        const numericCollectionName = `datasource_${numericId}`;
        console.log(`Trying text search fallback with numeric collection ${numericCollectionName}`);
        
        const numericResults = await this.textSearch.searchByText(
          query,
          numericCollectionName,
          {
            limit,
            documentId
          }
        );
        
        if (numericResults.length > 0) {
          console.log(`Found ${numericResults.length} results in numeric collection`);
          return numericResults.map(result => ({
            content: result.content || result.text || '',
            metadata: result.metadata || {}
          }));
        }
      }
      
      return [];
    } catch (error) {
      console.error('Text search fallback error:', error);
      return [];
    }
  }
  
  /**
   * Sort documents by relevance and remove duplicates
   */
  private sortAndDeduplicateDocuments(documents: Document[]): Document[] {
    if (!documents || documents.length === 0) {
      return [];
    }
    
    // First, sort by similarity (if available)
    if (documents[0]?.metadata?.similarity !== undefined) {
      documents.sort((a, b) => {
        const aSimilarity = a.metadata?.similarity || 0;
        const bSimilarity = b.metadata?.similarity || 0;
        return bSimilarity - aSimilarity;
      });
    }
    
    // Then, remove duplicates (documents with identical content)
    const uniqueDocuments: Document[] = [];
    const contentSet = new Set<string>();
    
    for (const doc of documents) {
      // Skip documents with undefined content
      if (!doc || doc.content === undefined) {
        console.warn('Found document with undefined content in results, skipping');
        continue;
      }
      
      // Normalize content for comparison (remove whitespace, lowercase)
      const normalizedContent = doc.content.replace(/\s+/g, ' ').trim().toLowerCase();
      
      if (!contentSet.has(normalizedContent)) {
        contentSet.add(normalizedContent);
        uniqueDocuments.push(doc);
      }
    }
    
    return uniqueDocuments;
  }
  
  /**
   * Prepare context from documents for the prompt
   */
  private prepareContext(documents: Document[]): string {
    // Check if we have Excel data
    const isExcelData = documents.some(doc => 
      doc.metadata?.source === 'excel' || 
      (doc.content && doc.content.includes('Sheet:') && doc.content.includes('\t'))
    );
    
    if (isExcelData) {
      console.log('Preparing Excel data context with special formatting');
      
      // For Excel data, we want to preserve the tabular format as much as possible
      // Organize documents by sheet if possible
      const sheetMap = new Map<string, string[]>();
      let otherContent: string[] = [];
      
      documents.forEach(doc => {
        if (doc.content) {
          // Try to extract sheet name
          const sheetMatch = doc.content.match(/Sheet: (.+?)(\n|$)/);
          if (sheetMatch && sheetMatch[1]) {
            const sheetName = sheetMatch[1].trim();
            if (!sheetMap.has(sheetName)) {
              sheetMap.set(sheetName, []);
            }
            sheetMap.get(sheetName)?.push(doc.content);
          } else {
            otherContent.push(doc.content);
          }
        }
      });
      
      // Combine content by sheet
      let combinedContent = '=== EXCEL DATA START ===\n\n';
      
      // Add sheet data
      sheetMap.forEach((contents, sheetName) => {
        combinedContent += `--- SHEET: ${sheetName} ---\n\n`;
        
        // Format tabular data
        const formattedContents = contents.map(content => {
          // Convert tab-separated content to pipe-separated for better LLM rendering
          return content.split('\n').map(line => {
            // Skip lines that don't have tabular data
            if (!line.includes('\t')) return line;
            
            // Convert tabs to pipe separator for markdown tables
            return '| ' + line.replace(/\t/g, ' | ') + ' |';
          }).join('\n');
        });
        
        combinedContent += formattedContents.join('\n\n');
        combinedContent += '\n\n';
      });
      
      // Add other content
      if (otherContent.length > 0) {
        combinedContent += '--- OTHER CONTENT ---\n\n';
        combinedContent += otherContent.join('\n\n');
      }
      
      combinedContent += '\n\n=== EXCEL DATA END ===\n\n';
      combinedContent += 'IMPORTANT: The data above shows Excel data with multiple segments. The rows show different segments/zones, and the columns show different metrics like Sales, Trading operating profit, etc.\n\n';
      
      console.log(`Prepared Excel context with ${sheetMap.size} sheets and ${otherContent.length} other sections`);
      return combinedContent;
    }
    
    // For non-Excel data, use the standard approach
    return documents.map(doc => doc.content).join('\n\n');
  }
  
  /**
   * Check if an API key is available
   */
  public static hasApiKey(): boolean {
    return OpenAIService.hasApiKey();
  }
  
  /**
   * Clear data source from cache
   */
  public clearDataSource(dataSourceId: string): void {
    // Remove all cache entries for this data source
    for (const [key, _] of this.documentsCache.entries()) {
      if (key.includes(`_${dataSourceId}_`)) {
        this.documentsCache.delete(key);
      }
    }
  }
  
  /**
   * Check if a query is asking for row counts
   */
  private isRowCountQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Check for row count patterns
    const rowCountPatterns = [
      'how many row',
      'how many record',
      'how many entry',
      'how many document',
      'count of row',
      'count of record',
      'count of entry',
      'count of document',
      'total row',
      'total record',
      'total entry',
      'total document',
      'number of row',
      'number of record',
      'number of entry',
      'number of document',
      'row count',
      'record count',
      'entry count',
      'document count'
    ];
    
    return rowCountPatterns.some(pattern => lowerQuery.includes(pattern));
  }
  
  /**
   * Extract row count information from documents
   */
  private extractRowCountInfo(documents: Document[]): string | null {
    if (documents.length === 0) return null;
    
    // Extract numbers from documents
    const numbers: number[] = [];
    
    for (const doc of documents) {
      const content = doc.content || '';
      const matches = content.match(/\b\d{2,6}\b/g); // Match numbers between 10 and 999999
      
      if (matches) {
        for (const match of matches) {
          const num = parseInt(match, 10);
          if (!isNaN(num) && num >= 10) { // Only consider numbers >= 10 as potential counts
            numbers.push(num);
          }
        }
      }
    }
    
    if (numbers.length === 0) return null;
    
    // Find the most frequent number
    const numberCounts: Record<number, number> = {};
    let maxCount = 0;
    let mostFrequentNumber = 0;
    
    for (const num of numbers) {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
      if (numberCounts[num] > maxCount) {
        maxCount = numberCounts[num];
        mostFrequentNumber = num;
      }
    }
    
    // Only return a value if the number appears multiple times
    if (maxCount >= 2) {
      return `Based on the documents, there appear to be approximately ${mostFrequentNumber} rows or records.`;
    }
    
    return null;
  }
  
  /**
   * Extract VC fund count information from documents
   */
  private extractVCFundCountInfo(documents: Document[]): string | null {
    if (documents.length === 0) return null;
    
    // First check if any document has the count in metadata
    for (const doc of documents) {
      if (doc.metadata && doc.metadata.count !== undefined && doc.metadata.source === 'entity-count-endpoint') {
        console.log(`Found VC fund count in metadata: ${doc.metadata.count}`);
        return `Based on the data, there are ${doc.metadata.count} unique VC funds.`;
      }
    }
    
    // Extract VC fund counts from documents
    const vcFundPatterns = [
      /\b(\d+)\s+(?:VC|venture capital)\s+funds?\b/i,
      /\b(?:VC|venture capital)\s+funds?:\s*(\d+)\b/i,
      /\bnumber\s+of\s+(?:VC|venture capital)\s+funds?:\s*(\d+)\b/i,
      /\btotal\s+(?:VC|venture capital)\s+funds?:\s*(\d+)\b/i,
      /\b(\d+)\s+total\s+(?:VC|venture capital)\s+funds?\b/i,
      /\b(?:VC|venture capital)\s+fund\s+count:\s*(\d+)\b/i
    ];
    
    const numbers: number[] = [];
    
    for (const doc of documents) {
      const content = doc.content || '';
      
      for (const pattern of vcFundPatterns) {
        const matches = content.match(pattern);
        if (matches && matches[1]) {
          const num = parseInt(matches[1], 10);
          if (!isNaN(num) && num > 0) {
            numbers.push(num);
          }
        }
      }
      
      // Also check for general number patterns near VC fund mentions
      if (content.toLowerCase().includes('vc fund') || content.toLowerCase().includes('venture capital fund')) {
        const generalNumberMatches = content.match(/\b(\d{1,4})\b/g);
        if (generalNumberMatches) {
          for (const match of generalNumberMatches) {
            const num = parseInt(match, 10);
            if (!isNaN(num) && num > 0 && num < 1000) { // Reasonable range for fund counts
              numbers.push(num);
            }
          }
        }
      }
    }
    
    if (numbers.length === 0) return null;
    
    // Find the most frequent number
    const numberCounts: Record<number, number> = {};
    let maxCount = 0;
    let mostFrequentNumber = 0;
    
    for (const num of numbers) {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
      if (numberCounts[num] > maxCount) {
        maxCount = numberCounts[num];
        mostFrequentNumber = num;
      }
    }
    
    // Return a value if we find a consistent number
    if (maxCount >= 2 || (mostFrequentNumber > 0 && documents.length <= 2)) {
      return `Based on the documents, there appear to be approximately ${mostFrequentNumber} VC funds.`;
    }
    
    return null;
  }
  
  /**
   * Check if a query is asking for a document overview
   */
  private isDocumentOverviewQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Check for document overview patterns
    const overviewPatterns = [
      'what is in this document',
      'what does this document contain',
      'what is this document about',
      'summarize this document',
      'document summary',
      'overview of this document',
      'document overview',
      'about this document',
      'tell me about this document',
      'document contents',
      'what is in the document',
      'what does the document contain',
      'what is the document about',
      'summarize the document',
      'overview of the document',
      'about the document',
      'tell me about the document',
      'the document contents'
    ];
    
    return overviewPatterns.some(pattern => lowerQuery.includes(pattern));
  }
  
  /**
   * Extract the main topic from a query for use in generating alternative searches
   */
  private extractMainTopic(query: string): string | null {
    // Remove question words and common prefixes
    const cleanQuery = query.toLowerCase()
      .replace(/^(what|who|when|where|why|how|can you|could you|please|tell me|show me|find|list|give me|i want|i need|i'd like).+?(about|for|on|regarding|concerning|related to)\s+/i, '')
      .replace(/^(what|who|when|where|why|how|can you|could you|please|tell me|show me|find|list|give me|i want|i need|i'd like)\s+/i, '')
      .replace(/\b(the|a|an)\b\s+/g, '');
      
    // Remove question marks and other punctuation
    const noPunctuation = cleanQuery.replace(/[?,;:.!]/g, '');
    
    // If too short after cleaning, return null
    if (noPunctuation.trim().length < 3) {
      return null;
    }
    
    // Remove analytical terms to isolate the topic
    const withoutAnalytical = noPunctuation
      .replace(/\b(how many|count|total|sum|average|mean|median|mode|statistics|analysis|compare|trend)\b/g, '')
      .replace(/\b(percent|percentage|ratio|proportion|distribution|frequency|number of|amount of)\b/g, '')
      .trim();
      
    return withoutAnalytical || null;
  }
  
  /**
   * Extract entity count information from a query
   */
  private extractEntityCountInfo(query: string): { 
    entityType: string;
    countType: 'unique' | 'total'; 
    roleSpecificPattern?: RegExp;
  } | null {
    // Convert query to lowercase for case-insensitive matching
    const lowerQuery = query.toLowerCase();
    
    // Check if this is a count query
    const countTerms = ['how many', 'number of', 'count of', 'total number', 'count'];
    const isCountQuery = countTerms.some(term => lowerQuery.includes(term));
    
    if (!isCountQuery) {
      return null;
    }
    
    // Detect entity types
    const entityTypes = [
      { type: 'VC Fund', patterns: ['vc fund', 'venture capital fund', 'venture fund'] },
      { type: 'Investor', patterns: ['investor', 'limited partner', 'lp'] },
      { type: 'Partner', patterns: ['partner'] },
      { type: 'Portfolio Company', patterns: ['portfolio company', 'portfolio companies', 'company', 'companies'] },
      { type: 'Investment', patterns: ['investment', 'deal', 'transaction'] }
    ];
    
    // Check for specific partner roles
    const partnerRolePatterns = {
      'Founding Partner': /founding\s+partner|founding\s+general\s+partner|co-founder|founder.*partner|partner.*founder/i,
      'General Partner': /general\s+partner|gp/i,
      'Managing Partner': /managing\s+partner/i
    };
    
    // Find the first matching entity type
    let detectedEntity = null;
    let roleSpecificPattern: RegExp | undefined = undefined;
    
    for (const entity of entityTypes) {
      if (entity.patterns.some(pattern => lowerQuery.includes(pattern))) {
        detectedEntity = entity.type;
        
        // For Partner queries, check if there's a specific role requested
        if (entity.type === 'Partner') {
          for (const [role, pattern] of Object.entries(partnerRolePatterns)) {
            if (pattern.test(lowerQuery)) {
              console.log(`Detected specific partner role: ${role}`);
              
              // Create a specific regex for extraction based on the role
              if (role === 'Founding Partner') {
                // Look for various ways founding partners might be described
                roleSpecificPattern = /(?:Title|Role|Position):\s*(?:Founding\s+Partner|Co-Founder(?:\s+and\s+Partner)?|Founder(?:\s+and\s+Partner)?|Founding\s+General\s+Partner)(?:\s+at\s+[\w\s&]+)?/i;
              } else if (role === 'General Partner') {
                roleSpecificPattern = /(?:Title|Role|Position):\s*(?:General\s+Partner|GP)(?:\s+at\s+[\w\s&]+)?/i;
              } else if (role === 'Managing Partner') {
                roleSpecificPattern = /(?:Title|Role|Position):\s*(?:Managing\s+Partner)(?:\s+at\s+[\w\s&]+)?/i;
              }
              break;
            }
          }
        }
        break;
      }
    }
    
    if (!detectedEntity) {
      return null;
    }
    
    // Determine if we're looking for unique or total counts
    const uniqueTerms = ['unique', 'distinct', 'different'];
    const isUniqueCount = uniqueTerms.some(term => lowerQuery.includes(term));
    
    return {
      entityType: detectedEntity,
      countType: isUniqueCount ? 'unique' : 'total',
      roleSpecificPattern
    };
  }

  /**
   * Process an entity count query
   */
  private async processEntityCountQuery(
    query: string,
    dataSourceId: string
  ): Promise<QueryResult> {
    const entityInfo = this.extractEntityCountInfo(query);
    
    if (!entityInfo) {
      console.log('Not a valid entity count query');
      return { query, result: 'I cannot determine what entities you want to count. Please specify what you want to count more clearly.' };
    }
    
    // Using vector search to get documents - need a higher limit for comprehensive coverage
    const limit = 500;
    console.log(`Processing entity count query for ${entityInfo.entityType}, count type: ${entityInfo.countType}`);
    
    const documents = await this.retrieveDocuments(query, [dataSourceId], limit);
    console.log(`Retrieved ${documents.length} documents for entity count`);
    
    if (documents.length === 0) {
      return { 
        query, 
        result: `I couldn't find any information about ${entityInfo.entityType.toLowerCase()}s in the knowledge base.`
      };
    }
    
    // For partner roles, first find all investors, then filter by role
    if (entityInfo.entityType === 'Partner' && entityInfo.roleSpecificPattern) {
      console.log('Processing specific partner role query');
      
      // Find all investor documents first
      const investors: Map<string, string> = new Map();
      const namePattern = /Investor Name:\s*([^\n]+)/gi;
      
      // Extract all investors with their full content info
      for (const doc of documents) {
        let match;
        while ((match = namePattern.exec(doc.content)) !== null) {
          const investorName = match[1]?.trim();
          if (investorName && !investors.has(investorName)) {
            investors.set(investorName, doc.content);
          }
        }
      }
      
      console.log(`Found ${investors.size} total investors to check for role: ${entityInfo.roleSpecificPattern.source}`);
      
      // Now filter for those with the specific role
      const matchingInvestors: string[] = [];
      
      investors.forEach((content, name) => {
        if (entityInfo.roleSpecificPattern && entityInfo.roleSpecificPattern.test(content)) {
          matchingInvestors.push(name);
        }
      });
      
      console.log(`Found ${matchingInvestors.length} investors with matching role pattern`);
      
      // Sample some entities for the response
      const sampleSize = Math.min(5, matchingInvestors.length);
      const samples = matchingInvestors.slice(0, sampleSize);
      
      // Determine entity label (singular/plural)
      let entityLabel = 'Partner';
      if (entityInfo.roleSpecificPattern) {
        // For role-specific queries, use the matched role
        if (entityInfo.roleSpecificPattern.source.includes('Founding')) {
          entityLabel = 'Founding Partner';
        } else if (entityInfo.roleSpecificPattern.source.includes('General')) {
          entityLabel = 'General Partner';
        } else if (entityInfo.roleSpecificPattern.source.includes('Managing')) {
          entityLabel = 'Managing Partner';
        }
      }
      
      // Build the response
      let result = `There are ${matchingInvestors.length} ${entityInfo.countType} ${entityLabel} ${matchingInvestors.length === 1 ? 'entry' : 'entries'} in the knowledge base.`;
      
      if (samples.length > 0) {
        result += `\n\nHere are some examples:\n`;
        samples.forEach((sample, index) => {
          result += `${index + 1}. ${sample}\n`;
        });
      }
      
      // Add methodology explanation
      result += `\n\nThis information was extracted by first finding investor entries and then filtering for those with ${entityLabel} roles using the pattern: ${entityInfo.roleSpecificPattern}`;
      
      return {
        query,
        result,
        entities: matchingInvestors,
        count: matchingInvestors.length,
        entityType: entityLabel
      };
    }
    
    // For other entity types, continue with standard pattern matching
    // Define pattern based on entity type
    let globalPattern: RegExp;
    
    if (entityInfo.roleSpecificPattern) {
      // Use the role-specific pattern if available
      globalPattern = new RegExp(entityInfo.roleSpecificPattern.source, 'gi');
      console.log(`Using role-specific pattern: ${globalPattern}`);
    } else {
      // Default patterns for different entity types
      switch (entityInfo.entityType) {
        case 'VC Fund':
          globalPattern = /Fund Name:\s*([^\n]+)/gi;
          break;
        case 'Investor':
          globalPattern = /Investor Name:\s*([^\n]+)/gi;
          break;
        case 'Partner':
          globalPattern = /Partner(?:s)?:\s*([^\n]+)|Partner Name:\s*([^\n]+)/gi;
          break;
        case 'Portfolio Company':
          globalPattern = /Portfolio Company:\s*([^\n]+)/gi;
          break;
        case 'Investment':
          globalPattern = /Investment Amount:\s*([^\n]+)/gi;
          break;
        default:
          return { 
            query, 
            result: `I don't know how to count ${entityInfo.entityType.toLowerCase()}s.` 
          };
      }
    }
    
    console.log(`Using pattern: ${globalPattern}`);
    
    // Extract entities
    const entities: string[] = [];
    
    for (const doc of documents) {
      let match;
      while ((match = globalPattern.exec(doc.content)) !== null) {
        const entity = match[1] || match[2] || '';
        if (entity.trim()) {
          entities.push(entity.trim());
        }
      }
    }
    
    // Get unique entities
    const uniqueEntities = [...new Set(entities)];
    
    // Sample some entities for the response
    const sampleSize = Math.min(5, uniqueEntities.length);
    const samples = uniqueEntities.slice(0, sampleSize);
    
    // Prepare the result
    const countType = entityInfo.countType === 'unique' ? 'unique' : 'total';
    const count = entityInfo.countType === 'unique' ? uniqueEntities.length : entities.length;
    
    // Determine entity label (singular/plural)
    let entityLabel = entityInfo.entityType;
    if (entityInfo.roleSpecificPattern) {
      // For role-specific queries, use the matched role
      if (entityInfo.roleSpecificPattern.source.includes('Founding')) {
        entityLabel = 'Founding Partner';
      } else if (entityInfo.roleSpecificPattern.source.includes('General')) {
        entityLabel = 'General Partner';
      } else if (entityInfo.roleSpecificPattern.source.includes('Managing')) {
        entityLabel = 'Managing Partner';
      }
    }
    
    // Build the response
    let result = `There are ${count} ${countType} ${entityLabel} ${count === 1 ? 'entry' : 'entries'} in the knowledge base.`;
    
    if (samples.length > 0) {
      result += `\n\nHere are some examples:\n`;
      samples.forEach((sample, index) => {
        result += `${index + 1}. ${sample}\n`;
      });
    }
    
    // Add methodology explanation
    result += `\n\nThis information was extracted based on pattern matching in ${documents.length} documents using the pattern: ${globalPattern}`;
    
    return {
      query,
      result,
      entities: uniqueEntities,
      count,
      entityType: entityLabel
    };
  }

  /**
   * Process a query with the retrieved documents
   */
  private async processQuery(query: string, documents: Document[]): Promise<string> {
    try {
      // Check if this is a special query type
      const isAnalyticalQuery = this.entityDetection.isAnalyticalQuery(query);
      const isRowCountQuery = this.isRowCountQuery(query);
      const isVCFundQuery = this.entityDetection.isVCFundCountQuery(query);
      const isDocumentSummary = this.isDocumentOverviewQuery(query);
      const entityCountInfo = this.extractEntityCountInfo(query);
      
      // Check if the documents come from Excel files
      const isExcelData = documents.some(doc => 
        doc.metadata?.source === 'excel' || 
        (doc.content && doc.content.includes('Sheet:') && doc.content.includes('\t'))
      );
      
      console.log(`Processing query with ${documents.length} documents`);
      console.log(`Query types - Analytical: ${isAnalyticalQuery}, Row Count: ${isRowCountQuery}, VC Fund: ${isVCFundQuery}, Document Summary: ${isDocumentSummary}, Entity Count: ${entityCountInfo ? 'yes' : 'no'}, Excel Data: ${isExcelData}`);
      
      // OVERRIDE: If it's a tabular data query with Excel data, use forced extraction
      const isTabularDataQuery = this.isTabularDataQuery(query);
      
      console.log(`Query is tabular data query: ${isTabularDataQuery}`);
      
      if (isExcelData && isTabularDataQuery) {
        console.log('Using forced data extraction template for Excel table data');
        return await this.processDataExtractionQuery(query, documents);
      }
      
      // Check if we should use analytical processing for this query
      if (isAnalyticalQuery || isRowCountQuery || isVCFundQuery || entityCountInfo) {
        console.log('Using advanced analytical query processing');
        return await this.processAnalyticalQuery(query, documents);
      }
      
      // Process document overview query
      if (isDocumentSummary) {
        console.log(`Processing document overview query: "${query}"`);
        const topic = this.extractMainTopic(query);
        if (topic) {
          console.log(`Extracted main topic: ${topic}`);
        }
      }
      
      // Process row count query
      if (isRowCountQuery) {
        console.log(`Processing row count query: "${query}"`);
        const rowCountInfo = this.extractRowCountInfo(documents);
        if (rowCountInfo) {
          return rowCountInfo;
        }
      }
      
      // Process VC fund count query
      if (isVCFundQuery) {
        console.log(`Processing VC fund count query: "${query}"`);
        const vcFundCountInfo = this.extractVCFundCountInfo(documents);
        if (vcFundCountInfo) {
          return vcFundCountInfo;
        }
      }
      
      // Prepare context from documents
      const context = this.prepareContext(documents);
      
      // Select appropriate model and settings based on query type
      let model = 'gpt-4o-mini'; // Default to gpt-4o-mini instead of gpt-3.5-turbo-16k
      let temperature = 0.7;
      
      if (isAnalyticalQuery || isVCFundQuery || isRowCountQuery) {
        console.log(`Using model gpt-4o-mini with temperature 0.1 for analytical query`);
        model = 'gpt-4o-mini';
        temperature = 0.1;
      } else if (isDocumentSummary) {
        console.log(`Using model gpt-4o with temperature 0.2 for document summary`);
        model = 'gpt-4o'; // Use gpt-4o for summaries as requested
        temperature = 0.2;
      } else if (isExcelData) {
        console.log(`Using model gpt-4o-mini with temperature 0.1 for Excel data query`);
        model = 'gpt-4o-mini';
        temperature = 0.1;
      } else {
        console.log(`Using default model gpt-4o-mini with temperature 0.7 for general query`);
      }
      
      // Call OpenAI with the prompt
      console.log(`Sending ${context.length} characters to LLM with model ${model}`);
      
      // Select the appropriate prompt template
      let systemContent = 'You are an AI assistant that helps users find information in documents. Answer the question based solely on the provided context. If you cannot find the answer in the context, say "I don\'t have enough information to answer this question."';
      let userContent = `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:`;
      
      if (isExcelData) {
        console.log('Using Excel data prompt template');
        const promptTemplates = new PromptTemplates();
        const excelTemplate = promptTemplates.getExcelDataPrompt();
        systemContent = 'You are a specialized Excel data analyst. Analyze the tabular data provided and answer the query with precision.';
        userContent = excelTemplate
          .replace('{context}', context)
          .replace('{query}', query);
      }
      
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent }
      ];
      
      const response = await this.openaiService.createChatCompletion(
        messages, 
        {
          model,
          temperature,
          max_tokens: 1000
        }
      );
      
      return response || 'Failed to get a response from the OpenAI API';
    } catch (error: any) {
      console.error('Error in processQuery:', error);
      return `I encountered an error while processing your query: ${error.message || 'Unknown error'}`;
    }
  }
  
  /**
   * Process a query that requires strict data extraction only
   */
  private async processDataExtractionQuery(query: string, documents: Document[]): Promise<string> {
    console.log(`Processing data extraction query for tabular data: "${query}"`);
    
    try {
      // Identify table-like content in the documents
      const tableData = documents.filter(doc => {
        // Look for tab-separated or pipe-separated content that indicates tables
        return doc.content.includes('\t') || 
               (doc.content.includes('|') && doc.content.split('\n').some(line => line.includes('|')));
      });
      
      console.log(`Found ${tableData.length} documents with tabular data out of ${documents.length} total documents`);
      
      // Give priority to documents that mention segments, revenue, sales etc.
      const prioritizedDocs = [...documents].sort((a, b) => {
        const aScore = this.getRelevanceScore(a.content, query);
        const bScore = this.getRelevanceScore(b.content, query);
        return bScore - aScore;
      });
      
      // Take the top most relevant documents to avoid context overflow
      const selectedDocs = prioritizedDocs.slice(0, 10);
      
      // Prepare context from documents, ensuring full data inclusion
      const context = this.prepareContext(selectedDocs);
      
      // Create the extraction prompt
      const promptTemplates = new PromptTemplates();
      const extractionTemplate = promptTemplates.getForceDataExtractionPrompt()
        .replace('{context}', context)
        .replace('{query}', query);
      
      const messages: ChatCompletionMessageParam[] = [
        { 
          role: 'system', 
          content: 'You are a data extraction expert specializing in tabular data from Excel. Your task is to extract and format data into proper markdown tables. NEVER generate or hallucinate information. ONLY extract what is explicitly present in the provided data.' 
        },
        { 
          role: 'user', 
          content: extractionTemplate 
        }
      ];
      
      // Use a very low temperature for factual extraction
      const response = await this.openaiService.createChatCompletion(
        messages, 
        {
          model: 'gpt-4o', // Use the most capable model for table formatting
          temperature: 0.0, // Use zero temperature for maximum factuality
          max_tokens: 2000  // Allow more tokens for proper table formatting
        }
      );
      
      return response || 'Failed to get a response from the data extraction';
    } catch (error: any) {
      console.error('Error in processDataExtractionQuery:', error);
      return `I encountered an error while extracting tabular data: ${error.message || 'Unknown error'}`;
    }
  }
  
  /**
   * Get a relevance score for content based on a query
   * Higher score = more relevant
   */
  private getRelevanceScore(content: string, query: string): number {
    let score = 0;
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // Split query into terms and check each
    const terms = lowerQuery.split(/\s+/).filter(term => term.length > 3);
    
    for (const term of terms) {
      if (lowerContent.includes(term)) {
        score += 1;
      }
    }
    
    // Bonus for tabular data
    if (content.includes('\t') || (content.includes('|') && content.split('\n').some(line => line.includes('|')))) {
      score += 2;
    }
    
    // Bonus for financial data
    if (lowerContent.includes('revenue') || lowerContent.includes('sales') || 
        lowerContent.includes('segment') || lowerContent.includes('zone')) {
      score += 3;
    }
    
    return score;
  }

  /**
   * Extract entities from a query using NLP
   */
  private async extractEntitiesFromQuery(query: string): Promise<string[]> {
    try {
      // Use entity detection service if available
      if (this.entityDetection) {
        // Use the extractPotentialEntitiesFromQuery method
        const detectedEntities = this.entityDetection.extractPotentialEntitiesFromQuery(query);
        if (detectedEntities && detectedEntities.length > 0) {
          return detectedEntities;
        }
      }
      
      // Fallback to simple keyword extraction
      const keywords = this.extractKeywords(query);
      return keywords;
    } catch (error) {
      console.error('Error extracting entities:', error);
      return this.extractKeywords(query);
    }
  }

  /**
   * Process analytical queries of any type
   * This is a more flexible approach than the specific entity counting methods
   */
  private async processAnalyticalQuery(
    query: string,
    documents: Document[]
  ): Promise<string> {
    console.log(`Processing analytical query: "${query}"`);
    
    try {
      // Check if the documents come from Excel files
      const isExcelData = documents.some(doc => 
        doc.metadata?.source === 'excel' || 
        (doc.content && doc.content.includes('Sheet:') && doc.content.includes('\t'))
      );
      
      if (isExcelData) {
        console.log('Detected Excel data in analytical query, will use specialized Excel templates');
      }
      
      // First, limit the number of documents to avoid context length issues
      const maxDocuments = 100;
      let limitedDocuments = documents;
      
      if (documents.length > maxDocuments) {
        console.log(`Limiting documents from ${documents.length} to ${maxDocuments} for analytical query processing`);
        limitedDocuments = documents.slice(0, maxDocuments);
      }
      
      // Classify the analytical intent of the query
      const analyticalIntent = await this.classifyAnalyticalIntent(query);
      console.log('Analytical intent classification:', analyticalIntent);
      
      // Route to the appropriate specialized analysis method based on intent type
      switch (analyticalIntent.type) {
        case 'count':
          return this.processCountAnalysis(query, limitedDocuments, analyticalIntent);
          
        case 'comparison':
          return this.processComparisonAnalysis(query, limitedDocuments, analyticalIntent);
          
        case 'trend':
          return this.processTrendAnalysis(query, limitedDocuments, analyticalIntent);
          
        case 'ranking':
          return this.processRankingAnalysis(query, limitedDocuments, analyticalIntent);
          
        case 'grouping':
          return this.processGroupingAnalysis(query, limitedDocuments, analyticalIntent);
          
        case 'general':
        default:
          return this.processGeneralAnalysis(query, limitedDocuments);
      }
    } catch (error: any) {
      console.error('Error in processAnalyticalQuery:', error);
      
      // If we hit context length exceeded, try with batched processing
      if (error.message?.includes('context_length_exceeded')) {
        console.log('Retrying with batched document processing due to token limit');
        return this.processDocumentsInBatches(query, documents);
      }
      
      return `I encountered an error while processing your analytical query: ${error.message || 'Unknown error'}. Try refining your query to be more specific.`;
    }
  }

  /**
   * Process general analysis when we can't categorize the query
   */
  private async processGeneralAnalysis(
    query: string, 
    documents: Document[]
  ): Promise<string> {
    console.log(`Processing general analytical query using LLM with ${documents.length} documents`);
    
    // Check if the documents come from Excel files
    const isExcelData = documents.some(doc => 
      doc.metadata?.source === 'excel' || 
      (doc.content && doc.content.includes('Sheet:') && doc.content.includes('\t'))
    );
    
    if (isExcelData) {
      console.log('Detected Excel data, using specialized Excel prompt template');
    }
    
    // Estimate token count to avoid hitting limits
    const MAX_TOKENS_PER_DOCUMENT = 500; // Conservative estimate
    const RESERVE_TOKENS = 5000; // Reserve tokens for prompt and completion
    const MAX_PROMPT_TOKENS = 128000 - RESERVE_TOKENS; // For gpt-4o models
    
    // Calculate estimated tokens and limit documents if needed
    const estimatedTokens = documents.length * MAX_TOKENS_PER_DOCUMENT;
    let docsToProcess = documents;
    
    if (estimatedTokens > MAX_PROMPT_TOKENS) {
      const maxDocs = Math.floor(MAX_PROMPT_TOKENS / MAX_TOKENS_PER_DOCUMENT);
      console.log(`Limiting to ${maxDocs} documents to stay within token limits`);
      docsToProcess = documents.slice(0, maxDocs);
    }
    
    // Process in batches of documents if needed
    if (docsToProcess.length > 50) {
      return await this.processDocumentsInBatches(query, docsToProcess);
    }
    
    // Combine document content
    const docContent = docsToProcess.map(doc => doc.content).join('\n\n');
    
    // Choose appropriate template based on data type
    let prompt: string;
    if (isExcelData) {
      const promptTemplates = new PromptTemplates();
      prompt = promptTemplates.getExcelDataPrompt()
        .replace('{context}', docContent)
        .replace('{query}', query);
    } else {
      // Standard processing for smaller document sets
      // Create a general analysis prompt
      prompt = `
You are an analytical assistant tasked with answering a question based on data.

QUERY: ${query}

You need to analyze the following data to answer the query:

DATA:
${docContent}

Perform a detailed analysis to answer the query. Include:
1. A direct answer to the question
2. Supporting evidence from the data
3. Any relevant metrics or statistics
4. Limitations of the analysis based on available data

Format your response in a clear, structured way with headings and bullet points.
`;
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: prompt }
    ];
    
    // Use the LLM to analyze the data and provide an answer
    try {
      const response = await this.openaiService.createChatCompletion(
        messages,
        {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 1000
        }
      );
      
      return response || "I was unable to analyze the data to answer your question.";
    } catch (error: any) {
      console.error('Error in processGeneralAnalysis:', error);
      
      // Try to recover with fewer documents if we hit context length limits
      if (error.message?.includes('context_length_exceeded') && docsToProcess.length > 20) {
        console.log('Retrying with fewer documents due to context length limit');
        return this.processGeneralAnalysis(query, docsToProcess.slice(0, Math.floor(docsToProcess.length / 2)));
      }
      return `I encountered an error while analyzing the data: ${error.message || 'Unknown error'}. This might be due to the large volume of information. Consider refining your query to be more specific.`;
    }
  }
  
  /**
   * Process documents in batches and combine results
   */
  private async processDocumentsInBatches(query: string, documents: Document[]): Promise<string> {
    console.log(`Processing ${documents.length} documents in batches`);
    
    // Check if the documents come from Excel files
    const isExcelData = documents.some(doc => 
      doc.metadata?.source === 'excel' || 
      (doc.content && doc.content.includes('Sheet:') && doc.content.includes('\t'))
    );
    
    if (isExcelData) {
      console.log('Detected Excel data for batch processing, using specialized Excel templates');
    }
    
    // Split documents into manageable batches
    const BATCH_SIZE = 30;
    const batches: Document[][] = [];
    
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      batches.push(documents.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Created ${batches.length} batches of documents`);
    
    // Process each batch
    const batchResults: string[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1} of ${batches.length}`);
      const batch = batches[i];
      
      // Combine batch content
      const batchContent = batch.map(doc => doc.content).join('\n\n');
      
      // Create a batch-specific prompt based on data type
      let batchPrompt: string;
      
      if (isExcelData) {
        batchPrompt = `
You are an Excel data analyst processing data in batches.

QUERY: ${query}

You are analyzing BATCH ${i + 1} of ${batches.length} from an Excel spreadsheet. 
Your task is to extract ONLY relevant numerical data, tables and key information from this batch.

EXCEL DATA (BATCH ${i + 1}/${batches.length}):
${batchContent}

INSTRUCTIONS:
- Extract only facts, figures, and information related to the query
- Pay special attention to financial totals, sums, and key metrics
- For financial data, note the exact values in their original format
- DO NOT calculate new values or provide conclusions yet
- Focus on listing key data points in a clear, tabular format where appropriate
- Include the sheet name and row references for each key piece of information
`;
      } else {
        batchPrompt = `
You are an analytical assistant tasked with analyzing a subset of a dataset.

QUERY: ${query}

You are analyzing BATCH ${i + 1} of ${batches.length} from the dataset. 
Your task is to extract ONLY relevant information and key facts from this batch.

DATA (BATCH ${i + 1}/${batches.length}):
${batchContent}

Extract only the most important facts, figures, and information related to the query.
DO NOT provide a final conclusion or answer to the query yet.
Focus on listing key findings in bullet points.
`;
      }

      const messages: ChatCompletionMessageParam[] = [
        { role: 'user', content: batchPrompt }
      ];
      
      try {
        const batchResult = await this.openaiService.createChatCompletion(
          messages,
          {
            model: 'gpt-4o-mini',
            temperature: 0.1,
            max_tokens: 800
          }
        );
        
        if (batchResult) {
          batchResults.push(batchResult);
        }
      } catch (error: any) {
        console.error(`Error processing batch ${i + 1}:`, error);
        batchResults.push(`Error processing batch ${i + 1}: ${error.message || 'Unknown error'}`);
      }
    }
    
    // Compile the final analysis from all batches
    const finalPrompt = isExcelData ? `
You are an expert Excel data analyst tasked with synthesizing information from multiple batches of spreadsheet data.

QUERY: ${query}

You have received analyses from ${batches.length} batches of Excel spreadsheet data. Your task is to synthesize this information and provide a comprehensive, precise answer to the query.

BATCH ANALYSES FROM EXCEL DATA:
${batchResults.map((result, index) => `BATCH ${index + 1}:\n${result}`).join('\n\n')}

Based on all the Excel data analyses above, please provide:
1. A direct and specific numerical answer to the query with proper formatting
2. Clear citation of specific cells, rows, or tables that support your answer
3. Precise statistics and numbers from the Excel data, maintaining their original format
4. Proper context for financial figures (currency, time period, etc.)

RESPONSE FORMAT:
## Direct Answer
[Provide the specific numerical answer with proper formatting]

## Data Analysis
[Present detailed analysis with exact figures from the spreadsheets]

## Supporting Evidence
[Include specific data points from the Excel sheets with their locations]

## Source Information
[Specify which sheets, rows, and columns the key data came from]

Remember to maintain numerical precision and provide exact figures rather than approximations.
` : `
You are an analytical assistant tasked with synthesizing information from multiple data batches.

QUERY: ${query}

You have received analysis from ${batches.length} batches of data. Your task is to synthesize this information and provide a comprehensive answer to the query.

BATCH ANALYSES:
${batchResults.map((result, index) => `BATCH ${index + 1}:\n${result}`).join('\n\n')}

Based on all the information above, please provide:
1. A direct and specific answer to the query
2. Key supporting evidence from the data
3. Notable patterns or insights
4. Any limitations in the data that affect your answer

Format your response in a clear, structured way with headings and bullet points.
`;

    const finalMessages: ChatCompletionMessageParam[] = [
      { role: 'user', content: finalPrompt }
    ];
    
    try {
      const finalResponse = await this.openaiService.createChatCompletion(
        finalMessages,
        {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 1000
        }
      );
      
      return finalResponse || "I was unable to complete the analysis due to errors in processing the data batches.";
    } catch (error: any) {
      console.error('Error in final analysis:', error);
      
      // Return partial results if we have them
      if (batchResults.length > 0) {
        return `I encountered an error while compiling the final analysis, but here are the key findings from the data I was able to process:\n\n${batchResults.join('\n\n')}`;
      }
      
      return `I encountered errors while analyzing the data: ${error.message || 'Unknown error'}. Please try a more specific query.`;
    }
  }

  /**
   * Classify the analytical intent of a query
   */
  private async classifyAnalyticalIntent(query: string): Promise<{
    type: 'count' | 'comparison' | 'trend' | 'ranking' | 'grouping' | 'general';
    entities?: string[];
    timeframe?: string;
    location?: string;
    attribute?: string;
    condition?: string;
  }> {
    const lowerQuery = query.toLowerCase();
    
    // Use regex patterns to quickly classify common query types
    // Count queries
    if (/how many|count|number of/i.test(lowerQuery)) {
      const entities = await this.extractEntitiesFromQuery(query);
      const timeframe = this.extractTimeframe(query);
      const location = this.extractLocation(query);
      const condition = this.extractCondition(query);
      
      return {
        type: 'count',
        entities,
        timeframe,
        location,
        condition
      };
    }
    
    // Comparison queries
    if (/compare|versus|vs|difference between|more than|less than/i.test(lowerQuery)) {
      return {
        type: 'comparison',
        entities: await this.extractEntitiesFromQuery(query)
      };
    }
    
    // Trend queries
    if (/trend|over time|historical|increase|decrease|growth/i.test(lowerQuery)) {
      return {
        type: 'trend',
        entities: await this.extractEntitiesFromQuery(query),
        timeframe: this.extractTimeframe(query)
      };
    }
    
    // Ranking queries
    if (/top|best|worst|highest|lowest|ranking|leaderboard/i.test(lowerQuery)) {
      return {
        type: 'ranking',
        entities: await this.extractEntitiesFromQuery(query),
        attribute: this.extractAttribute(query)
      };
    }
    
    // Grouping queries
    if (/group by|categorize|segment|break down/i.test(lowerQuery)) {
      return {
        type: 'grouping',
        entities: await this.extractEntitiesFromQuery(query),
        attribute: this.extractAttribute(query)
      };
    }
    
    // Default to general analysis for queries we can't categorize
    return {
      type: 'general',
      entities: await this.extractEntitiesFromQuery(query)
    };
  }

  /**
   * Extract simple keywords from a query
   */
  private extractKeywords(query: string): string[] {
    // Remove common stop words and extract potential entities
    const stopWords = ['how', 'many', 'much', 'is', 'are', 'the', 'in', 'on', 'at', 'of', 'for', 'a', 'an', 'to', 'with', 'by'];
    const words = query.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => !stopWords.includes(word) && word.length > 2);
    
    // Try to combine multi-word entities
    const phrases: string[] = [];
    let currentPhrase: string[] = [];
    
    keywords.forEach((word, index) => {
      currentPhrase.push(word);
      
      // If next word is not a continuation or we're at the end, save the phrase
      if (index === keywords.length - 1 || 
          !keywords[index + 1] || 
          keywords[index + 1].startsWith('?') || 
          keywords[index + 1].startsWith('!')) {
        if (currentPhrase.length > 0) {
          phrases.push(currentPhrase.join(' '));
          currentPhrase = [];
        }
      }
    });
    
    return [...new Set([...keywords, ...phrases])];
  }

  /**
   * Extract timeframe information from a query
   */
  private extractTimeframe(query: string): string | undefined {
    const timeframePatterns = [
      /in (\d+) (hour|day|week|month|year)s?/i,
      /last (\d+) (hour|day|week|month|year)s?/i,
      /past (\d+) (hour|day|week|month|year)s?/i,
      /since (\w+ \d+,? \d+)/i,
      /between (\w+ \d+,? \d+) and (\w+ \d+,? \d+)/i,
      /(january|february|march|april|may|june|july|august|september|october|november|december) \d+/i,
      /q[1-4] \d{4}/i
    ];
    
    for (const pattern of timeframePatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return undefined;
  }

  /**
   * Extract location information from a query
   */
  private extractLocation(query: string): string | undefined {
    const locationPatterns = [
      /in (\w+ \w+)/i,
      /at (\w+ \w+)/i,
      /for (\w+ \w+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match && match[1] && !match[1].match(/\d+ (hour|day|week|month|year)s?/i)) {
        return match[1];
      }
    }
    
    return undefined;
  }

  /**
   * Extract condition information from a query
   */
  private extractCondition(query: string): string | undefined {
    const conditionPatterns = [
      /(where|that) (are|is|were|was) (\w+)/i,
      /(above|below|over|under) (\d+)/i,
      /(more than|less than) (\d+)/i
    ];
    
    for (const pattern of conditionPatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return undefined;
  }

  /**
   * Extract attribute information from a query
   */
  private extractAttribute(query: string): string | undefined {
    const attributePatterns = [
      /by (\w+)/i,
      /(highest|lowest) (\w+)/i,
      /(most|least) (\w+)/i
    ];
    
    for (const pattern of attributePatterns) {
      const match = query.match(pattern);
      if (match && match[1] && !['the', 'a', 'an'].includes(match[1].toLowerCase())) {
        return match[1];
      }
    }
    
    return undefined;
  }

  /**
   * Process count analysis
   */
  private async processCountAnalysis(
    query: string, 
    documents: Document[],
    queryIntent: {
      entities?: string[];
      timeframe?: string;
      location?: string;
      condition?: string;
    }
  ): Promise<string> {
    console.log(`Processing count analysis with entities: ${queryIntent.entities?.join(', ')}`);
    
    // Handle token limit for large document sets
    if (documents.length > 50) {
      console.log(`Large document set (${documents.length}) for count analysis, using batched processing`);
      return this.processDocumentsInBatches(query, documents);
    }
    
    // Create a prompt that instructs the LLM to perform a counting analysis
    const analyticalPrompt = `
You are an analytical assistant tasked with counting entities in a dataset.

QUERY: ${query}

You need to analyze the following data to count ${queryIntent.entities?.join(' or ')} 
${queryIntent.timeframe ? `within the timeframe: ${queryIntent.timeframe}` : ''}
${queryIntent.location ? `in location: ${queryIntent.location}` : ''}
${queryIntent.condition ? `where ${queryIntent.condition}` : ''}

DATA:
${documents.map(doc => doc.content).join('\n\n')}

Perform a detailed analysis to count the relevant entities. Include:
1. The exact count of the entities requested
2. A breakdown of how you arrived at this count
3. Any relevant patterns or insights from the data
4. Mention if there are limitations in the data that prevent a complete answer

Format your response in a clear, structured way with headings and bullet points.
`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: analyticalPrompt }
    ];
    
    try {
      // Use the LLM to analyze the data and provide a count
      const response = await this.openaiService.createChatCompletion(
        messages, 
        {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 1000
        }
      );
      
      return response || "I was unable to perform the count analysis with the available data.";
    } catch (error: any) {
      console.error('Error in processCountAnalysis:', error);
      
      // Try with fewer documents if we hit token limits
      if (error.message?.includes('context_length_exceeded') && documents.length > 20) {
        console.log('Retrying count analysis with fewer documents due to token limits');
        return this.processCountAnalysis(query, documents.slice(0, Math.floor(documents.length / 2)), queryIntent);
      }
      
      return `I encountered an error while counting ${queryIntent.entities?.join(' or ')}: ${error.message || 'Unknown error'}. Try refining your query to be more specific.`;
    }
  }

  /**
   * Process comparison analysis
   */
  private async processComparisonAnalysis(
    query: string, 
    documents: Document[],
    queryIntent: {
      entities?: string[];
    }
  ): Promise<string> {
    console.log(`Processing comparison analysis for entities: ${queryIntent.entities?.join(' vs ')}`);
    
    // Handle token limit for large document sets
    if (documents.length > 50) {
      console.log(`Large document set (${documents.length}) for comparison analysis, using batched processing`);
      return this.processDocumentsInBatches(query, documents);
    }
    
    // Create a comparison analysis prompt
    const analyticalPrompt = `
You are an analytical assistant tasked with comparing entities in a dataset.

QUERY: ${query}

You need to analyze the following data to compare ${queryIntent.entities?.join(' vs ')}:

DATA:
${documents.map(doc => doc.content).join('\n\n')}

Perform a detailed comparison analysis. Include:
1. Key differences between the entities
2. Statistical comparison where possible
3. Trends or patterns observed in the comparison
4. A summary of the key findings

Format your response in a clear, structured way with headings and bullet points.
`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: analyticalPrompt }
    ];
    
    try {
      // Use the LLM to analyze the data and provide a comparison
      const response = await this.openaiService.createChatCompletion(
        messages,
        {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 1000
        }
      );
      
      return response || "I was unable to perform the comparison analysis with the available data.";
    } catch (error: any) {
      console.error('Error in processComparisonAnalysis:', error);
      
      // Try with fewer documents if we hit token limits
      if (error.message?.includes('context_length_exceeded') && documents.length > 20) {
        console.log('Retrying comparison analysis with fewer documents due to token limits');
        return this.processComparisonAnalysis(query, documents.slice(0, Math.floor(documents.length / 2)), queryIntent);
      }
      
      return `I encountered an error while comparing ${queryIntent.entities?.join(' vs ')}: ${error.message || 'Unknown error'}. Try refining your query to be more specific.`;
    }
  }

  /**
   * Process trend analysis
   */
  private async processTrendAnalysis(
    query: string, 
    documents: Document[],
    queryIntent: {
      entities?: string[];
      timeframe?: string;
    }
  ): Promise<string> {
    console.log(`Processing trend analysis for: ${queryIntent.entities?.join(', ')} over ${queryIntent.timeframe || 'time'}`);
    
    // Handle token limit for large document sets
    if (documents.length > 50) {
      console.log(`Large document set (${documents.length}) for trend analysis, using batched processing`);
      return this.processDocumentsInBatches(query, documents);
    }
    
    // Create a trend analysis prompt
    const analyticalPrompt = `
You are an analytical assistant tasked with analyzing trends in a dataset.

QUERY: ${query}

You need to analyze the following data to identify trends for ${queryIntent.entities?.join(', ')} 
${queryIntent.timeframe ? `over the timeframe: ${queryIntent.timeframe}` : 'over time'}:

DATA:
${documents.map(doc => doc.content).join('\n\n')}

Perform a detailed trend analysis. Include:
1. The overall trend direction (increasing, decreasing, stable, fluctuating)
2. Key data points that illustrate the trend
3. Rate of change over the time period
4. Any notable inflection points or anomalies
5. Potential factors influencing the trend based on the data

Format your response in a clear, structured way with headings and bullet points.
`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: analyticalPrompt }
    ];
    
    try {
      // Use the LLM to analyze the data and provide trend analysis
      const response = await this.openaiService.createChatCompletion(
        messages,
        {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 1000
        }
      );
      
      return response || "I was unable to perform the trend analysis with the available data.";
    } catch (error: any) {
      console.error('Error in processTrendAnalysis:', error);
      
      // Try with fewer documents if we hit token limits
      if (error.message?.includes('context_length_exceeded') && documents.length > 20) {
        console.log('Retrying trend analysis with fewer documents due to token limits');
        return this.processTrendAnalysis(query, documents.slice(0, Math.floor(documents.length / 2)), queryIntent);
      }
      
      return `I encountered an error while analyzing trends for ${queryIntent.entities?.join(', ')}: ${error.message || 'Unknown error'}. Try refining your query to be more specific.`;
    }
  }

  /**
   * Process ranking analysis
   */
  private async processRankingAnalysis(
    query: string, 
    documents: Document[],
    queryIntent: {
      entities?: string[];
      attribute?: string;
    }
  ): Promise<string> {
    console.log(`Processing ranking analysis for: ${queryIntent.entities?.join(', ')} by ${queryIntent.attribute || 'relevance'}`);
    
    // Handle token limit for large document sets
    if (documents.length > 50) {
      console.log(`Large document set (${documents.length}) for ranking analysis, using batched processing`);
      return this.processDocumentsInBatches(query, documents);
    }
    
    // Create a ranking analysis prompt
    const analyticalPrompt = `
You are an analytical assistant tasked with ranking entities in a dataset.

QUERY: ${query}

You need to analyze the following data to rank ${queryIntent.entities?.join(', ')} 
${queryIntent.attribute ? `by ${queryIntent.attribute}` : ''}:

DATA:
${documents.map(doc => doc.content).join('\n\n')}

Perform a detailed ranking analysis. Include:
1. A clear ordered list from highest to lowest (or most relevant to least relevant)
2. The criteria used for ranking
3. Key metrics or data points that determined each entity's rank
4. Any notable patterns or insights from the ranking

Format your response in a clear, structured way with headings and bullet points.
`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: analyticalPrompt }
    ];
    
    try {
      // Use the LLM to analyze the data and provide ranking
      const response = await this.openaiService.createChatCompletion(
        messages,
        {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 1000
        }
      );
      
      return response || "I was unable to perform the ranking analysis with the available data.";
    } catch (error: any) {
      console.error('Error in processRankingAnalysis:', error);
      
      // Try with fewer documents if we hit token limits
      if (error.message?.includes('context_length_exceeded') && documents.length > 20) {
        console.log('Retrying ranking analysis with fewer documents due to token limits');
        return this.processRankingAnalysis(query, documents.slice(0, Math.floor(documents.length / 2)), queryIntent);
      }
      
      return `I encountered an error while ranking ${queryIntent.entities?.join(', ')}: ${error.message || 'Unknown error'}. Try refining your query to be more specific.`;
    }
  }

  /**
   * Process grouping analysis
   */
  private async processGroupingAnalysis(
    query: string, 
    documents: Document[],
    queryIntent: {
      entities?: string[];
      attribute?: string;
    }
  ): Promise<string> {
    console.log(`Processing grouping analysis for: ${queryIntent.entities?.join(', ')} by ${queryIntent.attribute || 'category'}`);
    
    // Handle token limit for large document sets
    if (documents.length > 50) {
      console.log(`Large document set (${documents.length}) for grouping analysis, using batched processing`);
      return this.processDocumentsInBatches(query, documents);
    }
    
    // Create a grouping analysis prompt
    const analyticalPrompt = `
You are an analytical assistant tasked with grouping or categorizing entities in a dataset.

QUERY: ${query}

You need to analyze the following data to group ${queryIntent.entities?.join(', ')} 
${queryIntent.attribute ? `by ${queryIntent.attribute}` : 'into relevant categories'}:

DATA:
${documents.map(doc => doc.content).join('\n\n')}

Perform a detailed grouping analysis. Include:
1. Clear category definitions
2. Distribution of entities across categories
3. Key characteristics of each group
4. Any notable patterns or insights about the groupings

Format your response in a clear, structured way with headings and bullet points.
`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: analyticalPrompt }
    ];
    
    try {
      // Use the LLM to analyze the data and provide grouping
      const response = await this.openaiService.createChatCompletion(
        messages,
        {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 1000
        }
      );
      
      return response || "I was unable to perform the grouping analysis with the available data.";
    } catch (error: any) {
      console.error('Error in processGroupingAnalysis:', error);
      
      // Try with fewer documents if we hit token limits
      if (error.message?.includes('context_length_exceeded') && documents.length > 20) {
        console.log('Retrying grouping analysis with fewer documents due to token limits');
        return this.processGroupingAnalysis(query, documents.slice(0, Math.floor(documents.length / 2)), queryIntent);
      }
      
      return `I encountered an error while grouping ${queryIntent.entities?.join(', ')}: ${error.message || 'Unknown error'}. Try refining your query to be more specific.`;
    }
  }

  /**
   * Determines if a query is asking for tabular data like financial figures, statistics, etc.
   */
  private isTabularDataQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Financial terms
    if (lowerQuery.includes('revenue') || 
        lowerQuery.includes('sales') || 
        lowerQuery.includes('financial') ||
        lowerQuery.includes('segment') ||
        lowerQuery.includes('figure') ||
        lowerQuery.includes('profit') ||
        lowerQuery.includes('loss') ||
        lowerQuery.includes('income') ||
        lowerQuery.includes('margin') ||
        lowerQuery.includes('analysis')) {
      return true;
    }
    
    // Table-specific terms
    if (lowerQuery.includes('table') || 
        lowerQuery.includes('column') || 
        lowerQuery.includes('row') ||
        lowerQuery.includes('spreadsheet') ||
        lowerQuery.includes('excel') ||
        lowerQuery.includes('sheet')) {
      return true;
    }
    
    // Statistical terms
    if (lowerQuery.includes('total') || 
        lowerQuery.includes('sum') || 
        lowerQuery.includes('average') ||
        lowerQuery.includes('mean') ||
        lowerQuery.includes('median') ||
        lowerQuery.includes('statistics') ||
        lowerQuery.includes('breakdown')) {
      return true;
    }
    
    // Query patterns suggesting tabular data
    const tablePatterns = [
      /show me.+data/i,
      /list.+by/i,
      /what are the.+for each/i,
      /compare.+across/i,
      /how much.+each/i,
      /breakdown of/i,
      /values in/i
    ];
    
    for (const pattern of tablePatterns) {
      if (pattern.test(lowerQuery)) {
        return true;
      }
    }
    
    return false;
  }
} 