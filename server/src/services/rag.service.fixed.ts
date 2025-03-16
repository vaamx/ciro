import { db } from '../infrastructure/database';
import { OpenAIService } from './openai.service';
import { createServiceLogger } from '../utils/logger-factory';
import { QdrantService } from './qdrant.service';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ProcessingStage, DataSourceType } from '../types/processing';
import { UniversalDataProcessorService } from './universal-data-processor.service';
import { TextSearchService } from './text-search.service';
import { DataSourceService } from './data-source.service';
import { hybridSearchEngine, QueryOptions } from './query/hybrid-search-engine.service';

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
  error?: string;
  errorMessage?: string;
}

/**
 * RAG (Retrieval Augmented Generation) service
 */
export class RagService {
  private openaiService: OpenAIService;
  private qdrantService: QdrantService;
  private textSearch: TextSearch;
  private readonly logger = createServiceLogger('RagService');

  constructor() {
    this.logger.info('Initializing RAG service');
    this.openaiService = OpenAIService.getInstance();
    this.qdrantService = QdrantService.getInstance();
    
    // Create a proper implementation of TextSearch that uses QdrantService
    const dataSourceService = DataSourceService.getInstance();
    this.textSearch = {
      searchByText: async (query, dataSourceId, options) => {
        try {
          this.logger.info(`Searching for text "${query}" in data source ${dataSourceId}`);
          
          // Normalize collection name
          const collectionName = this.normalizeCollectionName(dataSourceId);
          this.logger.info(`Using collection: ${collectionName}`);
          
          // Generate embeddings for the query
          const embeddings = await this.openaiService.createEmbeddings([query]);
          
          if (!embeddings || embeddings.length === 0) {
            this.logger.error('Failed to create embeddings for search query');
            return [];
          }
          
          // Search the vector database
          const searchResults = await this.qdrantService.search(
            collectionName,
            embeddings[0],
            options?.filter,
            options?.limit || 10  // Increased from 5 to 10 for better recall
          );
          
          this.logger.info(`Found ${searchResults.length} results in ${collectionName}`);
          
          // Map results to a consistent format
          return searchResults.map(result => ({
            id: result.id,
            content: result.payload?.text || result.payload?.content || '',
            metadata: result.payload?.metadata || {},
            score: result.score
          }));
        } catch (error) {
          this.logger.error(`Error in text search: ${error}`);
          return [];
        }
      }
    };
  }

  /**
   * Analyze a query to determine its intent, complexity, and other characteristics
   * @param query The user query to analyze
   * @returns Object with query characteristics
   */
  private analyzeQueryIntent(query: string): {
    intent: string;
    complexity: 'high' | 'medium' | 'low';
    dataVisualization: boolean;
    entities: string[];
    timeFrame?: string;
    countType?: 'entity' | 'document' | 'vcfund' | 'general';
    entityType?: string;
    searchLimit: number;
    similarityThreshold: number;
    isAnalytical: boolean;
  } {
    if (!query) {
      return {
        intent: 'general',
        complexity: 'low',
        dataVisualization: false,
        entities: [],
        searchLimit: 5,
        similarityThreshold: 0.3,
        isAnalytical: false
      };
    }

    const lowerQuery = query.toLowerCase();
    const entities = this.extractEntitiesFromContent(query);
    
    // Check for visualization intent
    const visualizationPatterns = [
      /visual/i, /chart/i, /graph/i, /plot/i, /diagram/i, /dashboard/i,
      /pie chart/i, /bar chart/i, /line graph/i, /histogram/i, /heatmap/i,
      /scatter plot/i, /visualize/i, /display/i, /show me/i
    ];
    const needsVisualization = visualizationPatterns.some(pattern => pattern.test(query));
    
    // Check for summary intent
    const summaryPatterns = [
      /summary/i, /summarize/i, /overview/i, /gist/i, /brief/i, /synopsis/i,
      /outline/i, /recap/i, /key points/i, /main ideas/i, /highlight/i
    ];
    const isSummary = summaryPatterns.some(pattern => pattern.test(query));
    
    // Check for count/statistical intent
    const countPatterns = [
      /how many/i, /count/i, /number of/i, /total/i, /sum/i, /tally/i
    ];
    const isCount = countPatterns.some(pattern => pattern.test(query));
    
    // Check for analytical/statistical intent
    const analyticalPatterns = [
      /analyze/i, /analysis/i, /compare/i, /trend/i, /statistics/i,
      /average/i, /mean/i, /median/i, /mode/i, /unique/i, /distinct/i,
      /percentage/i, /distribution/i, /breakdown/i, 
      /ratio/i, /proportion/i, /correlation/i, /relation/i,
      /minimum/i, /maximum/i, /difference/i, /calculate/i, /computation/i
    ];
    const isAnalytical = analyticalPatterns.some(pattern => pattern.test(query));
    
    // Check for exploration intent
    const explorationPatterns = [
      /find/i, /search/i, /discover/i, /explore/i, /locate/i, /identify/i,
      /are there any/i, /can you find/i, /tell me about/i, /what do you know about/i
    ];
    const isExploration = explorationPatterns.some(pattern => pattern.test(query));
    
    // Determine if this is a VC fund query (specific domain)
    const vcFundPatterns = [
      /vc fund/i, /venture capital/i, /investor/i, /investment/i, /funding/i,
      /portfolio/i, /startup/i, /founder/i, /entrepreneur/i, /angel/i,
      /seed/i, /series [a-z]/i, /round/i, /valuation/i
    ];
    const isVCFundQuery = vcFundPatterns.some(pattern => pattern.test(query)) && 
                          (isCount || isAnalytical);
    
    // Extract time frame
    const timeFramePatterns = [
      { pattern: /last\s+(\d+)\s+(day|week|month|year)s?/i, extract: (match: RegExpMatchArray) => `${match[1]} ${match[2]}s` },
      { pattern: /past\s+(\d+)\s+(day|week|month|year)s?/i, extract: (match: RegExpMatchArray) => `${match[1]} ${match[2]}s` },
      { pattern: /(this|current)\s+(day|week|month|year|quarter)/i, extract: (match: RegExpMatchArray) => `${match[1]} ${match[2]}` },
      { pattern: /(january|february|march|april|may|june|july|august|september|october|november|december)/i, extract: (match: RegExpMatchArray) => match[1] },
      { pattern: /in\s+(\d{4})/i, extract: (match: RegExpMatchArray) => match[1] },
      { pattern: /between\s+(\d{4})\s+and\s+(\d{4})/i, extract: (match: RegExpMatchArray) => `${match[1]} to ${match[2]}` }
    ];
    
    let timeFrame: string | undefined;
    for (const { pattern, extract } of timeFramePatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        timeFrame = extract(match);
        break;
      }
    }
    
    // Determine count type and entity type
    let countType: 'entity' | 'document' | 'vcfund' | 'general' | undefined;
    let entityType: string | undefined;
    
    if (isCount) {
      // First check for document summary counts
      if (this.isDocumentSummaryQuery(query)) {
        countType = 'document';
      } 
      // Then check for VC fund counts
      else if (isVCFundQuery) {
        countType = 'vcfund';
      } 
      // Then check for entity count queries
      else {
        const entityCountResult = this.detectEntityCountQuery(query);
        if (entityCountResult.isEntityCountQuery) {
          countType = 'entity';
          entityType = entityCountResult.entityType;
        } else {
          countType = 'general';
        }
      }
    }
    
    // Determine complexity
    let complexity: 'high' | 'medium' | 'low' = 'low';
    
    if ((isAnalytical && entities.length > 2) || 
        (needsVisualization && isAnalytical) || 
        (isCount && (timeFrame !== undefined))) {
      complexity = 'high';
    } else if (isAnalytical || needsVisualization || isCount || 
               (isSummary && entities.length > 0)) {
      complexity = 'medium';
    }
    
    // Determine primary intent
    let intent = 'general';
    
    if (isCount) {
      intent = 'count';
    } else if (isAnalytical) {
      intent = 'analysis';
    } else if (isSummary) {
      intent = 'summary';
    } else if (isExploration) {
      intent = 'exploration';
    }

    // Determine search parameters based on query intent
    let searchLimit = 5;
    let similarityThreshold = 0.3;
    
    if (intent === 'analysis' || intent === 'statistics') {
      searchLimit = 20;
      similarityThreshold = 0.2;
    } else if (intent === 'count') {
      searchLimit = 30;
      similarityThreshold = 0.25;
    } else if (intent === 'summary') {
      searchLimit = 10;
      similarityThreshold = 0.3;
    } else if (complexity === 'high') {
      searchLimit = 15;
      similarityThreshold = 0.25;
    }
    
    return {
      intent,
      complexity,
      dataVisualization: needsVisualization,
      entities,
      timeFrame,
      countType,
      entityType,
      searchLimit,
      similarityThreshold,
      isAnalytical
    };
  }

  /**
   * Process a query against specified data sources
   * Streamlined implementation that focuses on reliable retrieval
   * 
   * @param query User query string
   * @param dataSourceIds Array of data source IDs to search against
   * @param sessionId Optional session ID for conversation context
   * @param maxHistoryMessages Max number of previous messages to include
   */
  async processQuery(
    query: string, 
    dataSourceIds: string[] | number[],
    sessionId?: string,
    maxHistoryMessages: number = 5
  ): Promise<{
    sources: any[];
    content: string;
    model?: string;
    metadata: RagResponseMetadata;
  }> {
    const startTime = Date.now();
    this.logger.info(`Processing query: "${query}" for data sources: ${dataSourceIds.join(', ')}`);
    
    // Default metadata structure
    const metadata: RagResponseMetadata = {
      processingTime: 0,
      model: this.selectAppropriateModel(query),  // Use the appropriate model
      collectionNames: [],
      dataSourceIds: dataSourceIds.map(id => String(id)),
      dataSourceType: 'qdrant',
      isQdrantResponse: true,
      useEnhancedVisualization: true,
      hasVisualization: true
    };
    
    try {
      // Convert all dataSourceIds to strings for consistency
      const normalizedDataSourceIds = dataSourceIds.map(id => String(id));
      
      if (!query || !query.trim()) {
        return this.createErrorResponse(
          'Please provide a valid query.',
          'empty_query', 
          startTime,
          normalizedDataSourceIds
        );
      }
      
      if (normalizedDataSourceIds.length === 0) {
        return this.createErrorResponse(
          'No data sources specified. Please select one or more data sources.',
          'no_data_sources',
          startTime,
          []
        );
      }
      
      // PHASE 1: RETRIEVAL - Get documents from all data sources
      const retrievalResults = await this.retrieveDocumentsFromAllSources(
        query,
        normalizedDataSourceIds
      );
      
      const { documents, collectionNames } = retrievalResults;
      
      // Update metadata with collection information
      metadata.collectionNames = collectionNames;
      
      // If no documents found, return informative response
      if (documents.length === 0) {
        return this.createErrorResponse(
          'I couldn\'t find any relevant information to answer your question. Please try rephrasing or selecting a different data source.',
          'no_documents_found',
          startTime,
          normalizedDataSourceIds
        );
      }
      
      // PHASE 2: GENERATION - Create a response using the retrieved documents
      const { content, model } = await this.generateResponse(query, documents);
      
      // Update metadata
      metadata.processingTime = Date.now() - startTime;
      metadata.model = model;
      
      // Format sources for the response
      const sources = documents.map(doc => ({
        id: doc.metadata?.id || `doc-${Math.random().toString(36).substring(2, 9)}`,
        text: doc.content.substring(0, 150) + (doc.content.length > 150 ? '...' : ''),
        score: doc.metadata?.score || 0,
        dataSourceId: doc.metadata?.dataSourceId
      }));
      
      return {
        sources,
        content,
        model,
        metadata
      };
    } catch (error) {
      return this.createErrorResponse(
        `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        'processing_error',
        startTime,
        dataSourceIds.map(id => String(id)),
        error
      );
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
    if (error) {
      this.logger.error(`Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error.stack) {
        this.logger.debug(`Stack trace: ${error.stack}`);
      }
    }
    
    // Get the appropriate model for the error response
    const model = this.selectAppropriateModel('');
    
    return {
      sources: [],
      content: message,
      model: model,
      metadata: {
        processingTime: Date.now() - startTime,
        model: model,
        collectionNames: [],
        dataSourceIds: dataSourceIds,
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
      const startTime = Date.now();
      this.logger.info(`Retrieving documents for query: "${query}" from ${dataSourceIds.length} sources`);

      // Check for analytical query to adjust search parameters
      const isAnalytical = this.isAnalyticalQuery(query);
      const isSnowflakeQuery = query.toLowerCase().includes('snowflake') || 
                               query.toLowerCase().includes('database') || 
                               query.toLowerCase().includes('table') ||
                               query.toLowerCase().includes('sql') ||
                               query.toLowerCase().includes('data');
      
      // Enhanced document retrieval with multiple strategies
      let allDocuments: any[] = [];
      const collectionNames: string[] = [];

      // For each data source
      for (const dataSourceId of dataSourceIds) {
        try {
          // Find the appropriate collection name
          const normalizedId = this.normalizeCollectionName(dataSourceId);
          const collectionName = await this.findCorrectCollectionName(dataSourceId) || normalizedId;
          
          if (collectionName) {
            collectionNames.push(collectionName);
            
            // Detect if this is likely a Snowflake collection
            const isSnowflakeCollection = collectionName.includes('snowflake') || 
                                         collectionName.includes('diana');
            
            // Customize search parameters based on query and collection type
            let searchLimit = 5;
            if (isSnowflakeCollection || isSnowflakeQuery) {
              searchLimit = 20; // Use a higher limit for Snowflake collections to capture more table data
            }
            if (isAnalytical) {
              searchLimit = 15; // Use higher limit for analytical queries
            }
            
            // Generate embeddings for the query
            const embeddings = await this.openaiService.createEmbeddings([query]);

            if (embeddings && embeddings.length > 0) {
              // Search the vector database
              let searchResults = await this.qdrantService.search(
                collectionName,
                embeddings[0],
                undefined,
                searchLimit  // Use the customized search limit
              );
              
              this.logger.info(`Found ${searchResults.length} results in collection ${collectionName}`);
              
              if (searchResults.length === 0 && (isSnowflakeCollection || isSnowflakeQuery)) {
                // For Snowflake data, try a more permissive search with text
                this.logger.info(`Performing more permissive search for Snowflake data in ${collectionName}`);
                
                // Modified query for better Snowflake data matching
                const enhancedQuery = this.enhanceQueryForStructuredData(query);
                if (enhancedQuery !== query) {
                  const enhancedEmbeddings = await this.openaiService.createEmbeddings([enhancedQuery]);
                  if (enhancedEmbeddings && enhancedEmbeddings.length > 0) {
                    searchResults = await this.qdrantService.search(
                      collectionName,
                      enhancedEmbeddings[0],
                      undefined,
                      30 // Even higher limit for enhanced search
                    );
                    this.logger.info(`Enhanced search found ${searchResults.length} results`);
                  }
                }
              }
              
              // Map results to a consistent format
              const documents = searchResults.map(result => ({
                id: result.id,
                content: result.payload?.text || result.payload?.content || '',
                metadata: {
                  ...result.payload?.metadata,
                  score: result.score,
                  dataSourceId,
                  collectionName
                }
              }));
              
              // Add to all documents
              allDocuments = [...allDocuments, ...documents];
            }
          }
        } catch (error) {
          this.logger.error(`Error retrieving documents for data source ${dataSourceId}: ${error}`);
        }
      }

      // Deduplicate documents
      const dedupedDocuments = this.deduplicateDocuments(allDocuments);
      this.logger.info(`Retrieved ${allDocuments.length} total documents, ${dedupedDocuments.length} after deduplication`);

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
    // Take top documents based on length
    // For shorter documents, we can include more within token limits
    const effectiveDocuments = documents.slice(0, 
      documents.length > 0 && documents[0].content.length > 1000 ? 3 : 5
    );
    
    // Prepare document context
    const context = effectiveDocuments
      .map(doc => doc.content)
      .join('\n\n---\n\n');
    
    // Set up system prompt
    const systemPrompt = `You are an AI assistant providing accurate, helpful answers based on the retrieved information.
Answer the user's question using ONLY the provided information. If you cannot answer the question based on the provided information, say so clearly.
Format your response using markdown where appropriate. Include relevant details and explain your reasoning step by step.`;

    // Set up the user prompt
    const userPrompt = `I need information about the following question:
${query}

Here is the relevant information:
${context}

Please provide a detailed answer based only on this information. If the information doesn't contain what I need, please say so clearly.`;

    // Default model - Using defaultModel from OpenAIService to be consistent
    const model = this.selectAppropriateModel(query) || 'o3-mini';
    
    try {
      // Generate the response
      const response = await this.openaiService.generateChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        { model: model }
      );
      
      // Ensure we have a string response
      let content: string;
      if (typeof response === 'string') {
        content = response;
      } else {
        // Cast response to any to safely access properties
        const typedResponse = response as any;
        if (typedResponse.choices && typedResponse.choices.length > 0 && typedResponse.choices[0].message?.content) {
          content = typedResponse.choices[0].message.content;
        } else {
          content = JSON.stringify(response);
        }
      }
      
      return { content, model };
    } catch (error) {
      this.logger.error(`Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { 
        content: `I encountered an error while processing your request. Please try again.`,
        model
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
   * Process a general query with universal data transformation
   * This provides a consistent approach for handling any data type
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
    
    // Enhanced retrieval parameters - more generous for general queries
    // to ensure we have enough context for intelligent processing
    const { searchLimit, similarityThreshold } = queryAnalysis;
    
    try {
      // Prepare sources array
      let allSources = [];
      
      // Process each data source with enhanced retrieval parameters
      for (const sourceId of dataSourceIds) {
        try {
          // Convert the collection name to the proper format
          const collectionName = this.normalizeCollectionName(sourceId.toString());
          
          this.logger.info(`Processing query against collection: ${collectionName}`);
          
          // Ensure the collection exists
          const collectionExists = await this.ensureCollectionExists(collectionName);
          if (!collectionExists) {
            this.logger.warn(`Skipping non-existent collection: ${collectionName}`);
            continue;
          }
          
          // Generate embedding for query
          const embedding = await this.openaiService.createEmbeddings([query]);
          this.logger.info(`Generated embedding for query, vector length: ${embedding ? embedding[0].length : 'error'}`);
          
          // Search for relevant documents with improved parameters
          const searchResults = await this.qdrantService.search(
            collectionName,
            embedding[0],
            undefined,
            searchLimit
          );
          
          this.logger.info(`Search returned ${searchResults.length} results from collection ${collectionName}`);
          
          // Format search results
          const sources = searchResults.map(result => ({
            id: result.id,
            content: result.payload?.text || result.payload?.content || '',
            metadata: result.payload?.metadata || {},
            similarity: result.score,
            sourceId: sourceId.toString(),
            sourceName: `Source ${sourceId}`
          }));
          
          allSources = [...allSources, ...sources];
        } catch (error) {
          this.logger.error(`Error searching collection for source ${sourceId}:`, error);
        }
      }
      
      this.logger.info(`Total sources found across all collections: ${allSources.length}`);
      
      // Enhanced filtering that keeps more potentially relevant content
      // but still removes duplicate or low-relevance content
      let sources = await this.filterRelevantSourcesEnhanced(query, this.deduplicateDocuments(allSources));
      
      this.logger.info(`After filtering with similarity threshold 0.3: ${sources.length} sources remain`);
      
      // If no sources pass the filter, try again with a lower threshold
      if (sources.length === 0 && allSources.length > 0) {
        this.logger.info(`No sources passed similarity filter. Lowering threshold to 0.2 and trying again...`);
        
        // Override the threshold with a lower value for this specific query
        const originalThreshold = 0.3; // The current threshold we're using in filterRelevantSourcesEnhanced
        
        // Temporarily modify the filter function to use a lower threshold
        const filterWithLowerThreshold = async (q: string, srcs: any[]): Promise<any[]> => {
          try {
            const texts = [q, ...srcs.map(s => s.content || '')];
            const embeddings = await this.openaiService.createEmbeddings(texts);
            
            if (!embeddings || embeddings.length < texts.length) {
              return srcs.slice(0, 5);
            }
            
            const queryEmbedding = embeddings[0];
            const scoredSources = [];
            
            for (let i = 0; i < srcs.length; i++) {
              const sourceEmbedding = embeddings[i + 1];
              const similarity = this.calculateCosineSimilarity(queryEmbedding, sourceEmbedding);
              
              // Use a much lower threshold as a fallback
              if (similarity > 0.2) {
                scoredSources.push({
                  ...srcs[i],
                  similarity
                });
              }
            }
            
            const sorted = scoredSources.sort((a, b) => b.similarity - a.similarity);
            return sorted.slice(0, Math.max(5, Math.ceil(sorted.length * 0.5)));
          } catch (error) {
            this.logger.error(`Error in lowered threshold filtering: ${error}`);
            return srcs.slice(0, 5);
          }
        };
        
        sources = await filterWithLowerThreshold(query, this.deduplicateDocuments(allSources));
        this.logger.info(`After filtering with lower threshold 0.2: ${sources.length} sources remain`);
      }
      
      if (sources.length === 0) {
        this.logger.warn(`No relevant sources found for query: "${query}"`);
        return {
          sources: [],
          content: "I couldn't find relevant information to answer your question. Please try rephrasing your query or specifying more details.",
          analysis: {
            steps: ["Searched for relevant information", "No sufficiently relevant information found"],
            summary: "No relevant data found to answer your query"
          },
          metadata: {
            contentType: 'text',
            processingType: 'universal',
            foundSources: 0
          }
        };
      }
      
      // Analyze the retrieved sources to determine the best presentation format
      const contentInfo = this.analyzeSourceContent(sources);
      
      // Extract the combined content for processing
      const combinedContent = sources.map(s => s.content).join('\n\n');
      
      // Select an appropriate model based on complexity
      const model = this.selectModelForAnalysis(queryAnalysis.complexity);
      
      // Generate a structured response with universal parsing strategies
      // This ensures consistent output formatting regardless of data type
      const structuredResponse = await this.generateStructuredResponse(
        combinedContent,
        [],
        [],
        [],
        []
      );
      
      return {
        sources: allSources,
        content: structuredResponse,
        model,
        analysis: {
          steps: [],
          summary: structuredResponse
        },
        metadata: {
          contentType: contentInfo.contentType,
          structure: contentInfo.structure,
          processingType: 'universal',
          foundSources: sources.length,
          ...contentInfo.metadata
        }
      };
    } catch (error) {
      this.logger.error(`Error in universal query processing: ${error.message}`);
      return this.generateFallbackResponse(query, dataSourceIds);
    }
  }

  /**
   * Enhanced filtering to keep more potentially relevant content
   * This is more permissive than the standard filterRelevantSources
   */
  private async filterRelevantSourcesEnhanced(query: string, sources: any[]): Promise<any[]> {
    if (!sources.length) return [];
    
    try {
      // Get embeddings for the query and sources
      const texts = [query, ...sources.map(s => s.content || '')];
      const embeddings = await this.openaiService.createEmbeddings(texts);
      
      if (!embeddings || embeddings.length < texts.length) {
        return sources.slice(0, 5); // Fallback to top 5 if embeddings fail
      }
      
      // The first embedding is for the query
      const queryEmbedding = embeddings[0];
      
      // Calculate similarity between query and each source
      const scoredSources = [];
      for (let i = 0; i < sources.length; i++) {
        const sourceEmbedding = embeddings[i + 1];
        const similarity = this.calculateCosineSimilarity(queryEmbedding, sourceEmbedding);
        
        // Use a more permissive threshold (0.3) for initial filtering
        // Lowered from 0.5 to 0.3 to allow more potentially relevant content
        if (similarity > 0.3) {
          scoredSources.push({
            ...sources[i],
            similarity
          });
        }
      }
      
      // Sort by similarity and take top results
      // but ensure we have at least 3 sources if available
      const sorted = scoredSources.sort((a, b) => b.similarity - a.similarity);
      const minSources = Math.min(3, sorted.length);
      const maxSources = Math.min(10, sorted.length);
      
      // Take at least minSources, but if there are high-similarity sources (>0.65),
      // include all of them up to maxSources
      let threshold = 0.65;
      let filteredSources = sorted.filter(s => s.similarity >= threshold);
      
      // If we have too few sources with high similarity, lower the threshold
      while (filteredSources.length < minSources && threshold > 0.5) {
        threshold -= 0.05;
        filteredSources = sorted.filter(s => s.similarity >= threshold);
      }
      
      // Cap at maxSources
      return filteredSources.slice(0, maxSources);
    } catch (error) {
      this.logger.error(`Error filtering relevant sources: ${error.message}`);
      return sources.slice(0, 5); // Fallback to top 5 if filtering fails
    }
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
   * Generate a structured response template for any response type
   * This ensures consistent formatting across all responses, regardless of query type
   * @param content The main content of the response
   * @param detectedTables Any tables detected in the content
   * @param analysisSteps Step-by-step breakdown of the analysis
   * @param insights Key insights extracted from the analysis
   * @param nextSteps Suggested next steps or actions
   */
  private generateStructuredResponse(
    content: string,
    detectedTables: string[] = [],
    analysisSteps: string[] = [],
    insights: string[] = [],
    nextSteps: string[] = []
  ): string {
    // First, check if the content already contains tables in markdown format
    const hasMarkdownTables = content.includes('|') && content.includes('\n|');
    
    // Process any detected tables that aren't already in markdown format
    const formattedTables = detectedTables.map(tableContent => {
      // If the table is already in markdown format, return as is
      if (tableContent.includes('|') && tableContent.includes('\n|')) {
        return tableContent;
      }
      
      // Try to parse as JSON
      try {
        const jsonData = JSON.parse(tableContent);
        if (Array.isArray(jsonData)) {
          // Format as markdown table
          return this.convertDataToMarkdownTable(jsonData);
        } else {
          // Convert single object to array for table formatting
          return this.convertDataToMarkdownTable([jsonData]);
        }
      } catch (e) {
        // Not valid JSON, try to parse as CSV
        const rows = tableContent.split('\n').map(row => row.split(','));
        if (rows.length > 1) {
          return this.formatSimpleTableData(rows);
        }
      }
      
      // If we can't parse it, return as-is
      return tableContent;
    });
    
    // If no explicit tables were provided but we detected markdown tables in the content,
    // extract them and add them to our formatted tables
    if (hasMarkdownTables && detectedTables.length === 0) {
      const extractedTables = this.extractMarkdownTables(content);
      formattedTables.push(...extractedTables);
      
      // Remove the tables from the main content to avoid duplication
      const contentWithoutTables = this.removeMarkdownTables(content);
      content = contentWithoutTables;
    }
    
    // Build the structured response
    let structuredResponse = '';
    
    // Add the main content
    structuredResponse += content.trim();
    
    // Add detected tables section if there are tables
    if (formattedTables.length > 0) {
      structuredResponse += '\n\n## Tables\n\n';
      formattedTables.forEach((table, index) => {
        structuredResponse += `### Table ${index + 1}\n${table}\n\n`;
      });
    }
    
    // Add analysis steps if provided
    if (analysisSteps.length > 0) {
      structuredResponse += '\n\n## Analysis Steps\n\n';
      analysisSteps.forEach((step, index) => {
        structuredResponse += `${index + 1}. ${step}\n`;
      });
    }
    
    // Add insights if provided
    if (insights.length > 0) {
      structuredResponse += '\n\n## Insights\n\n';
      insights.forEach(insight => {
        structuredResponse += `- ${insight}\n`;
      });
    }
    
    // Add next steps if provided
    if (nextSteps.length > 0) {
      structuredResponse += '\n\n## Next Steps\n\n';
      nextSteps.forEach(step => {
        structuredResponse += `- ${step}\n`;
      });
    }
    
    return structuredResponse;
  }
  
  /**
   * Convert data to markdown table format
   */
  private convertDataToMarkdownTable(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }
    
    // Extract headers from first object
    const headers = Object.keys(data[0]);
    
    // Build header row
    let markdownTable = '| ' + headers.join(' | ') + ' |\n';
    
    // Build separator row
    markdownTable += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    // Build data rows
    data.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'object') {
          return JSON.stringify(value);
        } else {
          return String(value);
        }
      });
      markdownTable += '| ' + row.join(' | ') + ' |\n';
    });
    
    return markdownTable;
  }

  /**
   * Format simple table data (2D array) into markdown
   */
  private formatSimpleTableData(data: any[][]): string {
    if (!Array.isArray(data) || data.length === 0 || !Array.isArray(data[0])) {
      return '';
    }
    
    // Use first row as headers
    const headers = data[0];
    
    // Build header row
    let markdownTable = '| ' + headers.join(' | ') + ' |\n';
    
    // Build separator row
    markdownTable += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    // Add data rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      markdownTable += '| ' + row.join(' | ') + ' |\n';
    }
    
    return markdownTable;
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
   * Check if a query is analytical in nature
   */
  private isAnalyticalQuery(query: string): boolean {
    if (!query) return false;
    
    // Check if it's a document summary query
    if (this.isDocumentSummaryQuery(query)) {
      this.logger.info(`Detected document summary query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
      return true;
    }
    
    // Check if it's an entity count query
    const { isEntityCountQuery } = this.detectEntityCountQuery(query);
    if (isEntityCountQuery) {
      return true;
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Check for analytical keywords and phrases
    const analyticalKeywords = [
      'analyze', 'analysis', 'compare', 'trend', 'statistics',
      'average', 'mean', 'median', 'mode', 'unique', 'distinct',
      'count', 'total', 'sum', 'how many', 'number of',
      'percentage', 'distribution', 'breakdown', 'summarize', 'summary',
      'list all', 'report on', 'what is the', 'give me all', 'show me all',
      'overview', 'insights', 'metrics', 'patterns', 'findings',
      'minimum', 'maximum', 'difference between', 'ratio', 'proportion',
      'calculate', 'computation', 'quantify', 'estimate', 'evaluate',
      'sales', 'revenue', 'profit', 'region', 'by region', 'per region', 
      'customer', 'product', 'performance', 'growth', 'decline',
      'highest', 'lowest', 'best', 'worst', 'top', 'bottom'
    ];
    
    // Check for question types
    const questionPatterns = [
      /how many/i, /what is the total/i, /what percentage/i, 
      /what is the average/i, /what is the distribution/i,
      /what are all the/i, /list all the/i, /count the/i,
      /summarize the/i, /give me statistics on/i, /give me an analysis of/i,
      /how much/i, /tell me about/i, /describe the/i,
      /what are the .* per/i, /what are the .* by/i, /what is the .* per/i, /what is the .* by/i,
      /show .* by/i, /show .* per/i, /total .* by/i, /total .* per/i
    ];
    
    // Check if query contains analytical keywords
    const hasAnalyticalKeyword = analyticalKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );
    
    // Check if query matches question patterns
    const matchesQuestionPattern = questionPatterns.some(pattern => 
      pattern.test(lowerQuery)
    );
    
    // Special case for "sales per region" or "sales by region" type queries
    const salesRegionPattern = /(sales|revenue|profit).*(per|by).*(region|country|territory|area|market|location)/i;
    const isSalesRegionQuery = salesRegionPattern.test(lowerQuery);
    
    // If it's specifically a sales region query, always classify as analytical
    if (isSalesRegionQuery) {
      return true;
    }
    
    // General analytical query detection
    return hasAnalyticalKeyword || matchesQuestionPattern;
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
    analysis?: {
      steps: string[];
      summary: string;
    };
  }> {
    // Generate a helpful response that acknowledges the system couldn't find relevant data
    const modelName = 'o3-mini' as ModelName;
    
    try {
      // Try to get some context about the data sources to provide a more helpful response
      const dataSourcesInfo = await this.getDataSourcesInfo(dataSourceIds);
      const dataSourcesContext = dataSourcesInfo.length > 0 
        ? `I see you're asking about data from sources: ${dataSourcesInfo.map(ds => ds.name).join(', ')}. ` 
        : '';
      
      const prompt = `You need to respond to this query: "${query}" 
      
The system couldn't find specific data in the knowledge base to answer this directly. 
${dataSourcesContext}

Please provide a helpful response that:
1. Acknowledges the lack of specific data
2. Offers general information about the topic if possible
3. Suggests how the user might rephrase their question or what information might help
4. Uses a friendly, helpful tone

Format your response with a multi-step analysis approach even though you don't have specific data.`;
      
      // Generate a helpful response
      let content: string;
      try {
        const completion = await this.openaiService.generateChatCompletion([
          { role: 'user', content: prompt }
        ], {
          model: modelName as any, // Fix type error with any assertion
          temperature: 0.5
        });
        
        // Extract content using a defensive approach, with ts-expect-error to bypass type checking
        // @ts-ignore - Runtime check for choices property
        content = completion?.choices?.[0]?.message?.content || '';
        
        if (!content) {
          content = "I'm sorry, but I couldn't find specific information to answer your question. Could you try rephrasing your query or providing more details about what you're looking for?";
        }
      } catch (error) {
        this.logger.error(`Error generating completion: ${error.message}`);
        content = "I'm sorry, but I couldn't find specific information to answer your question. Could you try rephrasing your query or providing more details about what you're looking for?";
      }
      
      // Create a simple analysis structure even for fallback responses
      const steps = [
        "Step 1: Attempted to search for relevant information",
        "Step 2: No specific data found in the connected data sources", 
        "Step 3: Generated a general response based on the query"
      ];
      
      return {
        sources: [],
        content: content,
        model: modelName,
        analysis: {
          steps: steps,
          summary: "No specific data found to answer this query directly."
        }
      };
    } catch (secondaryError) {
      // If even the fallback response generation fails, return an absolute minimal response
      this.logger.error(`Error generating fallback response: ${secondaryError.message}`);
      return {
        sources: [],
        content: "I apologize, but I encountered an issue while processing your request. Please try again or rephrase your question.",
        model: modelName,
        analysis: {
          steps: ["Attempted to process query but encountered an error"],
          summary: "Error occurred during processing"
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
    const uniqueDocs: any[] = [];
    const contentFingerprints = new Set<string>();
    
    for (const doc of documents) {
      // Create a fingerprint of the first 100 chars + length to identify similar docs
      const content = doc.content || doc.pageContent || '';
      const fingerprint = `${content.substring(0, 100)}-${content.length}`;
      
      if (!contentFingerprints.has(fingerprint)) {
        contentFingerprints.add(fingerprint);
        uniqueDocs.push(doc);
      }
    }
    
    return uniqueDocs;
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
   * Select the appropriate model based on query complexity
   * @param complexity The complexity level of the query
   * @returns The model name to use
   */
  private selectModelForAnalysis(complexity: 'high' | 'medium' | 'low'): string {
    switch (complexity) {
      case 'high':
        return 'o3-mini';
      case 'medium':
        return 'o3-mini';
      case 'low':
      default:
        return 'o3-mini';
    }
  }

  /**
   * Process query with a focus on analysis and advanced analytics
   * @param query The user query
   * @param dataSourceIds Array of data source IDs to query
   * @param queryAnalysis The analyzed query information
   * @returns Object with sources, content, and model information
   */
  private async processAnalyticalContent(
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
    metadata?: RagResponseMetadata;
  }> {
    // Get data source info first
    const dataSources = await this.getDataSourcesInfo(dataSourceIds);
    
    // Check if any sources are Excel
    const excelSources = dataSources.filter(ds => 
      this.detectDataSourceType(ds.name) === DataSourceType.EXCEL || 
      ds.type === 'excel' || 
      ds.type === 'csv'
    );
    
    this.logger.info(`Found ${excelSources.length} Excel sources for analytical processing`);
    
    // Retrieve documents from all relevant sources
    const allDocuments = [];
    for (const dataSourceId of dataSourceIds) {
      try {
        const collection = this.normalizeCollectionName(String(dataSourceId));
        
        // For Excel, we want to retrieve more documents to get more complete data
        const isExcel = excelSources.some(es => String(es.id) === String(dataSourceId));
        const limit = isExcel ? 50 : 20; // Retrieve more documents for Excel sources
        
        // Use a less restrictive search to get more documents from Excel sources
        let docs = [];
        if (isExcel) {
          // For Excel data, try to get a broad sample first
          this.logger.info(`Retrieving broad sample of Excel data from ${collection}`);
          const sampleDocs = await this.qdrantService.getCollectionSample(collection, limit);
          
          if (sampleDocs && sampleDocs.length > 0) {
            docs = sampleDocs.map(doc => ({
              content: doc.payload?.text || doc.payload?.content || '',
              metadata: {
                ...doc.payload?.metadata,
                id: doc.id,
                score: 1.0,
                dataSourceId,
                dataSourceType: 'excel'
              }
            }));
          }
        }
        
        // If we didn't get documents from sampling or it's not Excel, use normal search
        if (docs.length === 0) {
          // Generate embeddings for the query
          const embeddings = await this.openaiService.createEmbeddings([query]);
          
          if (!embeddings || embeddings.length === 0) {
            this.logger.error(`Failed to create embeddings for query: ${query}`);
            continue;
          }
          
          // Search the vector database
          const results = await this.qdrantService.search(
            collection,
            embeddings[0],
            null,  // No filter
            limit
          );
          
          // Map results to standard document format
          docs = results.map(result => ({
            content: result.payload?.text || result.payload?.content || '',
            metadata: {
              ...result.payload?.metadata,
              id: result.id,
              score: result.score,
              dataSourceId,
              dataSourceType: isExcel ? 'excel' : 'text'
            }
          }));
        }
        
        this.logger.info(`Retrieved ${docs.length} documents from ${collection}`);
        allDocuments.push(...docs);
      } catch (error) {
        this.logger.error(`Error retrieving documents from ${dataSourceId}: ${error}`);
      }
    }
    
    // If no documents found, generate a fallback response
    if (allDocuments.length === 0) {
      this.logger.warn(`No documents found for analytical processing, using fallback`);
      return this.generateFallbackResponse(query, dataSourceIds);
    }
    
    // Extract table data from content where possible
    const tablesInDocuments = [];
    for (const doc of allDocuments) {
      const tablesInDoc = this.extractMarkdownTables(doc.content);
      if (tablesInDoc.length > 0) {
        tablesInDocuments.push(...tablesInDoc);
      }
    }
    
    // Log information about extracted tables
    this.logger.info(`Extracted ${tablesInDocuments.length} tables from documents`);
    
    // Create a system prompt that emphasizes Excel data analysis
    let systemPrompt = `You are an expert data analyst specializing in Excel data analysis. 
    
Your task is to analyze the following data from Excel and provide a detailed, step-by-step analysis that addresses the user's query.

The analysis should:
1. Start with a brief overview of what the data represents
2. Identify the relevant metrics, trends, or patterns in the data
3. Perform calculations as needed (sums, averages, percentages, etc.)
4. Present your findings in a clear, organized manner
5. Use markdown formatting for better readability, especially for tables

Present your analysis as a structured, step-by-step process with numbered steps. Each step should have a clear purpose and explanation.

If appropriate, include insights about:
- Key metrics and their significance
- Notable trends or patterns
- Comparative analysis between different data points
- Business implications of the findings

For tabular data, use proper markdown table format. If creating charts or visualizations is mentioned in the query, describe how the data would be visualized.

Include a summary of your findings at the end.`;

    // Select appropriate model for complex analysis
    const modelToUse = this.selectModelForAnalysis(queryAnalysis.complexity);
    
    // Combine content from all documents into a single context
    let combinedContent = allDocuments
      .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
      .map(doc => doc.content)
      .join('\n\n');
    
    // Add any extracted tables at the beginning for better visibility
    if (tablesInDocuments.length > 0) {
      combinedContent = tablesInDocuments.join('\n\n') + '\n\n' + combinedContent;
    }
    
    // Trim content if too long for context window
    const maxContentLength = 28000; // Leave room for other context
    if (combinedContent.length > maxContentLength) {
      combinedContent = combinedContent.substring(0, maxContentLength) + 
        '\n\n[Content truncated due to length constraints]';
    }
    
    try {
      // Prepare messages for the chat completion
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${query}\n\nHere is the Excel data to analyze:\n\n${combinedContent}` }
      ];
      
      // Generate response
      const response = await this.openaiService.generateChatCompletion(messages, {
        model: modelToUse as any, // Fix type error with any assertion
        temperature: 0.2 // Lower temperature for more factual responses
      });
      
      // Extract response content
      let responseContent = '';
      if (typeof response === 'string') {
        responseContent = response;
      } else if (response && 'choices' in response && 
                 Array.isArray(response.choices) && 
                 response.choices[0] && 
                 response.choices[0].message) {
        responseContent = response.choices[0].message.content || '';
      }
      
      // Extract steps from the response
      const analysisSteps = responseContent
        .split(/\n\s*\d+\.\s+/g) // Split by numbered list items
        .filter(step => step.trim().length > 10) // Filter out empty or very short steps
        .map(step => step.trim());
        
      // Extract insights
      const insights = this.extractInsightsFromContent(responseContent);
      
      // Prepare standard metadata
      const startTime = Date.now(); // Add missing startTime declaration
      const allCollections = dataSourceIds.map(id => this.normalizeCollectionName(String(id))); // Add missing allCollections declaration
      const metadata: RagResponseMetadata = {
        processingTime: Date.now() - startTime,
        model: modelToUse,
        collectionNames: allCollections,
        dataSourceIds: Array.from(dataSourceIds.map(id => String(id))),
        dataSourceType: 'excel',
        isQdrantResponse: true,
        useEnhancedVisualization: true,
        hasVisualization: queryAnalysis.dataVisualization
      };
      
      return {
        sources: allDocuments,
        content: responseContent,
        model: modelToUse,
        analysis: {
          steps: analysisSteps,
          summary: insights.join(' ')
        },
        metadata
      };
    } catch (error) {
      this.logger.error(`Error in analytical processing: ${error}`);
      return {
        sources: allDocuments,
        content: `I encountered an error while analyzing the data: ${error.message}`,
        model: modelToUse
      };
    }
  }

  /**
   * List available data sources for an organization with their collection status
   * @param organizationId Organization ID to filter data sources
   * @returns Array of data sources with collection status
   */
  async listDataSources(organizationId: string): Promise<Array<{
    id: string | number;
    name: string;
    type: string;
    collectionName: string;
    hasCollection: boolean;
  }>> {
    try {
      this.logger.info(`Listing data sources for organization ${organizationId}`);
      
      // Get data sources from database
      const dataSources = await db('data_sources')
        .where('organization_id', organizationId)
        .select('id', 'name', 'type', 'status');
      
      if (!dataSources || dataSources.length === 0) {
        this.logger.info(`No data sources found for organization ${organizationId}`);
        return [];
      }
      
      this.logger.info(`Found ${dataSources.length} data sources for organization ${organizationId}`);
      
      // Get available Qdrant collections
      let availableCollections: string[] = [];
      try {
        availableCollections = await this.qdrantService.listCollections();
        this.logger.info(`Found ${availableCollections.length} available collections`);
      } catch (error) {
        this.logger.error(`Error listing collections: ${error.message}`);
        // Continue with empty collections list instead of failing
        availableCollections = [];
      }
      
      // Check collection status for each data source
      const result = await Promise.all(dataSources.map(async (source) => {
        // Normalize collection name for this data source
        const collectionName = this.normalizeCollectionName(source.id.toString());
        
        // Check if collection exists
        const hasCollection = availableCollections.includes(collectionName);
        
        return {
          id: source.id,
          name: source.name,
          type: source.type,
          collectionName,
          hasCollection
        };
      }));
      
      return result;
    } catch (error) {
      this.logger.error(`Error listing data sources: ${error.message}`);
      // Return empty array instead of throwing to prevent 500 errors
      return [];
    }
  }

  /**
   * Get the status of the RAG service
   * @returns Status object with service information
   */
  async getStatus(): Promise<{
    status: string;
    openaiService: boolean;
    qdrantService: boolean;
    collections: string[];
    timestamp: number;
  }> {
    const timestamp = Date.now();
    let collections: string[] = [];
    
    try {
      // Check if Qdrant service is accessible
      if (this.qdrantService) {
        try {
          // Try to list collections
          const response = await fetch(`${process.env.QDRANT_URL || 'http://localhost:6333'}/collections`);
          if (response.ok) {
            const data = await response.json() as {
              result?: {
                collections?: Array<{ name: string }>;
              };
              status?: string;
            };
            
            if (data.result?.collections) {
              collections = data.result.collections.map((c) => c.name);
            }
          }
        } catch (error) {
          this.logger.error(`Error getting collections: ${error}`);
        }
      }
      
      return {
        status: 'operational',
        openaiService: !!this.openaiService,
        qdrantService: !!this.qdrantService,
        collections,
        timestamp
      };
    } catch (error) {
      this.logger.error(`Error in getStatus: ${error}`);
      return {
        status: 'error',
        openaiService: !!this.openaiService,
        qdrantService: !!this.qdrantService,
        collections: [],
        timestamp
      };
    }
  }

  /**
   * Extract tables from retrieved documents
   */
  private extractTablesFromDocuments(documents: any[]): any[] {
    const allTables: any[] = [];
    
    for (const doc of documents) {
      // Check for markdown tables
      if (typeof doc.content === 'string') {
        const tables = this.extractTablesFromMarkdown(doc.content);
        if (tables.length > 0) {
          allTables.push(...tables);
        }
      }
      
      // Check for structured data in metadata
      if (doc.metadata?.data && Array.isArray(doc.metadata.data)) {
        allTables.push(...doc.metadata.data);
      }
    }
    
    return allTables;
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
      // Generate a standardized collection name format
      const standardName = `datasource_${dataSourceId}`;
      
      // First, check if the standard collection exists
      const exists = await this.qdrantService.collectionExists(standardName);
      if (exists) {
        this.logger.info(`Collection ${standardName} exists - using it directly`);
        return standardName;
      }

      this.logger.info(`Collection ${standardName} not found, looking up data source metadata`);
      
      // Query the database to find the data source's UUID if we're using a numeric ID
      if (!dataSourceId.includes('-') && !isNaN(Number(dataSourceId))) {
        try {
          // Try to find the data source by ID
          const dataSource = await db('data_sources')
            .where('id', Number(dataSourceId))
            .first('metadata');
          
          if (dataSource?.metadata?.id) {
            const uuid = dataSource.metadata.id;
            const uuidCollection = `datasource_${uuid}`;
            
            // Log what we found for debugging
            this.logger.info(`Found UUID ${uuid} for numeric ID ${dataSourceId}`);
            
            // Check if this collection exists
            const uuidExists = await this.qdrantService.collectionExists(uuidCollection);
            if (uuidExists) {
              this.logger.info(`Found UUID-based collection ${uuidCollection} for data source ${dataSourceId}`);
              return uuidCollection;
            } else {
              this.logger.warn(`UUID-based collection ${uuidCollection} does not exist despite finding matching data source`);
            }
          } else {
            this.logger.warn(`Data source with ID ${dataSourceId} found but has no metadata.id`);
          }
        } catch (dbError) {
          this.logger.error(`Error querying database for data source ${dataSourceId}:`, dbError);
        }
      }
      
      // If we have a UUID but no matching datasource_UUID collection, 
      // try to find if there's a corresponding numeric ID collection
      if (dataSourceId.includes('-')) {
        try {
          // Try different ways to find the data source by UUID
          const dataSource = await db('data_sources')
            .whereRaw("CAST(metadata->>'id' AS TEXT) = ?", [dataSourceId])
            .orWhereRaw("metadata::text LIKE ?", [`%${dataSourceId}%`])
            .first('id');
          
          if (dataSource?.id) {
            const numericCollection = `datasource_${dataSource.id}`;
            
            // Check if this collection exists
            const numericExists = await this.qdrantService.collectionExists(numericCollection);
            if (numericExists) {
              this.logger.info(`Found numeric ID collection ${numericCollection} for UUID ${dataSourceId}`);
              return numericCollection;
            } else {
              this.logger.warn(`Numeric ID collection ${numericCollection} does not exist despite finding matching data source`);
            }
          } else {
            this.logger.warn(`Could not find data source with UUID ${dataSourceId}`);
          }
        } catch (dbError) {
          this.logger.error(`Error querying database for UUID ${dataSourceId}:`, dbError);
        }
      }
      
      // As a last resort, try to find any collection that might match this data source
      try {
        const collections = await this.qdrantService.getClient().getCollections();
        if (!collections || !collections.collections) {
          this.logger.error(`Failed to get collections list from Qdrant`);
          return null;
        }
        
        // First try to match against our exact ID (either as a prefix or within the collection name)
        const exactMatches = collections.collections.filter(c => 
          c.name === standardName || 
          c.name.includes(dataSourceId)
        );
        
        if (exactMatches.length > 0) {
          this.logger.info(`Found collection ${exactMatches[0].name} matching data source ${dataSourceId}`);
          return exactMatches[0].name;
        }
        
        // List all available collections for debugging
        this.logger.info(`Available collections: ${collections.collections.map(c => c.name).join(', ')}`);
        
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
  private async retrieveDocuments(query: string, dataSourceIds: string[]): Promise<{
    documents: any[];
    collectionNames: string[];
    dataSourceDescriptions: Record<string, string>;
  }> {
    this.logger.info(`Retrieving documents for query: "${query}" from sources: ${dataSourceIds.join(', ')}`);
    
    const documents: any[] = [];
    const collectionNames: string[] = [];
    const dataSourceDescriptions: Record<string, string> = {};
    
    // Get data source info
    const dataSources = await this.getDataSourcesInfo(dataSourceIds);
    
    // IMMEDIATE FIX FOR EXCEL FILE: Direct mapping for ID 236
    const idToUuidMap: Record<string, string> = {
      '236': 'datasource_c7ef589f-b91a-4180-b5ae-5f89e2aa4ebd', // Excel file
    };
    
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
        const results = await this.qdrantService.search(
          collectionName,
          embeddings[0],
          null,  // No filter
          10     // Limit to 10 results per collection
        );
        
        this.logger.info(`Found ${results.length} results in collection ${collectionName}`);
        
        // Convert to standard document format
        const formattedDocs = results.map(result => ({
          content: result.payload?.text || result.payload?.content || '',
          metadata: {
            ...result.payload?.metadata || {},
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
  }

  /**
   * Generate a response with the given context
   */
  private async generateResponseWithContext(
    query: string,
    documents: any[],
    model: string
  ): Promise<{
    content: string;
    analysis?: {
      steps: string[];
      summary: string;
    };
  }> {
    try {
      // Prepare document context
      const context = documents
        .map(doc => doc.content)
        .join('\n\n---\n\n');
      
      // Set up system prompt
      const systemPrompt = `You are an AI assistant providing accurate, helpful answers based on the retrieved information.
Answer the user's question using ONLY the provided information. If you cannot answer the question based on the provided information, say so clearly.
Analyze the information step by step and provide a structured response. Format your response using markdown where appropriate.`;

      // Set up the user prompt
      const userPrompt = `I need information about the following question:
${query}

Here is the relevant information:
${context}

Please provide a detailed answer based only on this information. If the information doesn't contain what I need, please say so clearly.`;

      // Generate the response and handle the return value properly
      const response = await this.openaiService.generateChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        { model: model }
      );
      
      // Ensure the response is a string
      const content = typeof response === 'string' 
        ? response 
        : JSON.stringify(response);
      
      // Generate structured analysis
      const analysis = await this.generateStructuredAnalysis(query, content);
      
      return { content, analysis };
    } catch (error) {
      this.logger.error(`Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { 
        content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.` 
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
    try {
      if (!content) return [];
      
      // Look for insights patterns in the content
      const insights: string[] = [];
      
      // Pattern 1: Look for sections titled "Insights", "Key Findings", etc.
      const insightSectionMatch = content.match(/(?:Insights|Key Findings|Key Points|Summary|Main Points):\s*([\s\S]+?)(?:(?:\n\n|\n#|\n##)|\z)/i);
      if (insightSectionMatch && insightSectionMatch[1]) {
        // Split by bullet points or numbered items
        const items = insightSectionMatch[1]
          .split(/\n\s*[•\-*]\s*|\n\s*\d+\.\s*/)
          .filter(item => item.trim().length > 0);
        
        if (items.length > 0) {
          insights.push(...items);
        }
      }
      
      // Pattern 2: Look for bullet points throughout the content
      const bulletMatches = content.matchAll(/\n\s*[•\-*]\s*([^\n]+)/g);
      for (const match of bulletMatches) {
        if (match[1] && match[1].trim().length > 0) {
          insights.push(match[1].trim());
        }
      }
      
      // Pattern 3: Look for sentences with insight-related keywords
      const sentences = content.split(/[.!?][\s\n]+/);
      const insightKeywords = ['key', 'important', 'significant', 'notable', 'crucial', 'critical'];
      
      for (const sentence of sentences) {
        for (const keyword of insightKeywords) {
          if (sentence.toLowerCase().includes(keyword) && sentence.length > 30) {
            insights.push(sentence.trim());
            break;
          }
        }
      }
      
      // Deduplicate and limit insights
      return [...new Set(insights)].slice(0, 5);
    } catch (error) {
      this.logger.error(`Error extracting insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Process a query using the hybrid search engine
   */
  async processQueryWithAggregations(
    query: string,
    dataSourceId: number,
    options: QueryOptions = {}
  ): Promise<{ results: any; explanation: string }> {
    this.logger.info(`Processing query with aggregations: ${query} for data source ${dataSourceId}`);
    
    try {
      // Execute the query through the hybrid search engine
      const queryResult = await hybridSearchEngine.executeQuery(query, {
        datasourceId: dataSourceId,
        ...options
      });
      
      // Format the results based on type
      const { results, explanation } = this.formatQueryResultsWithAggregations(query, queryResult);
      
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
}