import { db } from '../infrastructure/database';
import { OpenAIService } from './openai.service';
import * as winston from 'winston';
import { QdrantService } from './qdrant.service';
import { ChatCompletionMessageParam } from 'openai/resources';
import { ProcessingStage, DataSourceType } from '../types/processing';
import { UniversalDataProcessorService } from './universal-data-processor.service';
import { TextSearchService } from './text-search.service';
import { DataSourceService } from './data-source.service';
import { hybridSearchEngine, QueryOptions } from './query/hybrid-search-engine.service';
import { v4 as uuidv4 } from 'uuid';
import { NlpProcessorService } from './nlp-processor.service';
import { AnalyticsProcessorService } from './analytics-processor.service';
import { StatisticalAnalysisService } from './statistical-analysis.service';
import { createServiceLogger } from '../utils/logger-factory';

// Import ModelName type from OpenAI service
type ModelName = 'gpt-4o-mini' | 'gpt-4o' | 'o3-mini' | 'o1-mini' | 'o1-preview' | string;

// Define Document interface to fix linter errors
interface Document {
  id?: string;
  content: string;
  sourceId?: string;
  sourceName?: string;
  metadata?: Record<string, any>;
}

// TextSearch service interface for fallback
interface TextSearch {
  searchByText(
    query: string,
    dataSourceId: string,
    options: {
      limit?: number;
      filter?: Record<string, any>;
      conversationId?: string;
      useRag?: boolean;
      documentId?: string;
    }
  ): Promise<any[]>;
}

/**
 * Enhanced metadata for RAG responses
 */
interface RagResponseMetadata {
  processingTime: number;
  model: string;
  collectionNames: string[];
  dataSourceIds: string[];
  dataSourceType: string;
  isQdrantResponse: boolean;
  useEnhancedVisualization: boolean;
  hasVisualization: boolean;
  visualizationData?: {
    type: string;
    data: any[];
  };
  structuredResponse?: {
    steps: string[];
    summary: string;
  };
  steps?: Array<{
    id: string;
    type: string;
    description: string;
    order: number;
    content?: string;
  }>;
  queryType?: {
    isEntityLookup: boolean;
    isEntityListing: boolean;
    isAnalytical: boolean;
    entityName: string | null;
    queryIntent: string;
  };
  analyticalInsights?: {
    basicStats: Record<string, any>;
    topDistributions: Record<string, any>;
    keyPatterns: Array<{
      category: string;
      values: any[];
    }>;
    recommendations?: string[];
  };
  error?: string;
  errorMessage?: string;
}

// Define the RagResponse interface if not already defined elsewhere
interface RagResponse {
  sources: any[];
  content: string;
  model: string;
  metadata: RagResponseMetadata;
}

// Add this near the top of the file with other interfaces
declare interface IStatisticalAnalysisService {
  analyze(data: any[], analysisType: string, options?: any): Promise<any>;
}

/**
 * RAG (Retrieval Augmented Generation) service
 */
export class RagService {
  private openaiService: OpenAIService;
  private qdrantService: QdrantService;
  private textSearchService: TextSearchService;
  private universalDataProcessor: UniversalDataProcessorService;
  private logger: winston.Logger;
  
  // Replace any types with proper types
  private nlpProcessor: NlpProcessorService;
  private analyticsProcessor: AnalyticsProcessorService;
  private statisticalAnalysis: any;

  constructor() {
    // Initialize existing services
    this.openaiService = OpenAIService.getInstance();
    this.qdrantService = QdrantService.getInstance();
    this.textSearchService = new TextSearchService();
    this.universalDataProcessor = UniversalDataProcessorService.getInstance();
    this.logger = createServiceLogger('RagService');
    
    this.logger.info('Initializing RAG service with analytical capabilities');
    
    // Initialize specialized analytical services
    try {
      this.nlpProcessor = NlpProcessorService.getInstance();
      this.analyticsProcessor = AnalyticsProcessorService.getInstance();
      this.statisticalAnalysis = StatisticalAnalysisService.getInstance();
      this.logger.info('Successfully initialized all analytical processing services');
    } catch (error) {
      this.logger.warn(`Some analytical processing services could not be initialized: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Set up progress tracking for Universal Data Processor
    this.universalDataProcessor.setProgressCallback((stage, progress, message) => {
      this.logger.info(`Processing stage: ${stage}, Progress: ${progress}%, Message: ${message || 'N/A'}`);
    });
  }

  /**
   * Analyze a user query to determine its intent and processing requirements
   * Enhanced with NLP processing when available
   */
  private analyzeQueryIntent(query: string): {
    isAnalytical: boolean;
    limit: number;
    similarityThreshold: number;
    entityTypes: string[];
    complexity: 'high' | 'medium' | 'low';
  } {
    const lowerQuery = query.toLowerCase();
    
    // Default settings
    const result = {
      isAnalytical: false,
      limit: 10,
      similarityThreshold: 0.7,
      entityTypes: [] as string[],
      complexity: 'medium' as 'high' | 'medium' | 'low'
    };
    
    // Check for analytical intent
    const analyticalPatterns = [
      /analyze|analysis|trend|compare|comparison|statistics|statistical|correlation|correlate|percentage|proportion|distribution|average|mean|median|frequency|count/i
    ];
    
    if (analyticalPatterns.some(pattern => pattern.test(query))) {
      result.isAnalytical = true;
      result.limit = 50; // Higher limit for analytical queries
      result.similarityThreshold = 0.5; // Lower threshold for analytical queries
      result.complexity = 'high';
    }
    
    // Check for entity-focused queries
    const entityPatterns = [
      { pattern: /investor|vc|fund|venture capital/i, type: 'investor' },
      { pattern: /company|startup|business/i, type: 'company' },
      { pattern: /person|individual|founder|executive/i, type: 'person' }
    ];
    
    for (const { pattern, type } of entityPatterns) {
      if (pattern.test(query)) {
        result.entityTypes.push(type);
      }
    }
    
    // Check for complex queries (long questions, multiple conditions, etc.)
    if (query.length > 150 || query.split(' ').length > 25 || query.includes(' and ') && query.includes(' or ')) {
      result.complexity = 'high';
    } else if (query.length < 50 && !query.includes('?')) {
      result.complexity = 'low';
    }
    
    return result;
  }
  
  /**
   * Process a query with the universal approach
   * @param query User query
   * @param dataSourceIds Data sources to query against
   * @param queryAnalysis Analysis of query intent
   * @returns Response with sources and content
   */
  private async processUniversalQuery(
    query: string,
    dataSourceIds: string[] | number[],
    queryAnalysis: ReturnType<typeof this.analyzeQueryIntent>
  ): Promise<{
    sources: any[];
    content: string;
    model?: string;
    analysis?: {
      steps: string[];
      summary: string;
    };
    metadata?: any;
  }> {
    this.logger.info(`Processing universal query: "${query}"`);
    
    // Track processing steps for debugging
    const processingSteps: string[] = [];
    processingSteps.push(`Processing query: "${query}"`);
    
    const allSources: any[] = [];
    
    // Track query start time
    const startTime = performance.now();
    
    // Determine document limit based on query complexity
    // Use a high limit for all queries to ensure comprehensive retrieval
    const docLimit = 1000; // High limit for all query types
    processingSteps.push(`Using document limit: ${docLimit}`);
    
    // Get embedding for query
    const embeddingResult = await this.openaiService.createEmbeddings(query);
    const embedding = embeddingResult[0];
    processingSteps.push('Generated query embedding');
    
    // Fetch document embeddings
    for (const sourceId of dataSourceIds) {
      try {
        // Get embedding for query
        const embeddingResult = await this.openaiService.createEmbeddings(query);
        const embedding = embeddingResult[0];
        
        // Search for relevant documents with high limit and low threshold
        const collectionResults = await this.qdrantService.search(
          this.normalizeCollectionName(sourceId.toString()),
          embedding,
          undefined, // No filter
          docLimit   // Use high limit for all queries
        );
        
        if (collectionResults && collectionResults.length > 0) {
          // Process results into standard format
          const formattedResults = collectionResults.map(result => {
            const content = result.payload?.text || result.payload?.content || '';
            const metadata = result.payload?.metadata || {};
            return {
              content,
              metadata,
              sourceId: sourceId.toString(),
              id: result.id,
              score: result.score
            };
          });
          
          allSources.push(...formattedResults);
          processingSteps.push(`Found ${formattedResults.length} documents in data source ${sourceId}`);
          this.logger.info(`Found ${formattedResults.length} documents in collection ${sourceId}`);
        }
      } catch (error) {
        this.logger.error(`Error searching data source ${sourceId}: ${error.message}`);
        processingSteps.push(`Error searching data source ${sourceId}: ${error.message}`);
      }
    }
    
    this.logger.info(`Found ${allSources.length} total documents across all data sources`);
    processingSteps.push(`Retrieved ${allSources.length} total documents across all data sources`);
    
    // Proceed only if we have documents
    if (allSources.length === 0) {
      return {
        sources: [],
        content: `I couldn't find any relevant information about "${query}" in the provided data sources.`,
        analysis: {
          steps: processingSteps,
          summary: 'No relevant documents found.'
        }
      };
    }
    
    // Sort by relevance and deduplicate
    let sources = this.deduplicateDocuments(allSources);
    sources.sort((a, b) => (b.score || 0) - (a.score || 0));
    processingSteps.push(`Sorted and deduplicated documents, resulting in ${sources.length} documents`);
    
    // Extract structured data from the documents
    const structuredData = this.extractStructuredData(sources, query);
    processingSteps.push(`Extracted structured data from documents`);
    
    // Extract a reasonable amount of content for the LLM, focusing on the most relevant documents
    const context = this.prepareDocumentsForLLM(sources, 100000); // Use a larger context size
    processingSteps.push(`Prepared document context for LLM processing`);
    
    // Enhance prompt with structured data insights
    let structuredDataInsights = '';
    if (structuredData.entityCounts) {
      const topEntities = Object.entries(structuredData.entityCounts)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 20); // Get top 20 entities
      
      structuredDataInsights += `\nEntities mentioned in documents (with frequency):\n`;
      structuredDataInsights += topEntities.map(([entity, count]) => `- ${entity}: ${count} mentions`).join('\n');
    }
    
    if (structuredData.tableData) {
      structuredDataInsights += `\n\nTable data found in documents (sample):\n`;
      const sampleRows = structuredData.tableData.slice(0, 5); // Show first 5 rows
      for (const row of sampleRows) {
        structuredDataInsights += `- ${Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }
    }
    
    // Create prompt for LLM
    const prompt = `I need you to answer a question based on the provided information from our knowledge base. The user's query is: "${query}"
    
Here's what I found in our database:
${context}

${structuredDataInsights ? `\nAdditional structured data insights:\n${structuredDataInsights}` : ''}

Please provide a detailed response that addresses the query. Break down your answer into parts with clear section headings. If appropriate, include a "Summary" section at the beginning and an "Analysis" section that breaks down the data.

For any numerical or categorical data you mention, organize it in a way that would be suitable for visualization (e.g., as a table, chart, or graph).

If the data includes information about specific entities (companies, people, etc.), highlight key details about them systematically.`;
    
    processingSteps.push(`Created prompt for LLM response generation`);
    
    // Select appropriate model based on complexity
    // Use a default complexity if not available in the queryAnalysis
    const complexity = queryAnalysis.complexity || 'medium';
    const modelToUse = this.selectModelForAnalysis(complexity as 'high' | 'medium' | 'low');
    processingSteps.push(`Selected model for response: ${modelToUse}`);
    
    // Generate response from LLM
    const messages = [
      { role: 'system', content: 'You are a helpful assistant that provides thorough, accurate, well-structured responses based on the provided information. You never make up facts or sources. If you don\'t know something, say so clearly.' },
      { role: 'user', content: prompt }
    ] as any[]; // Use type assertion to fix the ChatCompletionMessageParam issue
    
    const completionStartTime = performance.now();
    const completion = await this.openaiService.generateChatCompletion(messages, {
      model: modelToUse as any,
      temperature: 0.2 // Lower temperature for more factual responses
    });
    const completionTime = Math.round(performance.now() - completionStartTime);
    processingSteps.push(`Generated response using ${modelToUse} in ${completionTime}ms`);
    
    // Extract content from response
    let content = '';
    if (completion && 'choices' in completion && completion.choices && completion.choices.length > 0) {
      content = completion.choices[0].message.content || '';
    }
    
    // Create visualization data from structured data
    let visualizationData = null;
    if (structuredData.entityCounts) {
      visualizationData = {
        type: 'bar',
        data: Object.entries(structuredData.entityCounts)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 15) // Take top 15 for visualization
          .map(([category, value]) => ({ category, value }))
      };
    } else if (structuredData.tableData) {
      // Create a visualization from table data if present
      visualizationData = {
        type: 'table',
        data: structuredData.tableData
      };
    }
    
    // Return results
    return {
      sources,
      content,
      model: modelToUse,
      analysis: {
        steps: processingSteps,
        summary: `Found ${sources.length} relevant documents across ${new Set(sources.map(s => s.sourceId)).size} data sources.`
      },
      metadata: {
        processingTime: Math.round(performance.now() - startTime),
        collectionNames: Array.from(new Set(sources.map(s => s.metadata?.collectionName || ''))).filter(Boolean),
        visualizationData,
        hasVisualization: !!visualizationData,
        useEnhancedVisualization: true
      }
    };
  }

  /**
   * Extract structured response data from content
   * Simplified support method for processUniversalQuery
   */
  private async extractStructuredResponseFromContent(content: string): Promise<string> {
    // Extract any structured data if available
    try {
      // Look for markdown sections
      const sections = content.split(/#+\s+/);
      if (sections.length > 1) {
        // Find summary section if available
        const summarySection = sections.find(s => 
          s.toLowerCase().startsWith('summary') || 
          s.toLowerCase().startsWith('overview')
        );
        
        if (summarySection) {
          return summarySection.trim();
        }
      }
      
      // Fallback: just take the first couple of sentences
      const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
      if (sentences.length > 2) {
        return sentences.slice(0, 2).join('. ') + '.';
      }
      
      return content.substring(0, 200) + '...';
    } catch (error) {
      this.logger.error(`Error extracting structured data: ${error.message}`);
      return "Structured data extraction failed.";
    }
  }

  /**
   * Helper to create error responses with consistent format
   */
  private createErrorResponse(
    message: string,
    errorCode: string,
    startTime: number,
    dataSourceIds: string[],
    error?: any
  ): any {
    return {
      sources: [],
      content: message,
      metadata: {
        processingTime: performance.now() - startTime,
        model: 'gpt-4o-mini', // Default model for error responses
        collectionNames: [],
        dataSourceIds,
        dataSourceType: 'qdrant',
        isQdrantResponse: true,
        useEnhancedVisualization: false,
        hasVisualization: false,
        error: errorCode,
        errorMessage: error instanceof Error ? error.message : (error ? String(error) : undefined)
      } as RagResponseMetadata
    };
  }

  /**
   * Retrieve documents from all specified data sources
   */
  private async retrieveDocumentsFromAllSources(
    query: string,
    dataSourceIds: string[]
  ): Promise<{
    documents: any[];
    collectionNames: string[];
  }> {
    try {
      this.logger.info(`Retrieving documents for query: "${query}" from ${dataSourceIds.length} sources`);
      
      // Initialize results
      const documents: any[] = [];
      const collectionNames: string[] = [];
      
      // Process each data source
      for (const sourceId of dataSourceIds) {
        try {
          // Always use findCorrectCollectionName to reliably find the collection
          const collectionName = await this.findCorrectCollectionName(sourceId.toString());
          
          if (!collectionName) {
            this.logger.warn(`Could not find a collection for data source ID: ${sourceId}`);
            continue;
          }
          
          this.logger.info(`Using collection: ${collectionName} for source ID: ${sourceId}`);
          collectionNames.push(collectionName);
          
          // Check if collection exists in Qdrant
          const collectionExists = await this.qdrantService.collectionExists(collectionName);
          if (!collectionExists) {
            this.logger.warn(`Collection ${collectionName} does not exist in Qdrant`);
            continue;
          }
          
          // Custom search parameters based on query intent
          const queryAnalysis = this.analyzeQueryIntent(query);
          
          // Get embedding for query
          const embedding = await this.openaiService.createEmbeddings([query]);
          
          // Check Snowflake data source specifics
          const isSnowflakeCollection = collectionName.includes('snowflake');
          const isSnowflakeQuery = query.toLowerCase().includes('snowflake') || 
                                 query.toLowerCase().includes('database') || 
                                 query.toLowerCase().includes('table') ||
                                 query.toLowerCase().includes('sql');
          
          // Customize search parameters based on query and collection type
          let searchLimit = 10;
          let scoreThreshold = 0.5;
          let hasFilter = false;
          
          if (isSnowflakeCollection || isSnowflakeQuery) {
            searchLimit = 20; // Use a higher limit for Snowflake collections to capture more table data
            scoreThreshold = 0.4; // Lower threshold for Snowflake data
          }
          
          const filter = {}; // No filters for now
          
          // Execute search with the embedded query vector
          let searchResults = await this.qdrantService.search(
            collectionName,
            embedding[0],
            filter,
            searchLimit
          );
          
          this.logger.info(`Found ${searchResults.length} results in collection ${collectionName}`);
          
          // Map results to a consistent format
          const documentResults = searchResults.map(result => ({
            id: result.id,
            content: result.payload?.text || result.payload?.content || '',
            metadata: {
              ...result.payload?.metadata,
              score: result.score,
              dataSourceId: sourceId,
              collectionName
            }
          }));
          
          // Add to all documents
          documents.push(...documentResults);
        } catch (error) {
          this.logger.error(`Error retrieving documents for data source ${sourceId}: ${error}`);
        }
      }

      // Deduplicate documents
      const dedupedDocuments = this.deduplicateDocuments(documents);
      this.logger.info(`Retrieved ${documents.length} total documents, ${dedupedDocuments.length} after deduplication`);

      return {
        documents: dedupedDocuments,
        collectionNames
      };
    } catch (error) {
      this.logger.error(`Error retrieving documents: ${error}`);
      return {
        documents: [],
        collectionNames: []
      };
    }
  }

  /**
   * Enhance a query to better match structured data
   * @param query The original user query
   * @returns An enhanced query for structured data search
   */
  private enhanceQueryForStructuredData(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Don't enhance if already mentioning tables or database specifics
    if (lowerQuery.includes('table') || 
        lowerQuery.includes('column') || 
        lowerQuery.includes('database')) {
      return query;
    }
    
    // Get more specific for product count queries - highly targeted enhancement
    if ((lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('total')) &&
        (lowerQuery.includes('product') || lowerQuery.includes('items'))) {
      // These are very specific enhancements to match product count information
      const enhancements = [
        `PRODUCTS table information ${query}`,
        `product count in DIANA_SALES_ES database ${query}`,
        `counting unique products ${query}`,
        `table data for product counts ${query}`,
        `count distinct product_id ${query}`,
      ];
      
      // Return a random enhancement from the list for variety
      return enhancements[Math.floor(Math.random() * enhancements.length)];
    }
    
    // For queries specifically about products
    if (lowerQuery.includes('product')) {
      return `PRODUCTS table data ${query}`;
    }
    
    // If query is asking about generic counts or totals
    if (lowerQuery.includes('how many') || 
        lowerQuery.includes('count') || 
        lowerQuery.includes('total')) {
      return `table data ${query}`;
    }
    
    // For queries about sales or transactions
    if (lowerQuery.includes('sales') || 
        lowerQuery.includes('transaction') ||
        lowerQuery.includes('purchase')) {
      return `TRANSACTIONS table data ${query}`;
    }
    
    // Diana-specific enhancer
    if (lowerQuery.includes('diana')) {
      return `DIANA_SALES_ES database information ${query}`;
    }
    
    return query;
  }

  /**
   * Generate a response based on retrieved documents
   */
  private async generateResponse(
    query: string,
    documents: any[]
  ): Promise<{
    content: string;
    model: string;
  }> {
    this.logger.info(`Stage: ${ProcessingStage.GENERATING_RESPONSE} - Creating response from ${documents.length} documents`);
    
    try {
      // Analyze the document content to determine the type
      const contentAnalysis = this.analyzeSourceContent(documents);
      
      // Select the appropriate model based on content complexity and type
      let model: string;
      
      if (contentAnalysis.contentType === 'technical' || contentAnalysis.contentType === 'structured') {
        model = 'gpt-4o'; // Use more capable model for complex content
      } else {
        // Start with a faster model for regular content
        model = 'o3-mini';
        
        // If there's a lot of content or it seems complex, upgrade the model
        const totalContentLength = documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0);
        if (totalContentLength > 10000 || contentAnalysis.structure === 'table') {
          model = 'gpt-4o-mini'; // Use higher capacity model for large/complex content
        }
      }
      
      // Format content for the prompt
      let combinedContent = documents
        .slice(0, 12) // Limit to top 12 documents to avoid token limits
        .map((doc, i) => {
          return `[Document ${i+1}]:\n${doc.content}`;
        })
        .join('\n\n');
      
      // Extract tables from the content and add them to the prompt
      const tables = this.extractTablesFromDocuments(documents);
      if (tables.length > 0) {
        combinedContent += '\n\n[Tables]:\n' + tables.join('\n\n');
      }
      
      // Build the prompt
      const prompt = `Answer the following question based on the provided documents:
Question: ${query}

${combinedContent}

Please provide a comprehensive answer. If the documents don't contain the information needed, state that you don't have the specific information. 
Format your response in a clear, structured way.`;
      
      // Generate the response
      this.logger.info(`Using model: ${model} to generate response`);
      const completion = await this.openaiService.generateChatCompletion([
        { role: 'system', content: 'You are a helpful assistant that provides accurate, data-driven answers based on the information provided in documents.' },
        { role: 'user', content: prompt }
      ], {
        model: model as any,
        temperature: 0.3
      });
      
      // Extract the content
      // @ts-ignore - Runtime type checking for choices
      const content = completion?.choices?.[0]?.message?.content || '';
      
      this.logger.info(`Stage: ${ProcessingStage.PARSING_RESPONSE} - Finalizing generated content`);
      
      if (!content) {
        throw new Error('Failed to generate response content');
      }
      
      return { content, model };
    } catch (error) {
      this.logger.error(`Error generating response: ${error}`);
      
      // Provide a fallback response
      return {
        content: "I apologize, but I encountered an issue while processing your query. Please try again or rephrase your question.",
        model: 'fallback'
      };
    }
  }

  /**
   * Detect if the user is trying to switch between data sources
   */
  private detectDataSourceContextSwitch(
    query: string, 
    dataSourcesInfo: Array<{id: string | number, name: string, type: string}>,
    activeDataSourceId: string | number | null
  ): {shouldSwitch: boolean; newDataSourceId?: string | number} {
    if (!dataSourcesInfo || dataSourcesInfo.length <= 1) {
      return { shouldSwitch: false };
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Check for explicit data source switching intent
    const switchPatterns = [
      /switch\s+to\s+(.+?)(?:\s+data|file|table|source|data\s+source|\s+dataset|$)/i,
      /use\s+(.+?)(?:\s+data|file|table|source|data\s+source|\s+dataset|$)/i,
      /look\s+at\s+(.+?)(?:\s+data|file|table|source|data\s+source|\s+dataset|$)/i,
      /analyze\s+(.+?)(?:\s+data|file|table|source|data\s+source|\s+dataset|$)/i,
      /query\s+(.+?)(?:\s+data|file|table|source|data\s+source|\s+dataset|$)/i
    ];
    
    for (const pattern of switchPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const targetName = match[1].trim().toLowerCase();
        
        // Find the best matching data source
        const matchedSource = dataSourcesInfo.find(source => {
          const sourceName = source.name.toLowerCase();
          return sourceName.includes(targetName) || 
                 targetName.includes(sourceName) ||
                 this.getStringMatchScore(sourceName, targetName) > 0.7;
        });
        
        if (matchedSource && matchedSource.id !== activeDataSourceId) {
          return { shouldSwitch: true, newDataSourceId: matchedSource.id };
        }
      }
    }
    
    // No clear switch detected
    return { shouldSwitch: false };
  }

  /**
   * Calculate string similarity score
   */
  private getStringMatchScore(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Simple word overlap score
    const words1 = new Set(s1.split(/\W+/).filter(word => word.length > 1));
    const words2 = new Set(s2.split(/\W+/).filter(word => word.length > 1));
    
    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }
    
    let matchCount = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        matchCount++;
      }
    }
    
    return matchCount / Math.max(words1.size, words2.size);
  }

  /**
   * Analyze source content to determine appropriate response format
   */
  private analyzeSourceContent(sources: any[]): {
    contentType: 'tabular' | 'text' | 'structured' | 'technical';
    structure: 'table' | 'list' | 'paragraphs' | 'steps' | 'code' | 'mixed';
    detected?: string;
    metadata?: any;
  } {
    // Define the result object with proper type annotations to allow property assignment
    const result: {
      contentType: 'tabular' | 'text' | 'structured' | 'technical';
      structure: 'table' | 'list' | 'paragraphs' | 'steps' | 'code' | 'mixed';
      detected?: string;
      metadata: any;
    } = {
      contentType: 'text',
      structure: 'paragraphs',
      metadata: {}
    };
    
    // Combine all source content for analysis
    const combinedText = sources.map(s => s.content || '').join('\n\n');
    
    // Check for tabular data patterns
    const hasTabularData = this.containsTabularData(combinedText);
    if (hasTabularData) {
      result.contentType = 'tabular';
      result.structure = 'table';
      result.detected = 'table';
      result.metadata = { tableType: 'general' };
    }
    
    // Check for code or technical content
    const codePattern = /```|\bfunction\b|\bclass\b|\bimport\b|\bexport\b|\bconst\b|\blet\b|\bvar\b|\bif\b.*\{|\bfor\b.*\{|\bwhile\b.*\{/;
    if (codePattern.test(combinedText)) {
      result.contentType = 'technical';
      result.structure = 'code';
      result.detected = 'code';
    }
    
    // Check for list-formatted content
    const listPattern = /(?:\n\s*[-*•]\s+.*){3,}/;
    if (listPattern.test(combinedText)) {
      result.structure = 'list';
      result.detected = 'list';
    }
    
    // Check for numbered steps
    const stepsPattern = /(?:\n\s*\d+\.\s+.*){3,}/;
    if (stepsPattern.test(combinedText)) {
      result.structure = 'steps';
      result.detected = 'steps';
    }
    
    return result;
  }

  /**
   * Check if content contains tabular data (CSV, table format, etc.)
   */
  private containsTabularData(content: string): boolean {
    // Check for CSV format (comma-separated values with consistent columns)
    const csvLines = content.split('\n').filter(line => line.trim().length > 0);
    if (csvLines.length >= 3) {
      // Check if a consistent number of commas appears in multiple lines
      const commaCount = csvLines.map(line => (line.match(/,/g) || []).length);
      const isConsistent = commaCount.slice(1).some(count => count === commaCount[0] && count > 0);
      
      if (isConsistent) {
        return true;
      }
    }
    
    // Check for markdown table format
    const markdownTablePattern = /\|\s*[\w\s]+\s*\|.*\|\s*[-:]+\s*\|/;
    if (markdownTablePattern.test(content)) {
      return true;
    }
    
    // Check for structured data with key-value pairs (appears in many formats)
    const keyValuePattern = /^[\w\s-]+:.*\n^[\w\s-]+:.*\n^[\w\s-]+:.*/m;
    if (keyValuePattern.test(content)) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
    // Calculate cosine similarity between two vectors
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Extract markdown tables from content
   * @param content Content that may contain markdown tables
   * @returns Array of markdown table strings
   */
  private extractMarkdownTables(content: string): string[] {
    const tables: string[] = [];
    const lines = content.split('\n');
    
    let currentTable: string[] = [];
    let inTable = false;
    
    for (const line of lines) {
      // Check if line is part of a table (contains | character)
      if (line.includes('|')) {
        if (!inTable) {
          inTable = true;
        }
        currentTable.push(line);
      } else if (inTable && line.trim() === '') {
        // Empty line after table - end of table
        if (currentTable.length > 0) {
          tables.push(currentTable.join('\n'));
          currentTable = [];
          inTable = false;
        }
      } else if (inTable) {
        // Non-empty line that doesn't contain |, might be end of table
        if (currentTable.length > 0) {
          tables.push(currentTable.join('\n'));
          currentTable = [];
          inTable = false;
        }
      }
    }
    
    // Handle case where the file ends with a table without a blank line
    if (inTable && currentTable.length > 0) {
      tables.push(currentTable.join('\n'));
    }
    
    return tables;
  }
  
  /**
   * Remove markdown tables from content to avoid duplication
   * @param content Content containing markdown tables
   * @returns Content with tables removed
   */
  private removeMarkdownTables(content: string): string {
    const lines = content.split('\n');
    const filteredLines: string[] = [];
    
    let inTable = false;
    
    for (const line of lines) {
      if (line.includes('|')) {
        inTable = true;
        continue;
      } else if (inTable && line.trim() === '') {
        inTable = false;
        continue;
      } else if (!inTable) {
        filteredLines.push(line);
      }
    }
    
    return filteredLines.join('\n');
  }

  /**
   * Extract entities from text content
   */
  private extractEntitiesFromContent(content: string | any): string[] {
    if (!content) return [];
    
    // If content is an object or array, try to extract the text
    let textContent = '';
    if (typeof content === 'string') {
      textContent = content;
    } else if (typeof content === 'object') {
      // Handle potential ChatCompletionContentPart array or other structures
      if (Array.isArray(content)) {
        textContent = content
          .map(part => typeof part === 'object' && part.text ? part.text : String(part))
          .join(' ');
      } else if (content.text) {
        textContent = content.text;
      } else if (content.content) {
        textContent = content.content;
      } else {
        // Last resort: try to convert to string
        try {
          textContent = String(content);
        } catch (e) {
          return [];
        }
      }
    }
    
    if (!textContent.trim()) return [];
    
    const entities: string[] = [];
    
    // Look for proper nouns (capitalized phrases)
    const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const properNouns = textContent.match(properNounPattern) || [];
    entities.push(...properNouns);
    
    // Check for entities after common indicators
    const entityIndicators = [
      /about\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /regarding\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is/gi,
    ];
    
    for (const pattern of entityIndicators) {
      const matches = Array.from(textContent.matchAll(pattern));
      for (const match of matches) {
        if (match[1]) entities.push(match[1]);
      }
    }
    
    // Filter out common words that aren't likely to be entities
    const commonWords = [
      'I', 'You', 'We', 'They', 'He', 'She', 'It', 'This', 'That', 'These', 'Those',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return [...new Set(entities)]
      .filter(entity => !commonWords.includes(entity) && entity.length > 1);
  }

  /**
   * Determine if the query is specifically asking for a document summary
   */
  private isDocumentSummaryQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Patterns that strongly indicate a document summary request
    const summaryPatterns = [
      /summarize this document/i,
      /document summary/i,
      /summary of this document/i,
      /summary of the document/i,
      /summarize the document/i,
      /provide a summary/i,
      /give me a summary/i,
      /what is this document about/i,
      /what's in this document/i,
      /overview of this document/i,
      /overview of the document/i,
      /tell me about this document/i,
      /explain this document/i,
      /what does this document contain/i,
      /what is the content of this document/i,
      /what information is in this document/i,
      /what are the key points in this document/i,
      /main points of this document/i,
      /key takeaways from this document/i,
      /tldr/i
    ];
    
    // Check if any of the patterns match
    return summaryPatterns.some(pattern => pattern.test(lowerQuery));
  }

  /**
   * Detect entity count queries from natural language
   */
  private detectEntityCountQuery(query: string): { isEntityCountQuery: boolean; entityType?: string; pattern?: RegExp } {
    if (!query) return { isEntityCountQuery: false };
    
    const lowerQuery = query.toLowerCase();
    
    // Common entity count patterns
    const patterns = [
      { type: 'company', pattern: /(how many|count|number of|list) (companies|firms|corporations|organizations|businesses)/i },
      { type: 'person', pattern: /(how many|count|number of|list) (people|persons|individuals|names)/i },
      { type: 'location', pattern: /(how many|count|number of|list) (locations|places|countries|cities|addresses)/i },
      { type: 'date', pattern: /(how many|count|number of|list) (dates|times|years|months)/i },
      { type: 'fund', pattern: /(how many|count|number of|list) (funds|investments|rounds|deals)/i }
    ];
    
    for (const { type, pattern } of patterns) {
      if (pattern.test(lowerQuery)) {
        return { isEntityCountQuery: true, entityType: type, pattern };
      }
    }
    
    return { isEntityCountQuery: false };
  }

  /**
   * Determines if a query is analytical in nature, requiring more
   * sophisticated processing and visualization.
   * Uses the AnalyticsProcessorService for better detection.
   */
  private isAnalyticalQuery(query: string): boolean {
    try {
      // Use the analytics processor service to leverage its more sophisticated detection
      if (this.analyticsProcessor) {
        return this.analyticsProcessor.isAnalyticalQuery(query);
      }
      
      // Fallback implementation if the service is not available
    const analyticalKeywords = [
        'analyze', 'compare', 'trend', 'distribution', 'correlation',
        'statistics', 'insights', 'patterns', 'breakdown', 'metrics'
      ];
      
      const normalizedQuery = query.toLowerCase();
      
      // Check for analytical keywords
      for (const keyword of analyticalKeywords) {
        if (normalizedQuery.includes(keyword)) {
          return true;
        }
      }
      
      // Check for analytical patterns
      const analyticalPatterns = [
        /how (many|much)/i,
        /what is the (total|average|sum)/i,
        /show me the (top|bottom)/i,
        /compare .* (to|with|against)/i,
        /relationship between/i,
        /correlation between/i,
        /trend (of|in)/i,
        /over (time|the past|the last)/i,
        /growth (rate|percentage)/i
      ];
      
      for (const pattern of analyticalPatterns) {
        if (pattern.test(normalizedQuery)) {
      return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.warn(`Error in isAnalyticalQuery: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Process a document summary query
   */
  private async processDocumentSummaryQuery(
    query: string,
    dataSourceIds: string[] | number[]
  ): Promise<{
    sources: any[];
    content: string;
    model?: string;
  }> {
    this.logger.info(`Processing document summary query: "${query}"`);
    
    try {
      // Get random samples from collections to provide an overview
      const samples = [];
      
      for (const sourceId of dataSourceIds) {
        const collectionName = this.normalizeCollectionName(sourceId.toString());
        try {
          // Create a random vector for search (to get diverse results)
          const randomVector = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
          
          // Assuming we have 5 samples per collection
          const collectionSamples = await this.qdrantService.search(
            collectionName,
            randomVector,
            { limit: 5 }
          );
          
          if (collectionSamples && collectionSamples.length > 0) {
            samples.push(...collectionSamples);
          }
        } catch (error) {
          this.logger.warn(`Error getting samples from ${collectionName}: ${error}`);
        }
      }
      
      if (samples.length === 0) {
        return {
          sources: [],
          content: "I couldn't find any document samples to summarize. The collection might be empty or there was an error accessing it."
        };
      }
      
      // Use OpenAI to generate a summary of the documents
      const systemPrompt = `You are an AI assistant tasked with summarizing a collection of documents. 
      Provide a concise overview of the document collection based on the samples provided.`;
      
      const samplesText = samples.map(s => s.content || s.payload?.text || "").join("\n\n");
      
      // Select a model for the completion
      const modelName = 'o3-mini';
      
      // Prepare the prompt for the model
      const prompt = `Please provide a summary of this document collection. Here are some samples:\n\n${samplesText.substring(0, 6000)}`;
      
      // Get a completion from the model
      try {
        // Try to use the selectModelForQuery and generateChatCompletion methods
        const selectedModel = this.openaiService.selectModelForQuery(prompt);
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: prompt }
        ];
        
        const completion = await this.openaiService.generateChatCompletion(messages, {
          temperature: 0.7,
          model: selectedModel
        });
        
        let summary = "I couldn't generate a summary of the documents.";
        let model = selectedModel;
        
        // Check if the response has the expected structure
        if (completion && typeof completion === 'object') {
          if ('choices' in completion && 
              Array.isArray(completion.choices) && 
              completion.choices.length > 0 &&
              completion.choices[0].message) {
            summary = completion.choices[0].message.content || summary;
          }
          
          if ('model' in completion) {
            // Just use a known valid model name as fallback
            model = 'o3-mini';
          }
        }
        
        return {
          sources: samples.map(s => ({
            content: s.content || s.payload?.text || "",
            metadata: s.metadata || s.payload?.metadata || {},
            sourceId: s.sourceId || s.id,
            sourceName: s.sourceName || "Document Sample"
          })),
          content: summary,
          model: model
        };
      } catch (aiError) {
        this.logger.error(`Error generating summary with AI: ${aiError}`);
        return {
          sources: samples.map(s => ({
            content: s.content || s.payload?.text || "",
            metadata: s.metadata || s.payload?.metadata || {},
            sourceId: s.sourceId || s.id,
            sourceName: s.sourceName || "Document Sample"
          })),
          content: "I encountered an error while trying to summarize the document collection."
        };
      }
    } catch (error) {
      this.logger.error(`Error processing document summary query: ${error}`);
      return {
        sources: [],
        content: "I encountered an error while trying to summarize the document collection."
      };
    }
  }

  /**
   * Process an entity count query
   */
  private async processEntityCountQuery(
    query: string,
    dataSourceIds: string[] | number[],
    entityType: string,
    pattern: RegExp
  ): Promise<{
    sources: any[];
    content: string;
    model?: string;
  }> {
    this.logger.info(`Processing entity count query for ${entityType}: "${query}"`);
    
    try {
      // Get documents from collections
      const documents = [];
      
      for (const sourceId of dataSourceIds) {
        const collectionName = this.normalizeCollectionName(sourceId.toString());
        
        // Get embedding for query to find relevant documents
        const embeddingResult = await this.openaiService.createEmbeddings(query);
        const embedding = embeddingResult[0]; // Get the first embedding
        
        try {
          // Search for relevant documents
          const results = await this.qdrantService.search(
            collectionName,
            embedding, 
            { limit: 50 }
          );
          
          if (results && results.length > 0) {
            documents.push(...results);
          }
        } catch (error) {
          this.logger.warn(`Error searching ${collectionName}: ${error}`);
        }
      }
      
      if (documents.length === 0) {
        return {
          sources: [],
          content: `I couldn't find any relevant documents to count ${entityType} entities. The collection might be empty or there was an error accessing it.`
        };
      }
      
      // Use OpenAI to extract and count entities
      const systemPrompt = `You are an AI assistant tasked with counting ${entityType} entities in a collection of documents. 
      Extract and count all unique ${entityType} entities from the documents provided.`;
      
      // Combine document contents, limited to avoid token limits
      const combinedContent = documents
        .map(d => d.content || d.payload?.text || "")
        .join("\n\n")
        .substring(0, 10000);
      
      // User prompt for the model
      const userPrompt = `Please count all unique ${entityType} entities in these documents and provide a summary:\n\n${combinedContent}`;
      
      // Select a model for the completion
      const modelName = this.openaiService.selectModelForQuery(userPrompt);
      
      try {
        // Prepare messages for chat completion
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userPrompt }
        ];
        
        const completion = await this.openaiService.generateChatCompletion(messages, {
          temperature: 0.3,
          model: modelName
        });
        
        let countResponse = `I couldn't count ${entityType} entities in the documents.`;
        let model = modelName;
        
        // Check if the response has the expected structure
        if (completion && typeof completion === 'object') {
          if ('choices' in completion && 
              Array.isArray(completion.choices) && 
              completion.choices.length > 0 &&
              completion.choices[0].message) {
            countResponse = completion.choices[0].message.content || countResponse;
          }
          
          if ('model' in completion) {
            // Just use a known valid model name as fallback
            model = 'o3-mini';
          }
        }
        
        return {
          sources: documents.map(d => ({
            content: d.content || d.payload?.text || "",
            metadata: d.metadata || d.payload?.metadata || {},
            sourceId: d.sourceId || d.id,
            sourceName: d.sourceName || "Document"
          })),
          content: countResponse,
          model: model
        };
      } catch (aiError) {
        this.logger.error(`Error generating entity count with AI: ${aiError}`);
        return {
          sources: documents.map(d => ({
            content: d.content || d.payload?.text || "",
            metadata: d.metadata || d.payload?.metadata || {},
            sourceId: d.sourceId || d.id,
            sourceName: d.sourceName || "Document"
          })),
          content: `I encountered an error while trying to count ${entityType} entities.`
        };
      }
    } catch (error) {
      this.logger.error(`Error processing entity count query: ${error}`);
      return {
        sources: [],
        content: `I encountered an error while trying to count ${entityType} entities.`
      };
    }
  }

  /**
   * Generate a fallback response when normal processing fails
   */
  private async generateFallbackResponse(query: string, dataSourceIds: string[] | number[]): Promise<{
    sources: any[];
    content: string;
    model?: string;
    metadata: RagResponseMetadata;
    analysis?: {
      steps: string[];
      summary: string;
    };
  }> {
    const startTime = Date.now();
    this.logger.info(`Stage: ${ProcessingStage.INITIALIZING} - Generating fallback response`);
    
    try {
      // Use a less complex model for fallback responses
      const modelName = this.selectModelForAnalysis('low');
      
      // Analyzing the query even for fallback
      this.logger.info(`Stage: ${ProcessingStage.ANALYZING_QUERY}`);
      
      // Generate a simple response
      this.logger.info(`Stage: ${ProcessingStage.GENERATING_RESPONSE}`);
      const { content, steps, summary } = await this.generateSimpleFallbackContent(query, dataSourceIds);
      
      this.logger.info(`Stage: ${ProcessingStage.COMPLETED} - Fallback response generated`);
      return {
        sources: [],
        content: content,
        model: modelName,
        metadata: {
          processingTime: Date.now() - startTime,
          model: modelName,
          collectionNames: [],
          dataSourceIds: dataSourceIds.map(id => String(id)),
          dataSourceType: 'qdrant',
          isQdrantResponse: true,
          useEnhancedVisualization: false,
          hasVisualization: false,
          error: 'fallback',
          errorMessage: 'No specific data found to answer this query directly.'
        },
        analysis: {
          steps: steps,
          summary: summary
        }
      };
    } catch (error) {
      this.logger.error(`Error generating fallback response: ${error}`);
      const modelName = this.selectModelForAnalysis('low');
      
      return {
        sources: [],
        content: "I apologize, but I encountered an issue while processing your request. Please try again or rephrase your question.",
        model: modelName,
        metadata: {
          processingTime: Date.now() - startTime,
          model: modelName,
          collectionNames: [],
          dataSourceIds: dataSourceIds.map(id => String(id)),
          dataSourceType: 'qdrant',
          isQdrantResponse: true,
          useEnhancedVisualization: false,
          hasVisualization: false,
          error: 'fallback',
          errorMessage: 'Error occurred during processing'
        },
        analysis: {
          steps: ["Attempted to process query but encountered an error"],
          summary: "Processing error"
        }
      };
    }
  }

  /**
   * Get basic information about data sources to use in fallback responses
   */
  private async getDataSourcesInfo(dataSourceIds: string[] | number[]): Promise<Array<{id: string | number, name: string, type: string}>> {
    try {
      if (!dataSourceIds || dataSourceIds.length === 0) return [];
      
      const sources = await db('data_sources')
        .select('id', 'name', 'type', 'description')
        .whereIn('id', dataSourceIds);
      
      return sources.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type
      }));
    } catch (error) {
      this.logger.error(`Error getting data source info: ${error.message}`);
      return [];
    }
  }

  /**
   * Normalize a collection name with prefix
   */
  private normalizeCollectionName(dataSourceId: string): string {
    // Ensure it's a string first
    dataSourceId = String(dataSourceId);

    // Check if it already has a prefix
    if (dataSourceId.startsWith('datasource_')) {
      return dataSourceId;
    }

    // Add the standard prefix
    return `datasource_${dataSourceId}`;
  }

  /**
   * Attempt to convert a UUID-based collection name to a numeric ID-based one
   * This helps with collection name consistency
   */
  private async tryGetNumericCollectionName(collectionName: string): Promise<string> {
    try {
      // If not UUID format, return as is
      if (!collectionName.includes('-')) {
        return collectionName;
      }

      this.logger.debug(`Attempting to find numeric ID for collection: ${collectionName}`);
      
      // Extract the UUID part
      const uuidMatch = collectionName.match(/datasource_([0-9a-f-]+)/);
      if (!uuidMatch || !uuidMatch[1]) {
        return collectionName;
      }
      
      const uuid = uuidMatch[1];
      
      // Try to find the corresponding data source
      const dataSource = await db('data_sources')
        .where('filename', 'like', `%${uuid}%`)
        .orWhere('metadata', 'like', `%${uuid}%`)
        .first('id');
      
      if (dataSource && dataSource.id) {
        const numericName = `datasource_${dataSource.id}`;
        this.logger.info(`Converted collection name from ${collectionName} to ${numericName}`);
        return numericName;
      }
      
      return collectionName;
    } catch (error) {
      this.logger.error(`Error converting collection name: ${error instanceof Error ? error.message : String(error)}`);
      return collectionName;
    }
  }

  /**
   * Detect data source type from name or metadata
   */
  private detectDataSourceType(dataSourceName: string): DataSourceType {
    if (!dataSourceName) return DataSourceType.UNKNOWN;
    
    // Convert to lowercase for easier matching
    const lowerName = dataSourceName.toLowerCase();
    
    // Check for Excel files
    if (
      lowerName.endsWith('.xlsx') || 
      lowerName.endsWith('.xls') || 
      lowerName.endsWith('.csv') || 
      lowerName.includes('excel') || 
      lowerName.includes('spreadsheet')
    ) {
      this.logger.info(`Detected Excel data source: ${dataSourceName}`);
      return DataSourceType.EXCEL;
    }
    
    // Check for PDFs
    if (lowerName.endsWith('.pdf')) {
      return DataSourceType.PDF;
    }
    
    // Check for Word documents
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      return DataSourceType.DOC;
    }
    
    // Check for JSON
    if (lowerName.endsWith('.json')) {
      return DataSourceType.JSON;
    }
    
    // Default to generic type
    return DataSourceType.UNKNOWN;
  }

  /**
   * Helper method to check if a collection exists and log appropriate messages
   */
  private async ensureCollectionExists(collectionName: string): Promise<boolean> {
    try {
      const exists = await this.qdrantService.collectionExists(collectionName);
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
      }
      return exists;
    } catch (error) {
      this.logger.error(`Error checking if collection ${collectionName} exists:`, error);
      return false;
    }
  }

  /**
   * Deduplicate documents based on content similarity
   */
  private deduplicateDocuments(documents: any[]): any[] {
    const seen = new Set();
    
    return documents.filter(doc => {
      // Create a unique identifier for this document
      // Use both ID and content to detect semantic duplicates
      const id = doc.id || '';
      const contentHash = this.hashString(doc.content || doc.pageContent || '').slice(0, 20);
      const key = `${id}-${contentHash}`;
      
      // Keep it if we haven't seen this key before
      if (!seen.has(key)) {
        seen.add(key);
        return true;
      }
      
      return false;
    });
  }

  /**
   * Create a simple hash of a string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Extract tables from retrieved documents
   */
  private extractTablesFromDocuments(documents: any[]): any[] {
    try {
      this.logger.info(`Extracting tables from ${documents.length} documents`);
      
      // First try to extract markdown tables from content
      const extractedTables: any[] = [];
      
      // Process each document
      for (const doc of documents) {
        const content = doc.content || '';
        
        // Extract tables using markdown pattern
        const markdownTables = this.extractTablesFromMarkdown(content);
        
        if (markdownTables && markdownTables.length > 0) {
          this.logger.info(`Found ${markdownTables.length} tables in document ${doc.id || 'unknown'}`);
          extractedTables.push(...markdownTables);
        }
        
        // If no markdown tables found, try to find structured data in the metadata
        if ((!markdownTables || markdownTables.length === 0) && doc.metadata && typeof doc.metadata === 'object') {
          // Look for arrays or objects that might represent tabular data
          Object.entries(doc.metadata).forEach(([key, value]) => {
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
              this.logger.info(`Found structured array data in metadata.${key}`);
              extractedTables.push(...value);
            }
          });
        }
      }
      
      // If we found tables, return them
      if (extractedTables.length > 0) {
        this.logger.info(`Successfully extracted ${extractedTables.length} tables from documents`);
        return extractedTables;
      }
      
      // If no tables found, try to create structured data from the text
      this.logger.info('No tables found, attempting to create structured data from text');
      
      // Simple approach: extract key-value pairs
      const structuredData: Record<string, any>[] = [];
      
      for (const doc of documents) {
        const content = doc.content || '';
        const lines = content.split('\n');
        
        // Look for patterns like "Key: Value" or "Key - Value"
        const keyValuePairs: Record<string, any> = {};
        
        for (const line of lines) {
          const kvMatch = line.match(/^([^:]+):\s*(.*?)$/);
          if (kvMatch && kvMatch[1] && kvMatch[2]) {
            const key = kvMatch[1].trim();
            const value = kvMatch[2].trim();
            
            // Try to convert numeric values
            const numValue = Number(value);
            keyValuePairs[key] = !isNaN(numValue) ? numValue : value;
          }
        }
        
        // If we found any key-value pairs, add them as a record
        if (Object.keys(keyValuePairs).length > 0) {
          structuredData.push(keyValuePairs);
        }
      }
      
      if (structuredData.length > 0) {
        this.logger.info(`Created ${structuredData.length} structured records from text content`);
        return structuredData;
      }
      
      // Fallback: Just return document metadata as structured data
      this.logger.info('No structured data found, returning document metadata');
      return documents.map(doc => ({ 
        id: doc.id || uuidv4(),
        source: doc.sourceId || 'unknown',
        score: doc.score || 0,
        ...(doc.metadata || {})
      }));
    } catch (error) {
      this.logger.error(`Error extracting tables from documents: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract tables from markdown content
   */
  private extractTablesFromMarkdown(content: string): any[] {
    if (!content || typeof content !== 'string') return [];
    
    const results: any[] = [];
    const tableRegex = /\|(.+)\|\s*\n\|(?:[-:\s|]+)\|\s*\n((?:\|.+\|\s*\n)+)/g;
    
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      try {
        // Extract headers and rows
        const headerRow = match[1].trim();
        const dataRows = match[2].trim();
        
        // Parse headers
        const headers = headerRow
          .split('|')
          .map(h => h.trim())
          .filter(h => h.length > 0);
        
        // Parse data rows
        const rows = dataRows
          .split('\n')
          .filter(row => row.trim().length > 0)
          .map(row => {
            const columns = row
              .split('|')
              .map(col => col.trim())
              .filter(col => col.length > 0);
            
            if (columns.length >= headers.length) {
              const rowObj: Record<string, any> = {};
              headers.forEach((header, index) => {
                if (index < columns.length) {
                  // Try to convert to number if possible
                  const value = columns[index];
                  rowObj[header] = !isNaN(Number(value)) ? Number(value) : value;
                }
              });
              return rowObj;
            }
            return null;
          })
          .filter(row => row !== null);
        
        if (rows.length > 0) {
          results.push(...rows);
        }
      } catch (err) {
        this.logger.error(`Error extracting table from markdown: ${err.message}`);
      }
    }
    
    return results;
  }

  /**
   * Determine step type based on content
   */
  private determineStepType(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (content.includes('filter') || content.includes('where')) {
      return 'filter';
    }
    if (content.includes('aggregate') || content.includes('group by') || 
        content.includes('sum') || content.includes('average') || content.includes('count')) {
      return 'aggregate';
    }
    if (content.includes('sort') || content.includes('order by') || 
        content.includes('descending') || content.includes('ascending')) {
      return 'sort';
    }
    if (content.includes('insight') || content.includes('discover') || content.includes('finding')) {
      return 'insight';
    }
    if (content.includes('visualize') || content.includes('chart') || 
        content.includes('graph') || content.includes('plot')) {
      return 'visualization';
    }
    if (content.includes('table') || content.includes('data set')) {
      return 'table';
    }
    
    return 'info';
  }

  /**
   * Select the appropriate model for the query
   */
  private selectAppropriateModel(query: string): string {
    // Default to standard model for most queries
    return 'o3-mini';
  }

  /**
   * Find the correct collection name for a data source ID
   * This handles the mismatch between numeric IDs and UUID-based collections
   */
  private async findCorrectCollectionName(dataSourceId: string): Promise<string | null> {
    try {
      this.logger.info(`Looking for collection for data source ID: ${dataSourceId}`);
      
      // First, check if there's a direct numeric match
      const numericCollection = `datasource_${dataSourceId}`;
      if (await this.qdrantService.collectionExists(numericCollection)) {
        // Check if this collection has vectors
        try {
          const info = await this.qdrantService.getInfo(numericCollection);
          if (info && info.vectors_count > 0) {
            this.logger.info(`Found numeric collection ${numericCollection} with ${info.vectors_count} vectors`);
            return numericCollection;
          } else {
            this.logger.warn(`Numeric collection ${numericCollection} exists but has no vectors`);
            // Continue to search for alternatives instead of returning an empty collection
          }
        } catch (err) {
          this.logger.error(`Error getting info for collection ${numericCollection}: ${err}`);
        }
      }
      
      // Try to find it in the database first - looking for collection_name field
      if (!isNaN(Number(dataSourceId))) {
        try {
          // Try to find the data source by ID - only query metadata, not uuid
          const dataSource = await db('data_sources')
            .where('id', Number(dataSourceId))
            .first('metadata', 'collection_name');
          
          // Check if we have a collection_name stored directly
          if (dataSource?.collection_name) {
            const storedCollection = dataSource.collection_name;
            this.logger.info(`Found stored collection_name ${storedCollection} for numeric ID ${dataSourceId}`);
            
            // Check if this collection exists and has vectors
            const collectionExists = await this.qdrantService.collectionExists(storedCollection);
            if (collectionExists) {
              // Check if it has vectors
              try {
                const info = await this.qdrantService.getInfo(storedCollection);
                if (info && info.vectors_count > 0) {
                  this.logger.info(`Using stored collection ${storedCollection} for data source ${dataSourceId} (${info.vectors_count} vectors)`);
                  return storedCollection;
                } else {
                  this.logger.warn(`Stored collection ${storedCollection} exists but has no vectors`);
                  // Continue searching instead of returning empty collection
                }
              } catch (err) {
                this.logger.error(`Error getting info for stored collection ${storedCollection}: ${err}`);
              }
            } else {
              this.logger.warn(`Stored collection ${storedCollection} does not exist`);
            }
          }
          
          // Try metadata.id field which is often used in older data
          if (dataSource?.metadata?.id) {
            const uuid = dataSource.metadata.id;
            const uuidCollection = `datasource_${uuid}`;
            
            // Log what we found for debugging
            this.logger.info(`Found metadata.id UUID ${uuid} for numeric ID ${dataSourceId}`);
            
            // Check if this collection exists
            const uuidExists = await this.qdrantService.collectionExists(uuidCollection);
            if (uuidExists) {
              // Check if it has vectors
              try {
                const info = await this.qdrantService.getInfo(uuidCollection);
                if (info && info.vectors_count > 0) {
                  this.logger.info(`Found UUID-based collection ${uuidCollection} with ${info.vectors_count} vectors`);
                  
                  // Try to copy vectors to numeric collection for future queries
                  try {
                    if (!await this.qdrantService.collectionExists(numericCollection)) {
                      await this.qdrantService.createCollection(numericCollection, {
                        vectors: { size: 1536, distance: 'Cosine' }
                      });
                      this.logger.info(`Created numeric collection ${numericCollection}`);
                    }
                    
                    // Get points from UUID collection
                    const points = await this.qdrantService.getAllPoints(uuidCollection, 1000);
                    if (points && points.length > 0) {
                      // Filter for valid points
                      const validPoints = points.filter(point => 
                        point && typeof point === 'object' && 'id' in point && 'vector' in point && Array.isArray(point.vector)
                      ) as { id: string; vector: number[]; payload: any }[];
                      
                      if (validPoints.length > 0) {
                        // Copy points to numeric collection
                        await this.qdrantService.upsertVectors(numericCollection, validPoints);
                        this.logger.info(`Copied ${validPoints.length} vectors from ${uuidCollection} to ${numericCollection}`);
                        
                        // Update data source record
                        await db('data_sources')
                          .where('id', Number(dataSourceId))
                          .update({
                            collection_name: numericCollection,
                            metadata: db.raw(`jsonb_set(metadata, '{collection_name}', '"${numericCollection}"')`)
                          });
                        this.logger.info(`Updated data source record with collection name: ${numericCollection}`);
                        
                        // Return the numeric collection since we just filled it
                        return numericCollection;
                      }
                    }
                  } catch (copyError) {
                    this.logger.error(`Error copying vectors: ${copyError}`);
                  }
                  
                  // Return the UUID collection if we couldn't migrate
                  return uuidCollection;
                } else {
                  this.logger.warn(`UUID-based collection ${uuidCollection} exists but has no vectors`);
                }
              } catch (err) {
                this.logger.error(`Error getting info for UUID collection ${uuidCollection}: ${err}`);
              }
            } else {
              this.logger.warn(`UUID-based collection ${uuidCollection} from metadata.id does not exist`);
            }
          } else {
            this.logger.warn(`Data source with ID ${dataSourceId} found but has no metadata.id`);
          }
        } catch (dbError) {
          this.logger.error(`Database error looking up data source ${dataSourceId}: ${dbError}`);
        }
      }
      
      // Try to find all collections and see if any match
      try {
        const collectionsResponse = await this.qdrantService.listCollections();
        
        // Handle both array of strings and object with collections property
        const collectionsArray = Array.isArray(collectionsResponse) 
          ? collectionsResponse 
          : (collectionsResponse && typeof collectionsResponse === 'object' 
              ? (('collections' in collectionsResponse) ? (collectionsResponse as any).collections : []) 
              : []);
        
        // Convert to collection names if needed
        const collectionNames = Array.isArray(collectionsArray) 
          ? (typeof collectionsArray[0] === 'string' 
              ? collectionsArray 
              : collectionsArray.map(c => c.name || '').filter(Boolean))
          : [];
        
        // If this is a UUID, look for an exact match
        if (dataSourceId.includes('-')) {
          const uuidCollection = `datasource_${dataSourceId}`;
          if (collectionNames.includes(uuidCollection)) {
            this.logger.info(`Found direct UUID match: ${uuidCollection}`);
            return uuidCollection;
          }
        }
        
        // If this is a numeric ID, try to find collections with "datasource_" prefix
        if (!dataSourceId.includes('-') && !isNaN(Number(dataSourceId))) {
          // Get all datasource collections
          const datasourceCollections = collectionNames.filter(name => 
            name.startsWith('datasource_')
          );
          
          this.logger.info(`Found ${datasourceCollections.length} data source collections to check`);
          
          // Get the collection with the most vectors - might be our best bet
          if (datasourceCollections.length > 0) {
            // Just return the first match as we can't easily sort by vector count with just names
            const firstMatch = datasourceCollections[0];
            this.logger.info(`Best potential collection match: ${firstMatch}`);
            return firstMatch;
          }
        }
        
        // List all available collections for debugging
        this.logger.info(`Available collections: ${collectionNames.join(', ')}`);
        
        // No collection found
        this.logger.warn(`Could not find any collection for data source ${dataSourceId}`);
        return null;
      } catch (error) {
        this.logger.error(`Error listing collections:`, error);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error finding collection for data source ${dataSourceId}:`, error);
      return null;
    }
  }

  /**
   * Retrieve relevant documents from the vector store
   */
  private async retrieveDocuments(
    query: string, 
    dataSourceIds: string[],
    needsExhaustiveResults: boolean = false
  ): Promise<{
    documents: any[];
    collectionNames: string[];
    dataSourceDescriptions: Record<string, string>;
  }> {
    this.logger.info(`Retrieving documents for query: "${query}" from sources: ${dataSourceIds.join(', ')}`);
    
    // Improve query analysis
    const isAnalyticalQuery = this.isAnalyticalQuery(query);
    const isEntityLookup = this.isEntityLookupQuery(query);
    const isEntityListingQuery = query.match(/list|enumerate|show all|find all|get all/i) !== null;
    const needsExhaustiveRetrieval = needsExhaustiveResults || isEntityLookup || isAnalyticalQuery;
    
    this.logger.info(`Query analysis: analytical=${isAnalyticalQuery}, entityLookup=${isEntityLookup}, entityListing=${isEntityListingQuery}, exhaustiveMode=${needsExhaustiveRetrieval}`);
    
    // Initialize variables
    const documents: any[] = [];
    const collectionNames: string[] = [];
    const dataSourceDescriptions: Record<string, string> = {};
    const idToUuidMap: Record<string, string> = {};
    
    try {
    // Get data source info
    const dataSources = await this.getDataSourcesInfo(dataSourceIds);
    
    // Process each data source
    for (const dataSourceId of dataSourceIds) {
      try {
        this.logger.info(`Processing data source ID: ${dataSourceId}`);
        
        // Check if we have a direct mapping for this ID
        let collectionName: string | null = null;
        
        if (idToUuidMap[dataSourceId]) {
          collectionName = idToUuidMap[dataSourceId];
          this.logger.info(`Using direct UUID mapping for data source ${dataSourceId}: ${collectionName}`);
        } else {
          // Try to find the correct collection using our method
          collectionName = await this.findCorrectCollectionName(dataSourceId);
          this.logger.info(`findCorrectCollectionName returned: ${collectionName}`);
        }
        
        if (!collectionName) {
          this.logger.error(`Could not find a valid collection for data source ${dataSourceId}`);
          continue;
        }
        
        // Check if the collection exists
        const exists = await this.qdrantService.collectionExists(collectionName);
        this.logger.info(`Collection ${collectionName} exists: ${exists}`);
        
        if (!exists) {
          this.logger.error(`Collection ${collectionName} does not exist`);
          continue;
        }
        
        collectionNames.push(collectionName);
        
        // Find data source info
        const dataSource = dataSources.find(ds => String(ds.id) === String(dataSourceId));
        if (dataSource) {
          dataSourceDescriptions[dataSourceId] = dataSource.name;
        }
        
        // Generate embeddings for the query
        const embeddings = await this.openaiService.createEmbeddings([query]);
        
        if (!embeddings || embeddings.length === 0) {
          this.logger.error(`Failed to create embeddings for query: ${query}`);
          continue;
        }
        
        // Search Qdrant for relevant documents
        this.logger.info(`Searching collection ${collectionName} with vector of length ${embeddings[0].length}`);
          
          // Set search parameters based on query type
          let searchLimit = 10;
          
          // Adjust limits based on query type
          if (isEntityLookup || isAnalyticalQuery || needsExhaustiveRetrieval) {
            searchLimit = 500; // Higher limit for entity lookup queries
            this.logger.info(`Using increased search limit of ${searchLimit} for comprehensive retrieval`);
          }
          
          // Special case for entity listing queries - need maximum possible results
          if (isEntityListingQuery) {
            searchLimit = 1000; // Maximum limit for entity listing queries
            this.logger.info(`Using MAXIMUM search limit of ${searchLimit} for entity listing query`);
          }
          
        const results = await this.qdrantService.search(
          collectionName,
          embeddings[0],
          null,  // No filter
            searchLimit  // Use dynamic limit based on query type
        );
        
        this.logger.info(`Found ${results.length} results in collection ${collectionName}`);
        
        // Convert to standard document format
        const formattedDocs = results.map(result => ({
          content: result.payload?.text || result.payload?.content || '',
          metadata: {
            ...result.payload?.metadata,
            dataSourceId,
            collectionName,
            score: result.score,
          }
        }));
        
        documents.push(...formattedDocs);
      } catch (error) {
        this.logger.error(`Error retrieving documents from source ${dataSourceId}:`, error);
      }
    }
    
    return { documents, collectionNames, dataSourceDescriptions };
    } catch (error) {
      this.logger.error(`Error retrieving documents: ${error}`);
      return {
        documents: [],
        collectionNames: [],
        dataSourceDescriptions: {}
      };
    }
  }

  /**
   * Generate a response with the given context
   */
  private async generateResponseWithContext(
    query: string,
    documents: any[],
    model: string,
    options?: {
      rawSystemMessage?: string | null;
      customSystemMessage?: string | null;
      enhancedSystemMessage?: string | null;
      isEntityLookup?: boolean;
      isEntityListing?: boolean;
      isAnalyticalQuery?: boolean;
      structuredData?: any;
      analyticalInsights?: any;
    }
  ): Promise<{
    content: string;
    analysis?: {
      steps: string[];
      summary: string;
    };
  }> {
    const startTime = performance.now();
    const opts = options || {};
    
    // Extract structured data if present
    const structuredData = opts.structuredData || this.extractStructuredData(documents, query);
    
    // Use provided analytical insights or generate them
    const analyticalInsights = opts.analyticalInsights || await this.analyzeStructuredData(query, structuredData);
    
    // Check if this is an entity-focused query
    const isEntityLookup = opts.isEntityLookup || this.isEntityLookupQuery(query);
    const entityName = opts.isEntityLookup ? this.extractEntityFromQuery(query) : null;
    const isEntityListingQuery = opts.isEntityListing || query.match(/list|enumerate|show all|find all|get all/i) !== null;
    const isAnalyticalQuery = opts.isAnalyticalQuery || this.isAnalyticalQuery(query);
    
    // Determine if we have specific entity data extracted
    let hasStructuredEntityData = false;
    let hasListData = false;
    
    if (structuredData) {
      hasStructuredEntityData = 
        (structuredData.specificEntityData && Object.keys(structuredData.specificEntityData).length > 0) ||
        (structuredData.tables && structuredData.tables.length > 0);
      
      hasListData = structuredData.listedEntities && structuredData.listedEntities.entries && 
        structuredData.listedEntities.entries.length > 0;
    }
    
    // Log the available structured data
    if (hasStructuredEntityData || hasListData) {
      this.logger.info(`Using structured data for response generation: hasEntityData=${hasStructuredEntityData}, hasListData=${hasListData}`);
    }
    
    // Log the available analytical data
    if (analyticalInsights && Object.keys(analyticalInsights).length > 0) {
      this.logger.info(`Generated analytical insights with ${Object.keys(analyticalInsights.basicStats || {}).length} basic stats`);
      this.logger.info(`Found ${Object.keys(analyticalInsights.topDistributions || {}).length} distributions`);
      this.logger.info(`Identified ${Object.keys(analyticalInsights.keyPatterns || {}).length} patterns`);
    }
    
    // Prepare documents for the LLM
    const preparedContext = this.prepareDocumentsForLLM(documents);
    
    // Base system message
    let systemMessage = `You are an expert knowledge assistant. Answer the question based on the provided context.
Query: "${query}"

CONTEXT INFORMATION:
${preparedContext}
`;
    
    // Enhance system message based on query type
    if (isAnalyticalQuery) {
      systemMessage = `You are an expert data analyst and knowledge assistant. Thoroughly analyze the information and provide comprehensive insights.
      
Query: "${query}"

Your task is to analyze the available information and provide a detailed, data-driven response. The user is asking a question that requires analytical thinking.

CONTEXT INFORMATION:
${preparedContext}
`;
      
      // If we have analytical insights, enhance the system message
      if (analyticalInsights) {
        systemMessage += `\n\nANALYTICAL INSIGHTS:`;
        
        // Add basic statistics if available
        if (analyticalInsights.basicStats && Object.keys(analyticalInsights.basicStats).length > 0) {
          systemMessage += `\n\nBASIC STATISTICS:`;
          for (const [key, value] of Object.entries(analyticalInsights.basicStats)) {
            systemMessage += `\n- ${key}: ${value}`;
          }
        }
        
        // Add distribution information
        if (analyticalInsights.topDistributions && Object.keys(analyticalInsights.topDistributions).length > 0) {
          systemMessage += `\n\nKEY DISTRIBUTIONS:`;
          for (const [category, distribution] of Object.entries(analyticalInsights.topDistributions)) {
            // Only include top 5 items to avoid overloading
            const topItems = Object.entries(distribution as Record<string, number>)
              .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
              .slice(0, 5);
              
            systemMessage += `\n- ${category}: ${topItems.map(([value, count]) => `${value} (${count})`).join(', ')}`;
          }
        }
        
        // Add patterns and correlations
        if (analyticalInsights.keyPatterns && analyticalInsights.keyPatterns.length > 0) {
          systemMessage += `\n\nPATTERNS AND CORRELATIONS:`;
          
          // Extract meaningful patterns
          for (const pattern of analyticalInsights.keyPatterns) {
            if (pattern.category && pattern.values) {
              systemMessage += `\n- ${pattern.category}: ${pattern.values.map((v: any) => 
                v.description || v.fields || v.name || JSON.stringify(v)
              ).join(', ')}`;
            }
          }
        }
        
        // Add recommendations if available
        if (analyticalInsights.recommendations && analyticalInsights.recommendations.length > 0) {
          systemMessage += `\n\nRECOMMENDED ANALYSIS DIRECTIONS:`;
          for (const recommendation of analyticalInsights.recommendations) {
            systemMessage += `\n- ${recommendation}`;
          }
        }
      }
      
      // Add analytical instructions
      systemMessage += `\n\nYour response should:
1. Provide a comprehensive analysis of the data
2. Highlight the most important patterns, trends, and insights
3. Draw connections between different pieces of information
4. Include specific data points to support your analysis
5. Offer a clear, actionable conclusion
`;
      
    } else if (isEntityLookup) {
      systemMessage = `You are an expert knowledge assistant. Provide comprehensive information about the entity the user is asking about.
      
Query: "${query}"

The user is asking about a specific entity. Provide detailed information about this entity from the context.

CONTEXT INFORMATION:
${preparedContext}
`;
      
      if (entityName) {
        systemMessage += `\n\nThe entity being asked about appears to be: ${entityName}`;
      }
      
      if (hasStructuredEntityData && structuredData.specificEntityData) {
        systemMessage += `\n\nEXTRACTED ENTITY DATA:
Entity: ${structuredData.specificEntityData.entityName || entityName || "Unknown"}
${JSON.stringify(structuredData.specificEntityData.data || {}, null, 2)}
`;
        
        // Add analytical insights if available
        if (analyticalInsights && isAnalyticalQuery) {
          systemMessage += `\n\nANALYTICAL INSIGHTS:`;
          
          // Add basic statistics if available
          if (analyticalInsights.basicStats && Object.keys(analyticalInsights.basicStats).length > 0) {
            systemMessage += `\n\nKey Statistics:`;
            for (const [key, value] of Object.entries(analyticalInsights.basicStats)) {
              if (key === 'entityName' || key === 'targetEntity') continue; // Skip redundant info
              systemMessage += `\n- ${key}: ${value}`;
            }
          }
          
          // Add distribution patterns if available
          if (analyticalInsights.topDistributions && Object.keys(analyticalInsights.topDistributions).length > 0) {
            systemMessage += `\n\nDistribution Patterns:`;
            const topCategories = Object.keys(analyticalInsights.topDistributions).slice(0, 3);
            for (const category of topCategories) {
              const distribution = analyticalInsights.topDistributions[category];
              const topItems = Object.entries(distribution as Record<string, number>)
                .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
                .slice(0, 3);
                
              systemMessage += `\n- ${category}: ${topItems.map(([value, count]) => `${value} (${count})`).join(', ')}`;
            }
          }
        }
      }
      
      // Add entity lookup instructions
      systemMessage += `\n\nYour response should:
1. Provide a comprehensive overview of ${entityName || "the entity"}
2. Include key facts, figures, and details from the context
3. Organize the information in a clear, structured format
4. Highlight the most important aspects that the user should know
`;
      
    } else if (isEntityListingQuery || hasListData) {
      systemMessage = `You are an expert knowledge assistant. The user wants a listing of items - ensure your response includes all relevant items from the context.
      
Query: "${query}"

The user is asking for a comprehensive list or enumeration. Your response should include ALL relevant items from the context.

CONTEXT INFORMATION:
${preparedContext}
`;
      
      if (hasListData && structuredData.listedEntities) {
        systemMessage += `\n\nEXTRACTED LIST DATA:
List of: ${structuredData.listedEntities.entityName || "Items"}
${JSON.stringify(structuredData.listedEntities.entries || [], null, 2)}
`;
      }
      
      // Add listing instructions
      systemMessage += `\n\nYour response should:
1. Provide a COMPLETE list of all items mentioned in the context
2. Format the list in a clear, readable way (e.g., bullet points or numbered list)
3. Include relevant details for each item
4. DO NOT summarize or truncate the list - include EVERY relevant item
5. Add a brief explanation or context before presenting the list
`;
    }
    
    // Use OpenAI to generate a response
    try {
      const messages = [
        {
          role: 'system' as const,
          content: systemMessage
        },
        {
          role: 'user' as const,
          content: query
        }
      ];
      
      const response = await this.openaiService.generateChatCompletion(messages, {
        model,
        temperature: 0.7,
        max_tokens: 1500
      });
      
      const responseContent = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      
      // Optional: Generate a structured analysis of the response
      let analysis;
      try {
        analysis = await this.generateStructuredAnalysis(query, responseContent);
      } catch (analysisError) {
        this.logger.warn(`Error generating structured analysis: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`);
      }
      
      return {
        content: responseContent,
        analysis
      };
    } catch (error) {
      this.logger.error(`Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { 
        content: 'Sorry, I encountered an error while generating a response. Please try again.',
        analysis: {
          steps: ['Error encountered'],
          summary: 'Failed to generate response due to an error'
        }
      };
    }
  }

  /**
   * Generate structured analysis from content
   */
  private async generateStructuredAnalysis(
    query: string,
    content: string
  ): Promise<{ steps: string[]; summary: string } | undefined> {
    try {
      // Skip for very short responses
      if (content.length < 100) {
        return undefined;
      }
      
      const structurePrompt = `Analyze the following response to the query "${query}" and break it down into logical steps. 
Extract 2-4 clear steps from the response and provide a concise summary.

Response:
${content}

Format your output as a JSON object with these fields:
{
  "steps": ["Step 1 description", "Step 2 description", ...],
  "summary": "One paragraph summary of the key points"
}`;

      // Generate the structured analysis with proper response handling
      const structuredResponseObj = await this.openaiService.generateChatCompletion(
        [
          { role: 'system', content: 'You are an analytical assistant that breaks down information into structured steps.' },
          { role: 'user', content: structurePrompt }
        ],
        { model: "gpt-4-turbo" }
      );
      
      // Convert to string if needed
      const structuredResponse = typeof structuredResponseObj === 'string' 
        ? structuredResponseObj 
        : JSON.stringify(structuredResponseObj);
      
      // Try to parse the JSON response
      try {
        // Look for JSON in various formats
        const jsonMatch = structuredResponse.match(/```json\n([\s\S]*?)\n```/) || 
                          structuredResponse.match(/```\n([\s\S]*?)\n```/) ||
                          structuredResponse.match(/({[\s\S]*})/);
        
        if (jsonMatch && jsonMatch[1]) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.steps && Array.isArray(parsed.steps) && parsed.summary) {
            return {
              steps: parsed.steps,
              summary: parsed.summary
            };
          }
        }
        
        // Try direct parsing if no match found
        try {
          const parsed = JSON.parse(structuredResponse);
          if (parsed.steps && Array.isArray(parsed.steps) && parsed.summary) {
            return {
              steps: parsed.steps,
              summary: parsed.summary
            };
          }
        } catch (e) {
          // Ignore this error and continue
        }
      } catch (error) {
        this.logger.error(`Error parsing structured analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      return undefined;
    } catch (error) {
      this.logger.error(`Error generating structured analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }

  // Add missing extractInsightsFromContent method
  private extractInsightsFromContent(content: string): string[] {
    const insights: string[] = [];
    const insightPatterns = [
      /key\s+insights?:?\s*([\s\S]*?)(?=\n\n|\n#|\n##|$)/i,
      /(?:^|[\n\r])\s*[\-\*•]\s+([^:\n\r]+)/gm  // Bullets like "- Key point"
    ];
    
    try {
      // Extract patterns that resemble insights
      for (const pattern of insightPatterns) {
        if (pattern.global) {
          // For global patterns, extract all matches
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && match[1].trim()) {
              insights.push(match[1].trim());
            }
          }
        } else {
          // For non-global patterns, extract single match
          const match = content.match(pattern);
          if (match && match[1] && match[1].trim()) {
            // Split by line if multiple insights are in the same block
            const lines = match[1].split('\n');
            for (const line of lines) {
              if (line.trim()) {
                insights.push(line.trim());
              }
            }
          }
        }
      }
      
      return insights.slice(0, 5); // Limit to top 5 insights
    } catch (error) {
      this.logger.error(`Error extracting insights: ${error}`);
      return [];
    }
  }

  /**
   * Process a query using the hybrid search engine with aggregation capabilities
   * This method specifically handles queries that might benefit from pre-computed aggregations
   */
  async processQueryWithAggregations(
    query: string,
    dataSourceId: number,
    options: QueryOptions = {}
  ): Promise<{ results: any; explanation: string }> {
    this.logger.info(`Processing query with aggregations: ${query} for data source ${dataSourceId}`);
    this.logger.info(`Stage: ${ProcessingStage.INITIALIZING}`);
    
    try {
      // Move to query analysis stage
      this.logger.info(`Stage: ${ProcessingStage.ANALYZING_QUERY}`);
      
      // Execute the query through the hybrid search engine
      this.logger.info(`Stage: ${ProcessingStage.PREPROCESSING_DATA}`);
      const queryResult = await hybridSearchEngine.executeQuery(query, {
        datasourceId: dataSourceId,
        ...options
      });
      
      // Format the results based on type
      this.logger.info(`Stage: ${ProcessingStage.ENHANCING_DATA}`);
      const { results, explanation } = this.formatQueryResultsWithAggregations(query, queryResult);
      
      // Processing complete
      this.logger.info(`Stage: ${ProcessingStage.COMPLETED}`);
      return { results, explanation };
    } catch (error) {
      this.logger.error(`Error processing query with aggregations: ${error}`);
      throw error;
    }
  }
  
  /**
   * Format query results based on the type of results, with special handling for aggregations
   */
  private formatQueryResultsWithAggregations(
    query: string,
    queryResult: any
  ): { results: any; explanation: string } {
    this.logger.info(`Stage: ${ProcessingStage.PARSING_RESPONSE}`);
    const { results, executionDetails } = queryResult;
    
    // For aggregation results (precomputed or full scan)
    if (executionDetails.strategy === 'precomputed_aggregation' || 
        executionDetails.strategy === 'full_scan_aggregation') {
      
      // Format aggregation result
      let formattedResult;
      let explanation;
      
      // If results is an array with one item (from executePrecomputed), use that
      const resultData = Array.isArray(results) && results.length > 0 ? results[0] : results;
      
      if (resultData.isPrecomputed) {
        formattedResult = {
          type: 'aggregation',
          aggregationType: resultData.aggregationType,
          subject: resultData.subject,
          value: resultData.value,
          confidence: executionDetails.confidence,
          precomputed: true,
          lastUpdated: resultData.lastUpdated
        };
        
        explanation = `This answer is based on pre-computed data from ${formattedResult.lastUpdated}. The system identified that you were asking for the ${formattedResult.aggregationType.replace(/_/g, ' ')} for ${formattedResult.subject}.`;
      } else {
        formattedResult = {
          type: 'aggregation',
          aggregationType: resultData.aggregationType || 'unknown',
          subject: resultData.subject || 'unknown',
          value: resultData.value || 0,
          confidence: executionDetails.confidence,
          precomputed: false
        };
        
        explanation = `This answer was calculated by analyzing the data that matches your query. The system identified that you were asking for the ${formattedResult.aggregationType.replace(/_/g, ' ')} for ${formattedResult.subject}.`;
      }
      
      if (resultData.needsImplementation) {
        explanation += " (Note: This feature is currently being implemented for better accuracy)";
      }
      
      this.logger.info(`Stage: ${ProcessingStage.PREPARING_VISUALIZATION}`);
      return { results: formattedResult, explanation };
    }
    
    // For metadata filter results
    if (executionDetails.strategy === 'metadata_filter') {
      return {
        results,
        explanation: `Found ${results.length} results matching your specific criteria.`
      };
    }
    
    // For hybrid results
    if (executionDetails.strategy === 'hybrid') {
      return {
        results,
        explanation: `Combined filtering and calculation to analyze your data.`
      };
    }
    
    // Default for semantic search
    return {
      results,
      explanation: `Found ${results.length} results relevant to your query.`
    };
  }

  /**
   * Generate simple fallback content when no specific data is found
   * @param query The user's query
   * @param dataSourceIds The data source IDs that were queried
   * @returns Generated content, steps, and summary
   */
  private async generateSimpleFallbackContent(query: string, dataSourceIds: string[] | number[]): Promise<{ content: string; steps: string[]; summary: string }> {
    // Generate a helpful response that acknowledges the system couldn't find relevant data
    this.logger.info(`Stage: ${ProcessingStage.DETERMINING_OPERATIONS} - Preparing fallback content`);
    const modelName = 'o3-mini' as ModelName;
    
    try {
      // Try to get some context about the data sources to provide a more helpful response
      this.logger.info(`Stage: ${ProcessingStage.PREPROCESSING_DATA}`);
      const dataSourcesInfo = await this.getDataSourcesInfo(dataSourceIds);
      const dataSourcesContext = dataSourcesInfo.length > 0 
        ? `I see you're asking about data from sources: ${dataSourcesInfo.map(ds => ds.name).join(', ')}. ` 
        : '';
      
      const prompt = `You need to respond to this query: "${query}" 
      
Unfortunately, I couldn't find any specific information in the data sources to answer this question directly.

${dataSourcesContext}

Please provide a helpful response that:
1. Acknowledges we don't have the exact information
2. Suggests how the user might refine their query
3. Mentions what types of information we might have available
4. Is conversational and helpful`;
      
      // Generate the completion
      const messages = [
        { role: 'system', content: 'You are a helpful assistant that provides honest responses when information is not available.' },
        { role: 'user', content: prompt }
      ] as any[];
      
      const completion = await this.openaiService.generateChatCompletion(messages, {
        model: modelName as any,
        temperature: 0.7
      });
      
      // Extract the content from the completion
      let content = '';
      if (completion && 'choices' in completion && completion.choices && completion.choices.length > 0) {
        content = completion.choices[0].message.content || '';
      } else {
        content = "I couldn't find any specific information to answer your question. Could you try rephrasing or asking something else?";
      }
      
      return {
        content,
        steps: [
          `Received query: "${query}"`,
          `Retrieved data source information: ${dataSourcesInfo.length} sources found`,
          `Generated fallback response with ${modelName}`
        ],
        summary: "No relevant information found in the available data sources."
      };
    } catch (error) {
      this.logger.error(`Error generating fallback content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        content: "I apologize, but I couldn't find specific information to answer your question and encountered an error while generating a helpful response.",
        steps: [`Error generating fallback response: ${error instanceof Error ? error.message : 'Unknown error'}`],
        summary: "Error generating response."
      };
    }
  }

  /**
   * Update data source collection references
   * This helper method will scan all collections and update data_sources
   * with their collection names to ensure proper lookups.
   */
  async updateDataSourceCollectionReferences(): Promise<{
    updated: number;
    errors: number;
    details: string[];
  }> {
    const result = {
      updated: 0,
      errors: 0,
      details: [] as string[]
    };

    try {
      // Get all collections from Qdrant
      const collectionsResponse = await this.qdrantService.getClient().getCollections();
      if (!collectionsResponse?.collections) {
        throw new Error('Failed to get collections from Qdrant');
      }

      // Filter for data source collections
      const dataSourceCollections = collectionsResponse.collections.filter(c => 
        c.name.startsWith('datasource_')
      );

      this.logger.info(`Found ${dataSourceCollections.length} data source collections to update references for`);
      result.details.push(`Found ${dataSourceCollections.length} data source collections`);

      // Process each collection
      for (const collection of dataSourceCollections) {
        try {
          // Extract ID from collection name
          let dataSourceId: number | null = null;
          let dataSourceUuid: string | null = null;

          // Try to determine if this is a numeric or UUID collection
          if (collection.name.includes('-')) {
            // This is a UUID-based collection
            const uuidMatch = collection.name.match(/datasource_([0-9a-f-]+)/);
            if (uuidMatch && uuidMatch[1]) {
              dataSourceUuid = uuidMatch[1];
              
              // Try to find corresponding data source
              const dataSource = await db('data_sources')
                .whereRaw("CAST(metadata->>'id' AS TEXT) = ?", [dataSourceUuid])
                .orWhereRaw("metadata::text LIKE ?", [`%${dataSourceUuid}%`])
                .first('id');
              
              if (dataSource?.id) {
                dataSourceId = dataSource.id;
                this.logger.info(`Found numeric ID ${dataSourceId} for UUID collection ${collection.name}`);
                
                // Update the data source record with the collection name
                await db('data_sources')
                  .where('id', dataSourceId)
                  .update({ collection_name: collection.name });
                
                result.updated++;
                result.details.push(`Updated data source ${dataSourceId} with collection name ${collection.name}`);
              } else {
                this.logger.warn(`Could not find data source for UUID collection ${collection.name}`);
                result.details.push(`Could not find data source for UUID collection ${collection.name}`);
              }
            }
          } else {
            // This might be a numeric ID-based collection
            const numericMatch = collection.name.match(/datasource_(\d+)/);
            if (numericMatch && numericMatch[1]) {
              dataSourceId = parseInt(numericMatch[1], 10);
              
              // Check if this data source exists
              const dataSource = await db('data_sources')
                .where('id', dataSourceId)
                .first('id');
              
              if (dataSource) {
                // Update the data source record with the collection name
                await db('data_sources')
                  .where('id', dataSourceId)
                  .update({ collection_name: collection.name });
                
                result.updated++;
                result.details.push(`Updated data source ${dataSourceId} with collection name ${collection.name}`);
              } else {
                this.logger.warn(`Could not find data source with ID ${dataSourceId} for collection ${collection.name}`);
                result.details.push(`Could not find data source with ID ${dataSourceId} for collection ${collection.name}`);
              }
            }
          }
        } catch (error) {
          this.logger.error(`Error updating references for collection ${collection.name}:`, error);
          result.errors++;
          result.details.push(`Error updating references for collection ${collection.name}: ${error}`);
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Error updating data source collection references:', error);
      result.errors++;
      result.details.push(`General error: ${error}`);
      return result;
    }
  }

  /**
   * Process a query against specified data sources
   * Streamlined implementation that focuses on reliable retrieval and analytical insights
   */
  async processQuery(
    query: string, 
    dataSourceIds: Array<string | number>,
    collection?: string,
    model?: string,
    rawSystemMessage?: string | null,
    customSystemMessage?: string | null,
    enhancedSystemMessage?: string | null,
    startTime = performance.now(),
  ): Promise<RagResponse> {
    try {
      this.logger.info(`Processing query: "${query}" for dataSourceIds: ${dataSourceIds.join(', ')}`);
      
      // Analyze query intent for better processing
      const queryAnalysis = this.analyzeQueryIntent(query);
      const normalizedDataSourceIds = dataSourceIds.map(id => String(id));
      
      // Check if this is an entity lookup, entity listing or analytical query
      const isEntityLookup = this.isEntityLookupQuery(query);
      const entityName = isEntityLookup ? this.extractEntityFromQuery(query) : null;
      const isEntityListing = this.isEntityListingQuery(query);
      const isAnalyticalQuery = this.isAnalyticalQuery(query);
      const needsExhaustiveRetrieval = isEntityLookup || isEntityListing || isAnalyticalQuery;
      
      this.logger.info(`Query analysis: isEntityLookup=${isEntityLookup}, isEntityListing=${isEntityListing}, isAnalyticalQuery=${isAnalyticalQuery}, needsExhaustiveRetrieval=${needsExhaustiveRetrieval}`);
      
      if (entityName) {
        this.logger.info(`Detected entity: ${entityName}`);
      }
      
      // Extract query intent for metadata
      const queryIntent = this.extractQueryIntent(query);
      
      // Select appropriate model based on query complexity
      const selectedModel = model || this.selectModelForAnalysis(queryAnalysis.complexity);
      
      // Retrieve documents from all specified data sources
      const { documents, collectionNames, dataSourceDescriptions } = await this.retrieveDocuments(
        query, 
        normalizedDataSourceIds,
        needsExhaustiveRetrieval
      );
      
      if (!documents || documents.length === 0) {
        this.logger.warn(`No documents retrieved for query: "${query}"`);
        
        // Fall back to universal query processing
        return {
          sources: [],
          content: `I couldn't find any relevant information about "${query}" in the provided data sources.`,
          model: selectedModel,
          metadata: {
            processingTime: performance.now() - startTime,
            model: selectedModel,
            collectionNames: collectionNames,
            dataSourceIds: normalizedDataSourceIds,
            dataSourceType: 'unknown',
            isQdrantResponse: false,
            useEnhancedVisualization: false,
            hasVisualization: false,
            queryType: {
              isEntityLookup,
              isEntityListing,
              isAnalytical: isAnalyticalQuery,
              entityName,
              queryIntent
            }
          }
        };
      }
      
      this.logger.info(`Retrieved ${documents.length} documents from ${collectionNames.length} collections`);
      
      // Extract structured data from documents
      const structuredData = this.extractStructuredData(documents, query);
      
      // Analyze the structured data for analytical insights
      const analyticalInsights = await this.analyzeStructuredData(query, structuredData);
      
      // If we have structured data, prepare visualization
      let visualizationData = null;
      let visualizationType = 'table';
      
      if (structuredData) {
        // Determine if we have table data to visualize
        const tabularData = this.extractCompleteTable(JSON.stringify(structuredData), entityName);
        
        if (tabularData && tabularData.length > 0) {
          // Determine appropriate visualization type based on query intent
          if (queryIntent.includes('TREND') || query.toLowerCase().includes('over time')) {
            visualizationType = 'line_chart';
          } else if (queryIntent.includes('DISTRIBUTION') || query.toLowerCase().includes('breakdown')) {
            visualizationType = 'pie_chart';
          } else if (queryIntent.includes('COMPARATIVE') || query.toLowerCase().includes('compare')) {
            visualizationType = 'bar_chart';
          } else if (queryIntent.includes('CORRELATION') || query.toLowerCase().includes('relationship')) {
            visualizationType = 'scatter_plot';
          } else if (query.toLowerCase().includes('map') || query.toLowerCase().includes('location')) {
            visualizationType = 'map_chart';
          } else {
            // Default to bar chart for most data
            visualizationType = 'bar_chart';
          }
          
          // Prepare visualization data with enhanced insights
          const insights = [];
          
          // Add insights from analytical data if available
          if (analyticalInsights && analyticalInsights.basicStats) {
            // Add basic statistics insights
            const basicStats = analyticalInsights.basicStats;
            Object.entries(basicStats).forEach(([key, value]) => {
              if (key.includes('_avg') || key.includes('_min') || key.includes('_max')) {
                insights.push({
                  type: 'statistic',
                  description: `${key.replace('_', ' ')}: ${value}`
                });
              }
            });
          }
          
          // Add distribution insights
          if (analyticalInsights && analyticalInsights.topDistributions) {
            const distributions = analyticalInsights.topDistributions;
            Object.keys(distributions).slice(0, 2).forEach(key => {
              insights.push({
                type: 'distribution',
                description: `${key} shows interesting distribution patterns`
              });
            });
          }
          
          // Add pattern insights
          if (analyticalInsights && analyticalInsights.keyPatterns) {
            analyticalInsights.keyPatterns.slice(0, 2).forEach(pattern => {
              insights.push({
                type: 'pattern',
                description: `${pattern.category} identified in the data`
              });
            });
          }
          
          // Add recommendations
          if (analyticalInsights && analyticalInsights.recommendations) {
            analyticalInsights.recommendations.slice(0, 2).forEach(recommendation => {
              insights.push({
                type: 'recommendation',
                description: recommendation
              });
            });
          }
          
          // Limit insights to top 4
          const limitedInsights = insights.slice(0, 4);
          
          visualizationData = {
            type: visualizationType,
            data: tabularData,
            configuration: {
              title: `Analysis of ${entityName || 'Data'} Based on Query`,
              showLegend: true,
              interactive: true,
              animations: true,
              theme: 'light',
              responsiveLayout: true
            },
            insights: limitedInsights
          };
          
          this.logger.info(`Generated enhanced visualization of type: ${visualizationType} with ${tabularData.length} data points`);
        } else if (structuredData.tables && structuredData.tables.length > 0) {
          // Use the first extracted table
          const tableData = structuredData.tables[0].data;
          
          if (tableData && tableData.length > 0) {
            // Use the same visualization type determination as above
            if (queryIntent.includes('TREND') || query.toLowerCase().includes('over time')) {
              visualizationType = 'line_chart';
            } else if (queryIntent.includes('DISTRIBUTION') || query.toLowerCase().includes('breakdown')) {
              visualizationType = 'pie_chart';
            } else if (queryIntent.includes('COMPARATIVE') || query.toLowerCase().includes('compare')) {
              visualizationType = 'bar_chart';
            } else if (queryIntent.includes('CORRELATION') || query.toLowerCase().includes('relationship')) {
              visualizationType = 'scatter_plot';
            } else if (query.toLowerCase().includes('map') || query.toLowerCase().includes('location')) {
              visualizationType = 'map_chart';
            } else {
              // Default to bar chart for most data
              visualizationType = 'bar_chart';
            }
            
            // Prepare visualization data with enhanced insights
            const insights = [];
            
            // Add insights from analytical data if available
            if (analyticalInsights && analyticalInsights.basicStats) {
              // Add basic statistics insights
              const basicStats = analyticalInsights.basicStats;
              Object.entries(basicStats).forEach(([key, value]) => {
                if (key.includes('_avg') || key.includes('_min') || key.includes('_max')) {
                  insights.push({
                    type: 'statistic',
                    description: `${key.replace('_', ' ')}: ${value}`
                  });
                }
              });
            }
            
            // Add distribution insights
            if (analyticalInsights && analyticalInsights.topDistributions) {
              const distributions = analyticalInsights.topDistributions;
              Object.keys(distributions).slice(0, 2).forEach(key => {
                insights.push({
                  type: 'distribution',
                  description: `${key} shows interesting distribution patterns`
                });
              });
            }
            
            // Add pattern insights
            if (analyticalInsights && analyticalInsights.keyPatterns) {
              analyticalInsights.keyPatterns.slice(0, 2).forEach(pattern => {
                insights.push({
                  type: 'pattern',
                  description: `${pattern.category} identified in the data`
                });
              });
            }
            
            // Add recommendations
            if (analyticalInsights && analyticalInsights.recommendations) {
              analyticalInsights.recommendations.slice(0, 2).forEach(recommendation => {
                insights.push({
                  type: 'recommendation',
                  description: recommendation
                });
              });
            }
            
            // Limit insights to top 4
            const limitedTableInsights = insights.slice(0, 4);
            
            visualizationData = {
              type: visualizationType,
              data: tableData,
              configuration: {
                title: `Analysis of ${entityName || 'Data'} Based on Query`,
                showLegend: true,
                interactive: true,
                animations: true,
                theme: 'light',
                responsiveLayout: true
              },
              insights: limitedTableInsights
            };
            
            this.logger.info(`Used extracted table for enhanced visualization of type: ${visualizationType} with ${tableData.length} data points`);
          }
        } else if (structuredData.listedEntities && 
                  structuredData.listedEntities.entries && 
                  structuredData.listedEntities.entries.length > 0) {
          // Create visualization from entity list
          const listData = structuredData.listedEntities.entries;
          
          // For entity lists, pie charts or treemaps are often good choices
          visualizationType = 'pie_chart';
          if (listData.length > 10) {
            visualizationType = 'tree_map';
          }
          
          visualizationData = {
            type: visualizationType,
            data: listData,
            configuration: {
              title: `Distribution of ${structuredData.listedEntities.entityName || 'Entities'}`,
              showLegend: true,
              interactive: true,
              animations: true,
              theme: 'light',
              responsiveLayout: true
            }
          };
          
          this.logger.info(`Generated enhanced visualization from entity list of type: ${visualizationType} with ${listData.length} data points`);
        }
      }
      
      // Generate a response with the retrieved documents
      const { content, analysis } = await this.generateResponseWithContext(
        query,
        documents,
        selectedModel,
        {
          rawSystemMessage,
          customSystemMessage,
          enhancedSystemMessage,
          isEntityLookup,
          isEntityListing: isEntityListing,
          isAnalyticalQuery,
          structuredData,
          analyticalInsights
        }
      );
      
      // Generate steps for visualization and analysis
      const processingSteps = [
        {
          id: 'filtering',
          type: 'processing',
          description: 'Data Preparation',
          order: 1,
          content: 'Extracting and organizing data for analysis.'
        },
        {
          id: 'analysis',
          type: 'processing',
          description: 'Data Analysis',
          order: 2,
          content: 'Analyzing the extracted data to identify patterns.'
        },
        {
          id: 'visualization',
          type: 'processing',
          description: 'Data Visualization',
          order: 3,
          content: 'Generating visual representation of the findings.'
        }
      ];
      
      // Generate response metadata
      const metadata: RagResponseMetadata = {
        processingTime: performance.now() - startTime,
        model: selectedModel,
        collectionNames: collectionNames,
        dataSourceIds: normalizedDataSourceIds,
        dataSourceType: dataSourceDescriptions[normalizedDataSourceIds[0]] || 'qdrant',
        isQdrantResponse: true,
        useEnhancedVisualization: true,
        hasVisualization: !!visualizationData,
        queryType: {
          isEntityLookup,
          isEntityListing,
          isAnalytical: isAnalyticalQuery,
          entityName,
          queryIntent
        }
      };
      
      // Add visualization data if available
      if (visualizationData) {
        metadata.visualizationData = visualizationData;
      }
      
      // Add structured analysis if available
      if (analysis) {
        metadata.structuredResponse = analysis;
      }
      
      // Add steps to metadata
      metadata.steps = processingSteps;
      
      // Add analytical insights if available
      if (analyticalInsights) {
        metadata.analyticalInsights = {
          basicStats: analyticalInsights.basicStats || {},
          topDistributions: analyticalInsights.topDistributions || {},
          keyPatterns: analyticalInsights.keyPatterns || [],
          recommendations: analyticalInsights.recommendations || []
        };
      }
      
      // Return complete response
      return {
        sources: documents.map(doc => ({
          id: doc.id || '',
          content: doc.content || '',
          metadata: doc.metadata || {},
          sourceName: doc.sourceName || 'Unknown'
        })),
        content,
        model: selectedModel,
        metadata
      };
    } catch (error) {
      this.logger.error(`Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return this.createErrorResponse(
        'An error occurred while processing your query',
        'QUERY_PROCESSING_ERROR',
        startTime,
        dataSourceIds.map(id => String(id)),
        error
      );
    }
  }
  
  /**
   * Prepares data for visualization based on the selected visualization type
   */
  private prepareVisualizationData(data: any[], visualizationType: string): any[] {
    try {
      if (!data || data.length === 0) {
        return [];
      }
      
      // Clone the data to avoid modifying the original
      const preparedData = JSON.parse(JSON.stringify(data));
      
      // For pie charts, ensure we have category and value fields
      if (visualizationType === 'pie_chart') {
        // Find a numeric field for values
        const sampleRow = preparedData[0];
        let valueField = '';
        let categoryField = '';
        
        // Identify appropriate fields
        for (const field in sampleRow) {
          if (typeof sampleRow[field] === 'number' || 
              (typeof sampleRow[field] === 'string' && !isNaN(parseFloat(sampleRow[field])))) {
            valueField = field;
            break;
          }
        }
        
        // Find a non-numeric field for categories
        for (const field in sampleRow) {
          if (field !== valueField && typeof sampleRow[field] === 'string') {
            categoryField = field;
            break;
          }
        }
        
        // If we found suitable fields, transform data for pie chart
        if (valueField && categoryField) {
          return preparedData.map((item: any) => ({
            category: String(item[categoryField]),
            value: Number(item[valueField])
          }));
        }
        
        // Fall back to counting categories if no value field
        if (categoryField) {
          const categoryMap: Record<string, number> = {};
          preparedData.forEach((item: any) => {
            const category = String(item[categoryField]);
            categoryMap[category] = (categoryMap[category] || 0) + 1;
          });
          
          return Object.entries(categoryMap).map(([category, value]) => ({
            category,
            value
          }));
        }
      }
      
      // For bar charts, ensure we have category and value fields
      if (visualizationType === 'bar_chart' || visualizationType === 'multi_bar_chart') {
        // Find a numeric field for values
        const sampleRow = preparedData[0];
        const valueFields: string[] = [];
        let categoryField = '';
        
        // Identify appropriate fields
        for (const field in sampleRow) {
          if (typeof sampleRow[field] === 'number' || 
              (typeof sampleRow[field] === 'string' && !isNaN(parseFloat(sampleRow[field])))) {
            valueFields.push(field);
          } else if (!categoryField && typeof sampleRow[field] === 'string') {
            categoryField = field;
          }
        }
        
        // If we found suitable fields, transform data for bar chart
        if (valueFields.length > 0 && categoryField) {
          if (visualizationType === 'multi_bar_chart' && valueFields.length > 1) {
            // Multiple value fields for grouped/multi-series bar chart
            return preparedData.map((item: any) => {
              const result: any = { category: String(item[categoryField]) };
              valueFields.forEach(field => {
                result[field] = Number(item[field]);
              });
              return result;
            });
          } else {
            // Single value field for regular bar chart
            return preparedData.map((item: any) => ({
              category: String(item[categoryField]),
              value: Number(item[valueFields[0]])
            }));
          }
        }
      }
      
      // For line charts, ensure we have x and y values
      if (visualizationType === 'line_chart') {
        // Find time field for x-axis
        const sampleRow = preparedData[0];
        let timeField = '';
        const valueFields: string[] = [];
        
        // Look for date/time field
        for (const field in sampleRow) {
          if (field.toLowerCase().includes('date') || 
              field.toLowerCase().includes('time') || 
              field.toLowerCase().includes('year') ||
              field.toLowerCase().includes('month') ||
              field.toLowerCase().includes('day')) {
            timeField = field;
            break;
          }
        }
        
        // If no explicit time field found, try to detect date format
        if (!timeField) {
          for (const field in sampleRow) {
            const value = sampleRow[field];
            if (typeof value === 'string' && (
              /^\d{4}-\d{2}-\d{2}/.test(value) || // ISO date format
              /^\d{2}\/\d{2}\/\d{4}/.test(value) || // MM/DD/YYYY
              value.includes('T') && value.includes('Z') // ISO datetime
            )) {
              timeField = field;
              break;
            }
          }
        }
        
        // Find numeric fields for values
        for (const field in sampleRow) {
          if (field !== timeField && (
            typeof sampleRow[field] === 'number' || 
            (typeof sampleRow[field] === 'string' && !isNaN(parseFloat(sampleRow[field])))
          )) {
            valueFields.push(field);
          }
        }
        
        // If we found suitable fields, transform data for line chart
        if (timeField && valueFields.length > 0) {
          // Sort data by time field
          preparedData.sort((a: any, b: any) => {
            return new Date(a[timeField]).getTime() - new Date(b[timeField]).getTime();
          });
          
          if (valueFields.length === 1) {
            // Single line chart
            return preparedData.map((item: any) => ({
              x: item[timeField],
              y: Number(item[valueFields[0]])
            }));
          } else {
            // Multi-series line chart
            return preparedData.map((item: any) => {
              const result: any = { x: item[timeField] };
              valueFields.forEach(field => {
                result[field] = Number(item[field]);
              });
              return result;
            });
          }
        }
      }
      
      // For scatter/bubble charts
      if (visualizationType === 'scatter_plot' || visualizationType === 'bubble_chart') {
        // Find numeric fields
        const sampleRow = preparedData[0];
        const numericFields: string[] = [];
        let categoryField = '';
        
        // Identify numeric fields
        for (const field in sampleRow) {
          if (typeof sampleRow[field] === 'number' || 
              (typeof sampleRow[field] === 'string' && !isNaN(parseFloat(sampleRow[field])))) {
            numericFields.push(field);
          } else if (!categoryField && typeof sampleRow[field] === 'string') {
            categoryField = field;
          }
        }
        
        if (numericFields.length >= 2) {
          if (visualizationType === 'scatter_plot') {
            // Use first two numeric fields for x and y
            return preparedData.map((item: any) => ({
              x: Number(item[numericFields[0]]),
              y: Number(item[numericFields[1]]),
              category: categoryField ? String(item[categoryField]) : undefined
            }));
          } else if (visualizationType === 'bubble_chart' && numericFields.length >= 3) {
            // Use three numeric fields for x, y, and size
            return preparedData.map((item: any) => ({
              x: Number(item[numericFields[0]]),
              y: Number(item[numericFields[1]]),
              size: Number(item[numericFields[2]]),
              category: categoryField ? String(item[categoryField]) : undefined
            }));
          }
        }
      }
      
      // For map charts, ensure we have location and value fields
      if (visualizationType === 'map_chart') {
        // Find location field
        const sampleRow = preparedData[0];
        let locationField = '';
        let valueField = '';
        
        // Look for location field
        for (const field in sampleRow) {
          if (field.toLowerCase().includes('country') ||
              field.toLowerCase().includes('region') ||
              field.toLowerCase().includes('state') ||
              field.toLowerCase().includes('province') ||
              field.toLowerCase().includes('city') ||
              field.toLowerCase().includes('location') ||
              field.toLowerCase().includes('address') ||
              field.toLowerCase().includes('geo')) {
            locationField = field;
            break;
          }
        }
        
        // Find a value field
        for (const field in sampleRow) {
          if (field !== locationField && (
            typeof sampleRow[field] === 'number' || 
            (typeof sampleRow[field] === 'string' && !isNaN(parseFloat(sampleRow[field])))
          )) {
            valueField = field;
            break;
          }
        }
        
        // If we found a location field, transform data for map visualization
        if (locationField) {
          if (valueField) {
            return preparedData.map((item: any) => ({
              location: String(item[locationField]),
              value: Number(item[valueField])
            }));
          } else {
            // If no value field, count occurrences of each location
            const locationMap: Record<string, number> = {};
            preparedData.forEach((item: any) => {
              const location = String(item[locationField]);
              locationMap[location] = (locationMap[location] || 0) + 1;
            });
            
            return Object.entries(locationMap).map(([location, value]) => ({
              location,
              value
            }));
          }
        }
      }
      
      // For heat maps
      if (visualizationType === 'heat_map') {
        // Find categorical fields for axes and numeric field for intensity
        const sampleRow = preparedData[0];
        const categoricalFields: string[] = [];
        const numericFields: string[] = [];
        
        // Identify appropriate fields
        for (const field in sampleRow) {
          if (typeof sampleRow[field] === 'number' || 
              (typeof sampleRow[field] === 'string' && !isNaN(parseFloat(sampleRow[field])))) {
            numericFields.push(field);
          } else if (typeof sampleRow[field] === 'string') {
            categoricalFields.push(field);
          }
        }
        
        // Need at least two categorical fields and one numeric
        if (categoricalFields.length >= 2 && numericFields.length >= 1) {
          // Use first two categorical fields for x and y axes, and first numeric for intensity
          return preparedData.map((item: any) => ({
            x: String(item[categoricalFields[0]]),
            y: String(item[categoricalFields[1]]),
            intensity: Number(item[numericFields[0]])
          }));
        }
      }
      
      // For tree maps
      if (visualizationType === 'tree_map') {
        // Find categorical field for hierarchy and numeric for size
        const sampleRow = preparedData[0];
        let categoryField = '';
        let valueField = '';
        
        // Identify appropriate fields
        for (const field in sampleRow) {
          if (typeof sampleRow[field] === 'number' || 
              (typeof sampleRow[field] === 'string' && !isNaN(parseFloat(sampleRow[field])))) {
            valueField = field;
          } else if (!categoryField && typeof sampleRow[field] === 'string') {
            categoryField = field;
          }
        }
        
        // If we found suitable fields
        if (categoryField) {
          if (valueField) {
            return preparedData.map((item: any) => ({
              name: String(item[categoryField]),
              value: Number(item[valueField])
            }));
          } else {
            // Count categories if no value field
            const categoryMap: Record<string, number> = {};
            preparedData.forEach((item: any) => {
              const category = String(item[categoryField]);
              categoryMap[category] = (categoryMap[category] || 0) + 1;
            });
            
            return Object.entries(categoryMap).map(([name, value]) => ({
              name,
              value
            }));
          }
        }
      }
      
      // Default - return the data as is
      return preparedData;
    } catch (error) {
      this.logger.warn(`Error preparing visualization data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return data; // Return original data if preparation fails
    }
  }

  /**
   * Enhanced filtering with lower threshold to keep more potentially relevant content
   */
  private async filterRelevantSourcesEnhanced(query: string, sources: any[]): Promise<any[]> {
    if (!sources.length) return [];
    
    try {
      // Get embeddings for the query and sources
      const texts = [query, ...sources.map(s => s.content || '')];
      const embeddings = await this.openaiService.createEmbeddings(texts);
      
      if (!embeddings || embeddings.length < texts.length) {
        return sources.slice(0, 10); // Fallback to top 10 if embeddings fail
      }
      
      // The first embedding is for the query
      const queryEmbedding = embeddings[0];
      
      // Calculate similarity between query and each source
      const scoredSources = [];
      for (let i = 0; i < sources.length; i++) {
        const sourceEmbedding = embeddings[i + 1];
        const similarity = this.calculateCosineSimilarity(queryEmbedding, sourceEmbedding);
        
        // Use a very permissive threshold (0.15) to include more potentially relevant content
        if (similarity > 0.15) {
          scoredSources.push({
            ...sources[i],
            similarity
          });
        }
      }
      
      // Sort by similarity and take top results
      // but ensure we have at least 10 sources if available
      const sorted = scoredSources.sort((a, b) => b.similarity - a.similarity);
      
      // Return more results (up to 100) to ensure comprehensive analysis
      const maxSources = Math.min(100, sorted.length);
      return sorted.slice(0, maxSources);
    } catch (error) {
      this.logger.error(`Error filtering relevant sources: ${error.message}`);
      return sources.slice(0, 10); // Fallback to top 10 if filtering fails
    }
  }

  /**
   * Select appropriate model based on complexity
   * Simple utility method to standardize model selection
   */
  private selectModelForAnalysis(complexity: 'high' | 'medium' | 'low'): string {
    // Choose a model based on complexity
    switch (complexity) {
      case 'high':
        return 'gpt-4o'; // Use the most capable model for complex queries
      case 'medium':
        return 'gpt-4o-mini'; // Use a balanced model for medium complexity
      case 'low':
        return 'gpt-4o-mini'; // Use an efficient model for simple queries
      default:
        return 'gpt-4o-mini'; // Default to a balanced model
    }
  }

  /**
   * Process retrieved documents to extract structured information
   * This enhances the ability to present data for visualization
   * For entity-focused queries, extracts ALL mentions and data about the entity
   */
  private extractStructuredData(documents: any[], query: string): any {
    try {
      // Initialize structured data container
      const result: any = {
        entityCounts: {},
        tableData: null,
        metadata: {}
      };
      
      // Extract tables if present in documents
      const extractedTables = this.extractTablesFromDocuments(documents);
      if (extractedTables && extractedTables.length > 0) {
        result.tableData = extractedTables;
      }
      
      // Extract entities from all documents
      for (const doc of documents) {
        const content = doc.content || '';
        const entities = this.extractEntitiesFromContent(content);
        
        // Count entity occurrences
        for (const entity of entities) {
          if (!result.entityCounts[entity]) {
            result.entityCounts[entity] = 1;
          } else {
            result.entityCounts[entity]++;
          }
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error extracting structured data: ${error.message}`);
      return { entityCounts: {}, tableData: null, metadata: {} };
    }
  }

  /**
   * Prepare documents for LLM processing by combining and formatting them
   */
  private prepareDocumentsForLLM(documents: any[], maxTokens: number = 100000): string {
    try {
      // Sort by relevance if not already sorted
      const sortedDocs = [...documents].sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Initialize context
      let context = '';
      let estimatedTokens = 0;
      const tokensPerChar = 0.25; // Rough estimate of tokens per character
      
      // Add documents until we reach the max token limit
      for (const doc of sortedDocs) {
        const content = doc.content || doc.pageContent || '';
        
        // Skip empty content
        if (!content.trim()) continue;
        
        // Estimate tokens in this document
        const docTokens = content.length * tokensPerChar;
        
        // If adding this document would exceed the token limit, stop
        if (estimatedTokens + docTokens > maxTokens) {
          break;
        }
        
        // Add document to context
        context += `\n\n[Document ${doc.sourceId || 'unknown'}]:\n${content}`;
        estimatedTokens += docTokens;
      }
      
      return context.trim();
    } catch (error) {
      this.logger.error(`Error preparing documents for LLM: ${error.message}`);
      return '';
    }
  }

  /**
   * Check if a query is specifically asking about an entity
   */
  private isEntityLookupQuery(query: string): boolean {
    if (!query) return false;
    
    const entityLookupPatterns = [
      /tell me about\s+(.+)/i,
      /information (on|about)\s+(.+)/i,
      /details (of|about)\s+(.+)/i,
      /who is\s+(.+)/i,
      /what is\s+(.+)/i,
      /describe\s+(.+)/i,
      /explain\s+(.+)/i,
      /show me\s+(.+)/i,
      /find\s+(.+)/i,
      /look up\s+(.+)/i,
      // Add patterns for listing and enumeration queries
      /list (every|all|each)\s+(.+)/i,
      /list (the|all the)\s+(.+)/i,
      /list (every single|every)\s+(.+)/i,
      /enumerate\s+(.+)/i,
      /show (all|every|each)\s+(.+)/i,
      /show (me all|me every|me each)\s+(.+)/i,
      /get (all|every|each)\s+(.+)/i,
      /find (all|every|each)\s+(.+)/i
    ];
    
    // Check if any pattern matches
    for (const pattern of entityLookupPatterns) {
      if (pattern.test(query)) {
        this.logger.info(`Detected entity lookup query: "${query}"`);
        return true;
      }
    }
    
    // Special case for "in [entity]" pattern often used in listing requests
    if (/\b(in|at|from|of)\s+([A-Z0-9][A-Za-z0-9\s]+)/i.test(query)) {
      this.logger.info(`Detected entity lookup query with 'in/at/from' pattern: "${query}"`);
      return true;
    }
    
    return false;
  }

  /**
   * Extract the entity name from an entity-focused query
   * Example: "Tell me about 500 Global" -> "500 Global"
   * Also handles: "List every investor in 500 Global" -> "500 Global"
   */
  private extractEntityFromQuery(query: string): string | null {
    if (!query) return null;
    
    // Patterns to extract entity names
    const patterns = [
      /tell me about\s+([A-Za-z0-9\s]+)/i,
      /information (?:on|about)\s+([A-Za-z0-9\s]+)/i,
      /details (?:of|about)\s+([A-Za-z0-9\s]+)/i,
      /who is\s+([A-Za-z0-9\s]+)/i,
      /what is\s+([A-Za-z0-9\s]+)/i,
      /describe\s+([A-Za-z0-9\s]+)/i,
      /explain\s+([A-Za-z0-9\s]+)/i,
      /show me\s+([A-Za-z0-9\s]+)/i,
      /find\s+([A-Za-z0-9\s]+)/i,
      /look up\s+([A-Za-z0-9\s]+)/i,
      /analyze (?:all entries for|our document and return all entries for)\s+([A-Za-z0-9\s]+)/i,
      /all (?:data|entries|information) (?:for|about)\s+([A-Za-z0-9\s]+)/i,
      /return all entries for\s+([A-Za-z0-9\s]+)/i,
      // Add patterns for listing and enumeration entity extraction
      /list (?:every|all|each|the|all the) (?:\w+\s+){0,3}(?:in|at|from|of)\s+([A-Za-z0-9\s]+)/i,
      /list (?:every single|every) (?:\w+\s+){0,3}(?:in|at|from|of)\s+([A-Za-z0-9\s]+)/i,
      /enumerate (?:\w+\s+){0,3}(?:in|at|from|of)\s+([A-Za-z0-9\s]+)/i,
      /show (?:all|every|each) (?:\w+\s+){0,3}(?:in|at|from|of)\s+([A-Za-z0-9\s]+)/i,
      /show (?:me all|me every|me each) (?:\w+\s+){0,3}(?:in|at|from|of)\s+([A-Za-z0-9\s]+)/i,
      /get (?:all|every|each) (?:\w+\s+){0,3}(?:in|at|from|of)\s+([A-Za-z0-9\s]+)/i,
      /find (?:all|every|each) (?:\w+\s+){0,3}(?:in|at|from|of)\s+([A-Za-z0-9\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const entityName = match[1].trim();
        this.logger.info(`Extracted entity name from query: "${entityName}"`);
        return entityName;
      }
    }
    
    // Special case for queries with "in [Entity]" pattern
    const inEntityMatch = query.match(/\b(?:in|at|from|of)\s+([A-Z0-9][A-Za-z0-9\s]+)/i);
    if (inEntityMatch && inEntityMatch[1]) {
      const entityName = inEntityMatch[1].trim();
      this.logger.info(`Extracted entity name from 'in/at/from' pattern: "${entityName}"`);
      return entityName;
    }
    
    // Fallback: Check for capitalized words in the query
    const words = query.split(' ');
    const capitalizedWords: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check if word starts with uppercase letter or number
      if (/^[A-Z0-9]/.test(word) && word.length > 1) {
        // Extract consecutive capitalized words
        let phrase = word;
        let j = i + 1;
        while (j < words.length && (/^[A-Z0-9]/.test(words[j]) || words[j] === 'Global' || words[j] === 'Capital' || words[j] === 'Ventures' || words[j] === 'Partners')) {
          phrase += ' ' + words[j];
          j++;
        }
        
        if (phrase.length > word.length) {
          capitalizedWords.push(phrase);
          i = j - 1; // Skip the words we've already included in the phrase
        } else {
          capitalizedWords.push(word);
        }
      }
    }
    
    // Special case for "500 Global" since it starts with a number
    if (query.includes('500 Global')) {
      return '500 Global';
    }
    
    // Return the longest capitalized phrase, if any
    if (capitalizedWords.length > 0) {
      const longestPhrase = capitalizedWords.sort((a, b) => b.length - a.length)[0];
      this.logger.info(`Extracted entity name from capitalized words: "${longestPhrase}"`);
      return longestPhrase;
    }
    
    return null;
  }

  /**
   * Extract a complete table from a document, including all rows
   * This helper ensures we get the entire table structure, not just matching rows
   */
  private extractCompleteTable(content: string, entityName?: string): any[] | null {
    if (!content.includes('\n') || !content.includes('  ')) {
      return null; // Not a tabular format
    }
    
    try {
      const tables: any[] = [];
      const lines = content.split('\n');
      
      let currentTable: any = null;
      let headerLineIndex = -1;
      let headerColumns: string[] = [];
      let entityColumnIndex = -1;
      let inTable = false;
      
      // Scan through lines to identify tables
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) {
          if (inTable && currentTable && currentTable.rows.length > 0) {
            // Empty line might signify end of table
            tables.push(currentTable);
            currentTable = null;
            headerColumns = [];
            inTable = false;
          }
          continue;
        }
        
        // Check if this looks like a header line
        if (!inTable && line.includes('  ') && line.split(/\s{2,}/).length > 1) {
          // This might be a header row
          headerColumns = line.split(/\s{2,}/).map(h => h.trim());
          headerLineIndex = i;
          
          // If we have an entity name, check if it's in one of the columns
          if (entityName) {
            entityColumnIndex = headerColumns.findIndex(h => 
              h.includes('Fund') || h.includes('Company') || h.includes('Organization') ||
              h.includes('Name') || h.includes('Entity')
            );
          }
          
          // Start tracking a new table
          currentTable = {
            headers: headerColumns,
            rows: [],
            containsEntity: false
          };
          
          inTable = true;
          continue;
        }
        
        // If we're inside a table, check if this is a data row
        if (inTable && currentTable && line.includes('  ')) {
          const cells = line.split(/\s{2,}/).map(c => c.trim());
          
          // Only add rows with the correct number of columns
          if (cells.length === headerColumns.length) {
            currentTable.rows.push(cells);
            
            // Mark if this row contains our entity of interest
            if (entityName && 
                ((entityColumnIndex >= 0 && cells[entityColumnIndex] === entityName) || 
                 line.includes(entityName))) {
              currentTable.containsEntity = true;
            }
          } else if (cells.length > 0) {
            // This might be a malformed row or the end of the table
            // Heuristic: if it has fewer columns, likely not part of the table
            // For now, we'll still include it if it has at least some content
            if (cells.length >= headerColumns.length / 2) {
              // Fill in missing cells with empty strings
              while (cells.length < headerColumns.length) {
                cells.push('');
              }
              currentTable.rows.push(cells);
            }
          }
        }
        
        // Check for end of table - if we hit a new potential header
        if (inTable && i > headerLineIndex + 1 && 
            line.includes('  ') && 
            !line.includes('-') && // Not a separator line
            line.split(/\s{2,}/).length !== headerColumns.length) {
            
          // Save the current table if it has rows
          if (currentTable && currentTable.rows.length > 0) {
            tables.push(currentTable);
          }
          
          // This could be a new header row
          headerColumns = line.split(/\s{2,}/).map(h => h.trim());
          headerLineIndex = i;
          
          // Reset entity column index
          if (entityName) {
            entityColumnIndex = headerColumns.findIndex(h => 
              h.includes('Fund') || h.includes('Company') || h.includes('Organization') ||
              h.includes('Name') || h.includes('Entity')
            );
          }
          
          // Start tracking a new table
          currentTable = {
            headers: headerColumns,
            rows: [],
            containsEntity: false
          };
        }
      }
      
      // Don't forget to add the last table if we were tracking one
      if (inTable && currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
      }
      
      // Filter to only include tables that contain our entity of interest
      const relevantTables = entityName 
        ? tables.filter(t => t.containsEntity) 
        : tables;
      
      return relevantTables.length > 0 ? relevantTables : tables;
    } catch (error) {
      this.logger.error(`Error extracting complete tables: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Analyzes structured data to provide analytical insights
   * Leverages the StatisticalAnalysisService for more sophisticated analysis.
   * @param query The original user query
   * @param structuredData The structured data extracted from documents
   * @returns Object containing analytical insights
   */
  private async analyzeStructuredData(query: string, structuredData: any): Promise<any> {
    try {
      if (!structuredData) {
        return {
          basicStats: {},
          topDistributions: {},
          keyPatterns: [],
          recommendations: []
        };
      }
      
      // Initialize result object
      const results: any = {
        basicStats: {},
        topDistributions: {},
        keyPatterns: [],
        recommendations: []
      };
      
      // First, try using the StatisticalAnalysisService if available
      if (this.statisticalAnalysis) {
        try {
          this.logger.info('Using StatisticalAnalysisService for deep analysis');
          
          // Prepare data for statistical analysis
          let dataForAnalysis: any[] = [];
          
          // Extract tabular data from different possible structures
          if (structuredData.tables && structuredData.tables.length > 0) {
            // Use the first table with data
            for (const table of structuredData.tables) {
              if (table.data && table.data.length > 0) {
                dataForAnalysis = table.data;
                break;
              }
            }
          } else if (structuredData.listedEntities && 
                     structuredData.listedEntities.entries && 
                     structuredData.listedEntities.entries.length > 0) {
            dataForAnalysis = structuredData.listedEntities.entries;
          } else if (structuredData.specificEntityData && 
                     structuredData.specificEntityData.data) {
            // Convert entity data to array if needed
            const entityData = structuredData.specificEntityData.data;
            if (Array.isArray(entityData)) {
              dataForAnalysis = entityData;
            } else {
              dataForAnalysis = [entityData];
            }
          }
          
          // Only proceed if we have data to analyze
          if (dataForAnalysis.length > 0) {
            // Get descriptive statistics
            const statsResult = await this.statisticalAnalysis.analyze(dataForAnalysis, 'statistics');
            if (statsResult && statsResult.statistics) {
              results.basicStats = statsResult.statistics;
              this.logger.info(`Generated ${Object.keys(results.basicStats).length} descriptive statistics`);
            }
            
            // Calculate distributions
            const distributionsResult = await this.statisticalAnalysis.analyze(dataForAnalysis, 'distributions');
            if (distributionsResult && distributionsResult.distributions) {
              results.topDistributions = distributionsResult.distributions;
              this.logger.info(`Generated ${Object.keys(results.topDistributions).length} distributions`);
            }
            
            // Identify correlations and patterns
            const correlationsResult = await this.statisticalAnalysis.analyze(dataForAnalysis, 'patterns', { query });
            if (correlationsResult && correlationsResult.patterns) {
              results.keyPatterns = correlationsResult.patterns.map((pattern: any) => ({
                category: pattern.category || pattern.type || 'Correlation',
                strength: pattern.strength || pattern.confidence || 0.8,
                values: pattern.items || pattern.entities || pattern.values || []
              }));
              this.logger.info(`Identified ${results.keyPatterns.length} patterns and correlations`);
            }
            
            // Get recommendations for further analysis
            const recommendationsResult = await this.statisticalAnalysis.analyze(dataForAnalysis, 'recommendations', { query });
            if (recommendationsResult && recommendationsResult.recommendations) {
              results.recommendations = recommendationsResult.recommendations;
              this.logger.info(`Generated ${results.recommendations.length} analytical recommendations`);
            }
            
            return results;
          }
        } catch (serviceError) {
          this.logger.warn(`Error using StatisticalAnalysisService: ${serviceError instanceof Error ? serviceError.message : 'Unknown error'}`);
          // Fall through to basic analysis
        }
      }
      
      // Basic fallback analysis if service is unavailable or failed
      this.logger.info('Using basic fallback analysis');
      
      // Extract basic statistics
      results.basicStats = this.extractBasicStats(structuredData, query);
      
      // Extract distributions
      results.topDistributions = this.extractDistributions(structuredData);
      
      // Extract patterns
      results.keyPatterns = this.extractPatterns(structuredData);
      
      // Generate recommendations
      results.recommendations = this.generateRecommendations(structuredData, query);
      
      return results;
    } catch (error) {
      this.logger.error(`Error in analyzeStructuredData: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        basicStats: {},
        topDistributions: {},
        keyPatterns: [],
        recommendations: []
      };
    }
  }
  
  /**
   * Extract basic statistics from structured data
   */
  private extractBasicStats(structuredData: any, query: string): Record<string, any> {
    const stats: Record<string, any> = {};
    
    try {
      // Entity count statistics
      if (structuredData.listedEntities && structuredData.listedEntities.entries) {
        const entries = structuredData.listedEntities.entries;
        stats['entityCount'] = entries.length;
        stats['entityType'] = structuredData.listedEntities.entityName || 'Items';
        
        // Extract entity with most connections/mentions if available
        if (entries.length > 0 && entries[0].connections) {
          const mostConnected = [...entries].sort((a, b) => 
            (b.connections?.length || 0) - (a.connections?.length || 0)
          )[0];
          
          if (mostConnected) {
            stats['mostConnectedEntity'] = mostConnected.name || mostConnected.id;
            stats['connectionCount'] = mostConnected.connections?.length || 0;
          }
        }
      }
      
      // Table statistics
      if (structuredData.tables && structuredData.tables.length > 0) {
        const table = structuredData.tables[0];
        stats['rowCount'] = table.data ? table.data.length : 0;
        stats['columnCount'] = table.data && table.data.length > 0 ? Object.keys(table.data[0]).length : 0;
        
        // Numeric field statistics for first table
        if (table.data && table.data.length > 0) {
          const numericStats = this.calculateNumericStats(table.data);
          Object.assign(stats, numericStats);
        }
      }
      
      // Entity-specific statistics
      if (structuredData.specificEntityData && structuredData.specificEntityData.data) {
        stats['entityName'] = structuredData.specificEntityData.entityName || 'Entity';
        
        const entityData = structuredData.specificEntityData.data;
        // Count attributes
        if (typeof entityData === 'object') {
          stats['attributeCount'] = Object.keys(entityData).length;
          
          // Extract most significant attributes based on query
          const queryTerms = query.toLowerCase().split(/\s+/);
          const relatedAttributes = Object.entries(entityData)
            .filter(([key]) => 
              queryTerms.some(term => key.toLowerCase().includes(term))
            )
            .map(([key, value]) => ({ key, value }));
            
          if (relatedAttributes.length > 0) {
            stats['queryRelevantAttributes'] = relatedAttributes.length;
            stats['primaryAttribute'] = relatedAttributes[0].key;
            stats['primaryValue'] = relatedAttributes[0].value;
          }
        }
      }
      
      return stats;
    } catch (error) {
      this.logger.warn(`Error extracting basic stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return stats;
    }
  }
  
  /**
   * Calculate numeric statistics for tabular data
   */
  private calculateNumericStats(data: any[]): Record<string, any> {
    const stats: Record<string, any> = {};
    
    try {
      if (!data || data.length === 0) {
        return stats;
      }
      
      const numericFields: string[] = [];
      
      // Identify numeric fields
      Object.entries(data[0]).forEach(([field, value]) => {
        if (
          typeof value === 'number' || 
          (typeof value === 'string' && !isNaN(parseFloat(value)))
        ) {
          numericFields.push(field);
        }
      });
      
      // Calculate statistics for each numeric field
      numericFields.forEach(field => {
        const values = data.map(item => {
          const val = item[field];
          return typeof val === 'number' ? val : parseFloat(val);
        }).filter(val => !isNaN(val));
        
        if (values.length > 0) {
          // Sort values for percentiles
          const sortedValues = [...values].sort((a, b) => a - b);
          
          // Calculate basic statistics
          const sum = values.reduce((acc, val) => acc + val, 0);
          const avg = sum / values.length;
          const min = sortedValues[0];
          const max = sortedValues[sortedValues.length - 1];
          const median = sortedValues[Math.floor(sortedValues.length / 2)];
          
          // Calculate standard deviation
          const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
          const stdDev = Math.sqrt(variance);
          
          // Store statistics
          stats[`${field}_avg`] = avg;
          stats[`${field}_min`] = min;
          stats[`${field}_max`] = max;
          stats[`${field}_median`] = median;
          stats[`${field}_stdDev`] = stdDev;
        }
      });
      
      return stats;
    } catch (error) {
      this.logger.warn(`Error calculating numeric stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return stats;
    }
  }
  
  /**
   * Extract distributions from structured data
   */
  private extractDistributions(structuredData: any): Record<string, any> {
    const distributions: Record<string, any> = {};
    
    try {
      // Extract distributions from entity listings
      if (structuredData.listedEntities && 
          structuredData.listedEntities.entries && 
          structuredData.listedEntities.entries.length > 0) {
        
        const entries = structuredData.listedEntities.entries;
        
        // Find categorical fields to analyze
        if (entries.length > 0) {
          const categoricalFields = Object.entries(entries[0])
            .filter(([key, value]) => 
              typeof value === 'string' && 
              !key.startsWith('_') && 
              key !== 'id' && 
              key !== 'content' &&
              key !== 'name'
            )
            .map(([key]) => key);
            
          // Calculate distributions for each categorical field
          categoricalFields.forEach(field => {
            const valueMap: Record<string, number> = {};
            
            entries.forEach(entry => {
              const value = String(entry[field] || '').trim();
              if (value) {
                valueMap[value] = (valueMap[value] || 0) + 1;
              }
            });
            
            // Only include if we have meaningful distribution
            if (Object.keys(valueMap).length > 1) {
              distributions[field] = valueMap;
            }
          });
        }
        
        // Add name distribution if no other fields found
        if (Object.keys(distributions).length === 0 && entries[0].name) {
          // Try to extract categories from names
          const categoryMap: Record<string, number> = {};
          
          entries.forEach(entry => {
            const name = entry.name;
            if (name) {
              // Extract first word or prefix as category
              const match = /^([A-Za-z]+)/.exec(name);
              if (match) {
                const category = match[1];
                categoryMap[category] = (categoryMap[category] || 0) + 1;
              }
            }
          });
          
          // Only include if we have meaningful distribution
          if (Object.keys(categoryMap).length > 1) {
            distributions['namePrefix'] = categoryMap;
          }
        }
      }
      
      // Extract distributions from tables
      if (structuredData.tables && 
          structuredData.tables.length > 0 && 
          structuredData.tables[0].data && 
          structuredData.tables[0].data.length > 0) {
          
        const tableData = structuredData.tables[0].data;
        
        // Find categorical fields to analyze
        const sampleRow = tableData[0];
        const categoricalFields = Object.entries(sampleRow)
          .filter(([key, value]) => 
            typeof value === 'string' && 
            !key.startsWith('_') && 
            key !== 'id' &&
            key !== 'rowNumber'
          )
          .map(([key]) => key);
          
        // Calculate distributions for each categorical field
        categoricalFields.forEach(field => {
          const valueMap: Record<string, number> = {};
          
          tableData.forEach(row => {
            const value = String(row[field] || '').trim();
            if (value) {
              valueMap[value] = (valueMap[value] || 0) + 1;
            }
          });
          
          // Only include if we have meaningful distribution (more than one value)
          if (Object.keys(valueMap).length > 1 && Object.keys(valueMap).length < 20) {
            distributions[field] = valueMap;
          }
        });
        
        // Analyze numeric fields for range distributions
        const numericFields = Object.entries(sampleRow)
          .filter(([key, value]) => 
            (typeof value === 'number' || 
            (typeof value === 'string' && !isNaN(parseFloat(value)))) && 
            !key.startsWith('_') && 
            key !== 'id' &&
            key !== 'rowNumber'
          )
          .map(([key]) => key);
          
        // Create range distributions for numeric fields
        numericFields.forEach(field => {
          const values = tableData.map(row => {
            const value = row[field];
            return typeof value === 'number' ? value : parseFloat(value);
          }).filter(val => !isNaN(val));
          
          if (values.length > 0) {
            // Calculate range distribution with 5-10 buckets
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min;
            
            // Determine number of buckets based on data size
            const bucketCount = Math.min(Math.max(5, Math.ceil(values.length / 5)), 10);
            
            // Create buckets
            if (range > 0 && bucketCount > 1) {
              const bucketSize = range / (bucketCount - 1);
              const rangeMap: Record<string, number> = {};
              
              values.forEach(value => {
                const bucketIndex = Math.min(
                  Math.floor((value - min) / bucketSize), 
                  bucketCount - 1
                );
                const bucketStart = min + bucketIndex * bucketSize;
                const bucketEnd = bucketStart + bucketSize;
                const bucketLabel = `${bucketStart.toFixed(1)}-${bucketEnd.toFixed(1)}`;
                
                rangeMap[bucketLabel] = (rangeMap[bucketLabel] || 0) + 1;
              });
              
              distributions[`${field}_ranges`] = rangeMap;
            }
          }
        });
      }
      
      return distributions;
    } catch (error) {
      this.logger.warn(`Error extracting distributions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return distributions;
    }
  }
  
  /**
   * Extract patterns from structured data
   */
  private extractPatterns(structuredData: any[]): Array<{category: string, values: any[]}> {
    if (!structuredData || structuredData.length === 0) {
      return []; // Return empty array if no data
    }
    
    try {
      const patterns: Array<{category: string, values: any[]}> = [];
      
      // If we have statisticalAnalysis service use it
      if (this.statisticalAnalysis) {
        try {
          // Use any method available in the real service that returns patterns
          const servicePatterns = this.statisticalAnalysis.findPatterns
            ? this.statisticalAnalysis.findPatterns(structuredData)
            : this.statisticalAnalysis.analyzePatterns
              ? this.statisticalAnalysis.analyzePatterns(structuredData)
              : null;
          
          if (servicePatterns && Array.isArray(servicePatterns)) {
            return servicePatterns;
          }
        } catch (err) {
          this.logger.warn(`Error in statistical analysis pattern extraction: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      // Fallback pattern detection if service fails or isn't available
      // Basic pattern detection logic
      const sampleRow = structuredData[0];
      
      // Find numeric and categorical fields
      const numericFields: string[] = [];
      const categoryFields: string[] = [];
      
      for (const field in sampleRow) {
        const value = sampleRow[field];
        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
          numericFields.push(field);
        } else if (typeof value === 'string') {
          categoryFields.push(field);
        }
      }
      
      // Extract some basic patterns
      if (categoryFields.length > 0 && numericFields.length > 0) {
        const primaryCategory = categoryFields[0];
        const primaryMetric = numericFields[0];
        
        // Group data by category and find patterns
        const categoryGroups: Record<string, any[]> = {};
        for (const row of structuredData) {
          const categoryValue = String(row[primaryCategory] || 'Unknown');
          if (!categoryGroups[categoryValue]) {
            categoryGroups[categoryValue] = [];
          }
          categoryGroups[categoryValue].push(row);
        }
        
        // Look for patterns in category distributions
        if (Object.keys(categoryGroups).length > 0) {
          const categoryValues = Object.keys(categoryGroups).map(category => {
            const count = categoryGroups[category].length;
            const sum = categoryGroups[category].reduce((acc, row) => {
              const val = parseFloat(row[primaryMetric]);
              return acc + (isNaN(val) ? 0 : val);
            }, 0);
            const avg = count > 0 ? sum / count : 0;
            
            return {
              category,
              count,
              sum,
              avg
            };
          });
          
          patterns.push({
            category: 'Distribution by ' + primaryCategory,
            values: categoryValues
          });
        }
      }
      
      // Always return patterns (even if empty array)
      return patterns;
    } catch (err) {
      this.logger.warn(`Error in extractPatterns: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return []; // Return empty array on error
    }
  }

  /**
   * Enhance visualization with analytical insights to make it more informative
   */
  private enhanceVisualization(
    visualizationType: string, 
    visualizationData: any[], 
    analyticalInsights: any,
    query: string
  ): {
    type: string;
    data: any[];
    annotations?: any[];
    insights?: any[];
    configuration?: any;
  } {
    try {
      // Clone data to avoid modifying original
      const enhancedVisualization: {
        type: string;
        data: any[];
        annotations?: any[];
        insights?: any[];
        configuration?: any;
      } = {
            type: visualizationType,
        data: JSON.parse(JSON.stringify(visualizationData))
      };
      
      // Initialize annotations and insights
      const annotations: any[] = [];
      const insights: any[] = [];
      
      // Default configuration based on visualization type
      const configuration: any = {
        title: this.generateVisualizationTitle(query, visualizationType),
              showLegend: true,
              interactive: true,
              animations: true,
              theme: 'light',
              responsiveLayout: true
      };
      
      // Determine if we have meaningful analytical insights
      const hasBasicStats = analyticalInsights?.basicStats && Object.keys(analyticalInsights.basicStats).length > 0;
      const hasDistributions = analyticalInsights?.topDistributions && Object.keys(analyticalInsights.topDistributions).length > 0;
      const hasPatterns = analyticalInsights?.keyPatterns && analyticalInsights.keyPatterns.length > 0;
      
      // Apply enhancements based on visualization type
      if (visualizationType === 'bar_chart' || visualizationType === 'multi_bar_chart') {
        // Add mean/average line if we have basic stats
        if (hasBasicStats) {
          // Find relevant statistic for this chart
          const relevantAvg = Object.entries(analyticalInsights.basicStats)
            .find(([key, ]) => key.endsWith('_avg') || key.includes('average') || key.includes('mean'));
            
          if (relevantAvg) {
            annotations.push({
              type: 'line',
              value: relevantAvg[1],
              label: `Average: ${typeof relevantAvg[1] === 'number' ? relevantAvg[1].toFixed(2) : relevantAvg[1]}`,
              color: '#FF5733',
              dashPattern: [5, 5],
              position: 'top'
            });
            
            insights.push({
              type: 'average',
              description: `The average ${relevantAvg[0].replace('_avg', '')} is ${typeof relevantAvg[1] === 'number' ? relevantAvg[1].toFixed(2) : relevantAvg[1]}`
            });
          }
        }
        
        // Add sorting for better visual analysis
        configuration.sortData = true;
        configuration.sortDirection = 'descending';
        configuration.showValues = true;
        
        // Add color gradient based on values
        configuration.useColorGradient = true;
        configuration.colorScheme = 'blue-green';
        
        // Add trend insight if available
        if (hasPatterns) {
          const trendPattern = analyticalInsights.keyPatterns
            .find(pattern => pattern.category.toLowerCase().includes('trend') || pattern.category.toLowerCase().includes('change'));
            
          if (trendPattern) {
            insights.push({
              type: 'trend',
              description: `Trend analysis: ${trendPattern.values[0]?.description || trendPattern.category}`
            });
          }
        }
      }
      
      else if (visualizationType === 'line_chart') {
        // Add trend and average annotations
        if (hasBasicStats) {
          const relevantStats = Object.entries(analyticalInsights.basicStats)
            .filter(([key, ]) => 
              key.endsWith('_avg') || 
              key.endsWith('_min') || 
              key.endsWith('_max')
            );
            
          relevantStats.forEach(([key, value]) => {
            if (key.endsWith('_avg')) {
              annotations.push({
                type: 'line',
                value: value,
                label: `Average: ${(value as number).toFixed(2)}`,
                color: '#FF5733',
                dashPattern: [5, 5],
                position: 'right'
              });
            }
          });
        }
        
        // Add growth rate annotation if possible
        if (visualizationData.length >= 2) {
          const firstPoint = visualizationData[0];
          const lastPoint = visualizationData[visualizationData.length - 1];
          
          if (firstPoint.y !== undefined && lastPoint.y !== undefined) {
            const startValue = firstPoint.y;
            const endValue = lastPoint.y;
            const growthPercent = ((endValue - startValue) / startValue) * 100;
            
            insights.push({
              type: 'growth',
              description: `Total change: ${growthPercent.toFixed(1)}% from ${startValue.toFixed(1)} to ${endValue.toFixed(1)}`
            });
          }
        }
        
        // Add smoother curve for better visual appeal
        configuration.curve = 'natural';
        configuration.showDataPoints = true;
        configuration.lineWidth = 3;
        configuration.fillBetween = true;
        configuration.fillOpacity = 0.2;
      }
      
      else if (visualizationType === 'pie_chart') {
        // Add percentage labels
        configuration.showPercentages = true;
        configuration.showValues = true;
        configuration.colorScheme = 'categorical';
        configuration.innerRadius = 0.5; // Make it a donut chart for better visuals
        
        // Add insight about largest segment
        if (visualizationData.length > 0) {
          const sortedData = [...visualizationData].sort((a, b) => b.value - a.value);
          const largestSegment = sortedData[0];
          const totalValue = visualizationData.reduce((sum, item) => sum + item.value, 0);
          const percentage = (largestSegment.value / totalValue * 100).toFixed(1);
          
          insights.push({
            type: 'proportion',
            description: `${largestSegment.category} represents the largest segment at ${percentage}% of the total`
          });
          
          // Add insight about concentration
          if (sortedData.length >= 3) {
            const top3Value = sortedData.slice(0, 3).reduce((sum, item) => sum + item.value, 0);
            const top3Percentage = (top3Value / totalValue * 100).toFixed(1);
            
            insights.push({
              type: 'concentration',
              description: `Top 3 categories represent ${top3Percentage}% of the total`
            });
          }
        }
      }
      
      else if (visualizationType === 'scatter_plot') {
        // Add trend line
        configuration.showTrendLine = true;
        configuration.trendLineColor = '#FF5733';
        configuration.trendLineWidth = 2;
        
        // Add quadrant labels for better interpretation
        configuration.showQuadrants = true;
        configuration.quadrantLabels = {
          topRight: 'High performers',
          topLeft: 'Mixed results',
          bottomRight: 'Mixed results',
          bottomLeft: 'Underperformers'
        };
        
        // Add correlation insight if available
        if (hasPatterns) {
          const correlationPattern = analyticalInsights.keyPatterns
            .find(pattern => pattern.category.toLowerCase().includes('correlation'));
            
          if (correlationPattern && correlationPattern.values.length > 0) {
            insights.push({
              type: 'correlation',
              description: correlationPattern.values[0]?.description || 'Correlation found between variables'
            });
          }
        }
      }
      
      else if (visualizationType === 'map_chart') {
        // Add region coloring based on value ranges
        configuration.colorScheme = 'sequential-blue';
        configuration.showLegend = true;
        configuration.legendTitle = 'Value range';
        
        // Add highest/lowest region insights
        if (visualizationData.length > 0) {
          const sortedData = [...visualizationData].sort((a, b) => b.value - a.value);
          const highestRegion = sortedData[0];
          const lowestRegion = sortedData[sortedData.length - 1];
          
          insights.push({
            type: 'regional_high',
            description: `${highestRegion.location} has the highest value at ${highestRegion.value}`
          });
          
          insights.push({
            type: 'regional_low',
            description: `${lowestRegion.location} has the lowest value at ${lowestRegion.value}`
          });
        }
      }
      
      else if (visualizationType === 'heat_map') {
        // Add color scale customization
        configuration.colorScheme = 'sequential-multi';
        configuration.showScale = true;
        configuration.cellSize = 'adaptive';
        
        // Add hotspot insights
        insights.push({
          type: 'hotspots',
          description: 'The visualization highlights hotspots where values are significantly higher than surrounding areas'
        });
      }
      
      else if (visualizationType === 'tree_map') {
        // Add hierarchical coloring
        configuration.colorScheme = 'categorical';
        configuration.showLabels = true;
        configuration.labelSize = 'auto';
        
        // Add segment insights
        if (visualizationData.length > 0) {
          const totalValue = visualizationData.reduce((sum, item) => sum + item.value, 0);
          const largestSegment = [...visualizationData].sort((a, b) => b.value - a.value)[0];
          const percentage = (largestSegment.value / totalValue * 100).toFixed(1);
          
          insights.push({
            type: 'segment_proportion',
            description: `${largestSegment.name} represents ${percentage}% of the total size`
          });
        }
      }
      
      // Add common enhancements for all visualization types
      if (hasDistributions) {
        const topDistribution = Object.entries(analyticalInsights.topDistributions)[0];
        if (topDistribution) {
          insights.push({
            type: 'distribution',
            description: `${topDistribution[0]} shows a notable distribution pattern worth exploring`
          });
        }
      }
      
      // Add recommendations as insights if available
      if (analyticalInsights.recommendations && analyticalInsights.recommendations.length > 0) {
        analyticalInsights.recommendations.slice(0, 2).forEach((recommendation: string) => {
          insights.push({
            type: 'recommendation',
            description: recommendation
          });
        });
      }
      
      // Limit the number of insights to avoid overwhelming the visualization
      if (insights.length > 4) {
        insights.length = 4;
      }
      
      // Attach annotations, insights and configuration to the enhanced visualization
      enhancedVisualization.annotations = annotations;
      enhancedVisualization.insights = insights;
      enhancedVisualization.configuration = configuration;
      
      return enhancedVisualization;
    } catch (error) {
      this.logger.warn(`Error enhancing visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        type: visualizationType,
        data: visualizationData
      };
    }
  }
  
  /**
   * Generate a meaningful title for the visualization based on the query
   */
  private generateVisualizationTitle(query: string, visualizationType: string): string {
    try {
      // Extract key terms from the query
      const queryLower = query.toLowerCase();
      const entityMatch = /\b(?:about|for|on|regarding)\s+([a-z0-9\s]+)(?:in|by|across|from|to|with)?/i.exec(query);
      
      let entity = '';
      if (entityMatch && entityMatch[1]) {
        entity = entityMatch[1].trim();
      } else {
        // Try to find a capitalized entity name in the query
        const capitalizedMatch = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/.exec(query);
        if (capitalizedMatch) {
          entity = capitalizedMatch[1];
        }
      }
      
      // Determine what is being analyzed
      let analysisType = '';
      if (queryLower.includes('distribution') || queryLower.includes('breakdown')) {
        analysisType = 'Distribution';
      } else if (queryLower.includes('trend') || queryLower.includes('over time')) {
        analysisType = 'Trend';
      } else if (queryLower.includes('comparison') || queryLower.includes('versus') || queryLower.includes(' vs ')) {
        analysisType = 'Comparison';
      } else if (queryLower.includes('correlation') || queryLower.includes('relationship')) {
        analysisType = 'Correlation';
      } else {
        // Default based on visualization type
        switch (visualizationType) {
          case 'bar_chart':
            analysisType = 'Comparison';
            break;
          case 'line_chart':
            analysisType = 'Trend';
            break;
          case 'pie_chart':
            analysisType = 'Distribution';
            break;
          case 'scatter_plot':
            analysisType = 'Relationship';
            break;
          case 'map_chart':
            analysisType = 'Geographic Distribution';
            break;
          case 'heat_map':
            analysisType = 'Intensity Map';
            break;
          case 'tree_map':
            analysisType = 'Hierarchical View';
            break;
          default:
            analysisType = 'Analysis';
        }
      }
      
      // Build a meaningful title
      if (entity) {
        return `${analysisType} of ${entity.charAt(0).toUpperCase() + entity.slice(1)}`;
      } else {
        // Extract action verbs from query
        const actionMatch = /\b(analyze|show|display|present|visualize|compare|find|list|get)\s+([a-z0-9\s]+)/i.exec(query);
        
        if (actionMatch && actionMatch[2]) {
          const topic = actionMatch[2].trim();
          return `${analysisType} of ${topic.charAt(0).toUpperCase() + topic.slice(1)}`;
        }
      }
      
      // Fallback title
      return `${analysisType} Based on Query Results`;
    } catch (error) {
      this.logger.warn(`Error generating visualization title: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 'Data Visualization';
    }
  }

  private isEntityListingQuery(query: string): boolean {
    return query.match(/list|enumerate|show all|find all|get all/i) !== null;
  }

  private extractQueryIntent(query: string): string {
    try {
      // Try to use NlpProcessor service if available
      if (this.nlpProcessor) {
        try {
          const analysisResult = this.nlpProcessor.analyzeQuery(query);
          if (analysisResult && 
              typeof analysisResult === 'object' && 
              'queryType' in analysisResult && 
              analysisResult.queryType) {
            return analysisResult.queryType.toString();
          }
        } catch (err) {
          this.logger.warn(`Error using NlpProcessor for intent detection: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      // Fallback to basic keyword matching
      const queryLower = query.toLowerCase();
      
      if (queryLower.includes('compare') || queryLower.includes('difference') || queryLower.includes('versus') || queryLower.includes(' vs ')) {
        return 'COMPARATIVE';
      } else if (queryLower.includes('trend') || queryLower.includes('over time') || queryLower.includes('growth') || queryLower.includes('history')) {
        return 'TREND';
      } else if (queryLower.includes('distribution') || queryLower.includes('breakdown') || queryLower.includes('composition')) {
        return 'DISTRIBUTION';
      } else if (queryLower.includes('rank') || queryLower.includes('top') || queryLower.includes('best') || queryLower.includes('worst')) {
        return 'RANKING';
      } else if (queryLower.includes('correlat') || queryLower.includes('relationship') || queryLower.includes('connection')) {
        return 'CORRELATION';
      } else if (queryLower.includes('unusual') || queryLower.includes('anomaly') || queryLower.includes('outlier')) {
        return 'ANOMALY';
      } else if (queryLower.includes('segment') || queryLower.includes('group') || queryLower.includes('cluster')) {
        return 'SEGMENTATION';
      } else if (this.isEntityLookupQuery(query)) {
        return 'ENTITY_LOOKUP';
      } else if (this.isEntityListingQuery(query)) {
        return 'ENTITY_LISTING';
      }
      
      return 'INFORMATIONAL';
    } catch (error) {
      this.logger.warn(`Error extracting query intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 'INFORMATIONAL';
    }
  }

  private determineVisualizationType(query: string, data: any[]): string {
    try {
      // First try to use the AnalyticsProcessor if available
      if (this.analyticsProcessor) {
        try {
          const analyticalOperations = this.analyticsProcessor.determineAnalyticalOperations(query);
          const recommendedViz = this.analyticsProcessor.determineVisualizationType(query, analyticalOperations);
          
          if (recommendedViz) {
            this.logger.info(`AnalyticsProcessor recommended visualization: ${recommendedViz} based on operations: ${JSON.stringify(analyticalOperations)}`);
            return recommendedViz.toLowerCase().replace(/ /g, '_');
          }
        } catch (err) {
          this.logger.warn(`Error using AnalyticsProcessor for visualization: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall through to basic detection
        }
      }
      
      // Check for specific keywords in the query
      if (query.match(/\b(trend|growth|change over time|historical|forecast|projection|time series)\b/i)) {
        return 'line_chart';
      } else if (query.match(/\b(compare|comparison|versus|vs\.|difference between)\b/i)) {
        return 'bar_chart';
      } else if (query.match(/\b(distribution|breakdown|proportion|percentage|share|ratio)\b/i)) {
        return 'pie_chart';
      } else if (query.match(/\b(relationship|correlation|scatter|plot|regression)\b/i)) {
        return 'scatter_plot';
      } else if (query.match(/\b(map|geographic|location|regional|country|state|global)\b/i)) {
        return 'map_chart';
      } else if (query.match(/\b(network|connection|link|flow|sankey)\b/i)) {
        return 'network_graph';
      } else if (query.match(/\b(hierarchy|tree|organization|structure)\b/i)) {
        return 'tree_map';
      } else if (query.match(/\b(heatmap|matrix|grid|intensity)\b/i)) {
        return 'heat_map';
      } else if (query.match(/\b(radar|spider|web|multi-dimension)\b/i)) {
        return 'radar_chart';
      } else if (query.match(/\b(funnel|pipeline|stages|conversion)\b/i)) {
        return 'funnel_chart';
      } else if (query.match(/\b(waterfall|cumulative|sequential|step)\b/i)) {
        return 'waterfall_chart';
      } else if (query.match(/\b(bubble|size|scale|magnitude)\b/i)) {
        return 'bubble_chart';
      } else if (query.match(/\b(gauge|meter|dial|kpi|target)\b/i)) {
        return 'gauge_chart';
      }
      
      // All the other logic...
      
      // Default to table if no better visualization determined
      return 'table';
    } catch (err) {
      this.logger.warn(`Error in determineVisualizationType: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return 'table';
    }
  } // <-- Make sure this closing brace is correct

  /**
   * Generate recommendations for further analysis
   */
  private generateRecommendations(structuredData: any, query: string): string[] {
    const recommendations: string[] = [];
    
    try {
      // Extract query type
      const queryLower = query.toLowerCase();
      const isEntityListing = this.isEntityListingQuery(query);
      const isTimeQuery = queryLower.match(/\b(trend|over time|historical|growth|change|since|between dates|from \d{4}|year|month|quarter)\b/i);
      const isComparisonQuery = queryLower.match(/\b(compare|comparison|versus|vs|difference|against|higher|lower|better|worse)\b/i);
      
      // Time-based recommendations
      if (isTimeQuery) {
        recommendations.push("Consider analyzing the growth rate between time periods");
        recommendations.push("Look for seasonality patterns in the time series data");
        recommendations.push("Compare year-over-year or month-over-month changes");
      }
      
      // Comparison recommendations
      if (isComparisonQuery) {
        recommendations.push("Calculate the percentage difference between compared items");
        recommendations.push("Consider normalizing values for more accurate comparison");
        recommendations.push("Look at relative rankings in addition to absolute values");
      }
      
      // Entity-specific recommendations
      if (isEntityListing) {
        recommendations.push("Filter results to focus on the most relevant entities");
        recommendations.push("Group similar entities to identify patterns");
        recommendations.push("Analyze the distribution of entities across categories");
      }
      
      // General recommendations
      recommendations.push("Consider additional filtering to focus on specific aspects");
      recommendations.push("Look for correlations between different metrics");
      recommendations.push("Segment the data to uncover hidden patterns");
      
      // Limit to top 5 recommendations
      return recommendations.slice(0, 5);
    } catch (err) {
      this.logger.warn(`Error generating recommendations: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return ["Consider additional filtering to focus your analysis"];
    }
  }
}