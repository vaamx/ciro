import { db } from '../infrastructure/database';
import { OpenAIService } from './openai.service';
import { createLogger } from '../utils/logger';
import { QdrantService } from './qdrant.service';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

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
 * RAG (Retrieval Augmented Generation) service
 */
export class RagService {
  private openaiService: OpenAIService;
  private qdrantService: QdrantService;
  private textSearch: TextSearch;
  private logger = createLogger('RagService');

  constructor() {
    this.logger.info('Initializing RAG service');
    this.openaiService = OpenAIService.getInstance();
    this.qdrantService = QdrantService.getInstance();
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
  } {
    if (!query) {
      return {
        intent: 'general',
        complexity: 'low',
        dataVisualization: false,
        entities: [],
        searchLimit: 5,
        similarityThreshold: 0.3
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
      similarityThreshold
    };
  }

  /**
   * Process a query against specified data sources with conversation history
   * @param query The user query string
   * @param dataSourceIds Array of data source IDs to query against
   * @param sessionId Optional session ID to retrieve conversation history
   * @param maxHistoryMessages Maximum number of previous messages to include
   * @returns Object containing retrieved sources and generated content
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
  }> {
    this.logger.info(`Processing query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    this.logger.info(`Using data sources: ${dataSourceIds.join(', ')}`);
    
    try {
      // Analyze the query intent and characteristics
      const queryAnalysis = this.analyzeQueryIntent(query);
      this.logger.info(`Query analysis: ${JSON.stringify(queryAnalysis)}`);
      
      // Handle specialized query types based on intent and count type
      if (queryAnalysis.intent === 'count') {
        if (queryAnalysis.countType === 'document') {
          return this.processDocumentSummaryQuery(query, dataSourceIds);
        } else if (queryAnalysis.countType === 'vcfund') {
          // Use the general analytical content processor for VC fund queries
          return this.processAnalyticalContent(query, dataSourceIds, {
            ...queryAnalysis,
            intent: 'analysis' // Force analysis intent for this type
          });
        } else if (queryAnalysis.countType === 'entity' && queryAnalysis.entityType) {
          const entityCountResult = this.detectEntityCountQuery(query);
          if (entityCountResult.isEntityCountQuery && entityCountResult.entityType && entityCountResult.pattern) {
            return this.processEntityCountQuery(query, dataSourceIds, entityCountResult.entityType, entityCountResult.pattern);
          }
        }
      }
      
      // For analytical intents, use the specialized analytical processing
      if (queryAnalysis.intent === 'analysis' || queryAnalysis.intent === 'statistics') {
        return this.processAnalyticalContent(query, dataSourceIds, queryAnalysis);
      }
      
      // For all other query types, proceed with standard RAG processing
      // Select the appropriate model based on query complexity
      const selectedModel = this.openaiService.selectModelForQuery(query);
      this.logger.info(`Selected model for query: ${selectedModel} (complexity: ${queryAnalysis.complexity})`);

      // Enhanced conversation history retrieval with metadata
      let conversationHistory: ChatCompletionMessageParam[] = [];
      let recentSources: any[] = [];
      let mentionedEntities: string[] = [];
      
      if (sessionId) {
        try {
          // Get previous messages with metadata
          const previousMessages = await db('chat_messages')
            .where({ session_id: sessionId })
            .orderBy('created_at', 'asc')
            .limit(maxHistoryMessages * 2) // Get more to ensure we have enough after filtering
            .select('*');
          
          if (previousMessages && previousMessages.length > 0) {
            // Extract mentioned entities and previously used sources
            for (const msg of previousMessages) {
              // Extract entities from message content
              if (msg.content) {
                const extractedEntities = this.extractEntitiesFromContent(msg.content);
                if (extractedEntities.length > 0) {
                  mentionedEntities.push(...extractedEntities);
                }
              }
              
              // Collect sources from metadata
              if (msg.metadata && msg.metadata.sources) {
                recentSources.push(...(Array.isArray(msg.metadata.sources) ? msg.metadata.sources : []));
              }
            }
            
            // Remove duplicate entities and sources
            mentionedEntities = [...new Set(mentionedEntities)];
            
            // Only keep unique sources by ID
            const uniqueSources = new Map();
            for (const source of recentSources) {
              if (source.id && !uniqueSources.has(source.id)) {
                uniqueSources.set(source.id, source);
              }
            }
            recentSources = Array.from(uniqueSources.values());
            
            // Format messages for the conversation history
            conversationHistory = previousMessages
              .filter(msg => msg.role && msg.content) // Only include valid messages
              .slice(-maxHistoryMessages) // Limit to max history messages
              .map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content
              }));
            
            this.logger.info(`Retrieved ${conversationHistory.length} previous messages, ${mentionedEntities.length} entities, and ${recentSources.length} sources for context`);
          }
        } catch (historyError) {
          this.logger.error('Error retrieving conversation history:', historyError);
          // Continue without history if there's an error
        }
      }
      
      // Enhance the query with conversation context when appropriate
      let enhancedQuery = query;
      
      // Only enhance the query if it seems like it depends on previous context
      if (this.queryNeedsContextEnhancement(query) && conversationHistory.length > 0) {
        enhancedQuery = this.enhanceQueryWithContext(query, conversationHistory, mentionedEntities);
        this.logger.info(`Enhanced query: "${enhancedQuery.substring(0, 50)}..."`);
      }
      
      // Retrieve relevant documents from data sources
      const retrievedDocuments = [];
      
      // First check if any recent sources are still relevant to this query
      if (recentSources.length > 0) {
        const relevantRecentSources = await this.filterRelevantSources(
          enhancedQuery, 
          recentSources
        );
        
        if (relevantRecentSources.length > 0) {
          this.logger.info(`Found ${relevantRecentSources.length} relevant sources from conversation history`);
          retrievedDocuments.push(...relevantRecentSources);
        }
      }
      
      // Then search for new relevant documents
      for (const sourceId of dataSourceIds) {
        try {
          // Get collection information from the database
          const dataSource = await db('data_sources')
            .where({ id: sourceId })
            .first();
            
          if (!dataSource) {
            this.logger.warn(`Data source ${sourceId} not found`);
            continue;
          }
          
          // Use the collection name from the data source
          const collectionName = this.normalizeCollectionName(sourceId.toString());
          
          // When processing the search in regular query processing
          try {
            // Generate embedding for the query with safe type handling
            const embeddingResult = await this.openaiService.createEmbeddings(enhancedQuery || query);
            
            // Create a safe embedding by ensuring it's flattened to a simple number array
            const safeEmbedding = Array.isArray(embeddingResult) && embeddingResult.length > 0
              ? (Array.isArray(embeddingResult[0]) ? embeddingResult[0] : embeddingResult)
              : [];
            
            if (safeEmbedding.length === 0) {
              this.logger.warn(`No valid embeddings returned for query: "${query}"`);
              continue; // Skip this data source
            }
            
            // Now use the embedding safely in the search
            const results = await this.qdrantService.search(
              collectionName,
              safeEmbedding as any, // Force type compatibility
              {}, // No additional filter
              queryAnalysis.searchLimit
            );
            
            if (results && results.length > 0) {
              // Transform results to match the expected format
              const transformedResults = results.map(result => ({
                content: result.payload?.text || result.payload?.content || '',
                metadata: {
                  ...result.payload?.metadata || {},
                  similarity: result.score
                }
              }));
              
              retrievedDocuments.push(...transformedResults.map(doc => ({
                ...doc,
                sourceId,
                sourceName: dataSource.name || `Source ${sourceId}`
              })));
            }
          } catch (error) {
            this.logger.error(`Error processing source ${sourceId}:`, error);
            // Continue with other sources
          }
        } catch (error) {
          this.logger.error(`Error processing source ${sourceId}:`, error);
          // Continue with other sources
        }
      }
      
      this.logger.info(`Retrieved ${retrievedDocuments.length} relevant documents`);
      
      // Format retrieved documents as context for the LLM
      let contextText = '';
      if (retrievedDocuments.length > 0) {
        // Deduplicate documents based on content similarity
        const uniqueDocuments = this.deduplicateDocuments(retrievedDocuments);
        
        // Format documents with source attribution
        contextText = uniqueDocuments.map((doc, index) => 
          `[Document ${index + 1} from ${doc.sourceName || 'Unknown Source'}] ${doc.content}`
        ).join('\n\n');
      }
      
      // Construct messages array with system prompt, context, history and query
      const messages: ChatCompletionMessageParam[] = [];
      
      // Start with system message
      messages.push({
        role: 'system',
        content: `You are a helpful assistant with access to retrieved information. ${
          retrievedDocuments.length > 0 
            ? 'When answering, use the context provided below. If the context doesn\'t contain relevant information, acknowledge that and provide your best response based on your training.' 
            : 'No specific context is available for this query, so provide your best response based on your training.'
        }`
      });
      
      // Add context if available
      if (contextText) {
        messages.push({
          role: 'system',
          content: `Context information:\n${contextText}`
        });
      }
      
      // Add conversation history
      if (conversationHistory.length > 0) {
        messages.push(...conversationHistory);
      }
      
      // Add current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Generate response with the LLM
      const response = await this.openaiService.generateChatCompletion(messages, {
        model: selectedModel,
        temperature: queryAnalysis.complexity === 'high' ? 0.2 : 0.7 // Lower temperature for analytical queries
      });
      
      // Handle the response based on its type (Stream or ChatCompletion)
      let responseContent = '';
      let modelName = selectedModel;
      
      // Check if response is a ChatCompletion (not a stream)
      if ('choices' in response && response.choices && response.choices.length > 0) {
        responseContent = response.choices[0].message.content || '';
        // The model name from the response might not match our ModelName type exactly
        // but we trust that OpenAI will return a valid model
        if (response.model) {
          modelName = response.model as any;
        }
      }
      
      // Save this interaction to the chat history if sessionId is provided
      if (sessionId && responseContent) {
        try {
          // Save the user message
          await db('chat_messages').insert({
            session_id: sessionId,
            role: 'user',
            content: query,
            metadata: {
              timestamp: new Date().toISOString()
            },
            created_at: new Date(),
            updated_at: new Date()
          });
          
          // Save the assistant response with sources in metadata
          await db('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: responseContent,
            metadata: {
              sources: retrievedDocuments.map(doc => ({
                id: doc.id,
                content: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
                similarity: doc.metadata?.similarity,
                sourceName: doc.sourceName
              })),
              model: modelName,
              analytical: queryAnalysis.intent === 'analysis' || queryAnalysis.intent === 'statistics',
              timestamp: new Date().toISOString()
            },
            created_at: new Date(),
            updated_at: new Date()
          });
          
          this.logger.info(`Saved interaction to chat history for session ${sessionId}`);
        } catch (saveError) {
          this.logger.error('Error saving to chat history:', saveError);
          // Continue even if saving fails
        }
      }
      
      return {
        sources: retrievedDocuments.map(doc => ({
          content: doc.content,
          metadata: doc.metadata,
          sourceId: doc.sourceId,
          sourceName: doc.sourceName
        })),
        content: responseContent || `Unable to process query: "${query}"`,
        model: modelName
      };
    } catch (error) {
      this.logger.error('Error processing RAG query:', error);
      
      return {
        sources: [],
        content: `An error occurred while processing your query. Please try again later.
        Your query was: "${query}"
        You requested data from sources: ${dataSourceIds.join(', ')}`
      };
    }
  }

  /**
   * Detect if the query is asking for a document summary
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
   * Check if a query is analytical in nature
   * This affects:
   * 1. Search strategy (more comprehensive)
   * 2. Number of documents retrieved
   * 3. Lower temperature for more factual responses
   * 4. Different prompt templates optimized for analytical reasoning
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
      'calculate', 'computation', 'quantify', 'estimate', 'evaluate'
    ];
    
    // Check for question types
    const questionPatterns = [
      /how many/i, /what is the total/i, /what percentage/i, 
      /what is the average/i, /what is the distribution/i,
      /what are all the/i, /list all the/i, /count the/i,
      /summarize the/i, /give me statistics on/i, /give me an analysis of/i,
      /how much/i, /tell me about/i, /describe the/i
    ];
    
    // Check for VC fund specific queries
    const vcFundPatterns = [
      /vc fund/i, /venture capital/i, /investor/i, /investment/i, 
      /portfolio/i, /startups/i, /funding/i, /capital/i,
      /lead/i, /co-investor/i, /check size/i, /focus vertical/i,
      /stage\(s\)/i, /leads rounds/i
    ];
    
    // Check if query contains analytical keywords
    const hasAnalyticalKeyword = analyticalKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );
    
    // Check if query matches question patterns
    const matchesQuestionPattern = questionPatterns.some(pattern => 
      pattern.test(lowerQuery)
    );
    
    // Check if query is about VC funds
    const isVCFundQuery = vcFundPatterns.some(pattern => 
      pattern.test(lowerQuery)
    );
    
    // Log the query classification for debugging
    this.logger.debug(`Query classification for: "${query.substring(0, 50)}..."`);
    this.logger.debug(`- Has analytical keyword: ${hasAnalyticalKeyword}`);
    this.logger.debug(`- Matches question pattern: ${matchesQuestionPattern}`);
    this.logger.debug(`- Is VC fund query: ${isVCFundQuery}`);
    
    // If it's a VC fund query AND either has analytical keyword or matches question pattern
    if (isVCFundQuery && (hasAnalyticalKeyword || matchesQuestionPattern)) {
      this.logger.info(`Identified as analytical VC fund query: "${query.substring(0, 50)}..."`);
      return true;
    }
    
    // General analytical query detection
    return hasAnalyticalKeyword || matchesQuestionPattern;
  }

  /**
   * Determine if the query is specifically asking about VC fund counts
   */
  private isVCFundCountQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Check for specific patterns related to counting VC funds
    const vcFundCountPatterns = [
      /how many (unique |distinct |different )?vc funds/i,
      /how many (unique |distinct |different )?venture capital funds/i,
      /total (number|count) of (unique |distinct |different )?vc funds/i,
      /total (number|count) of (unique |distinct |different )?venture capital funds/i,
      /count (of |the )?vc funds/i,
      /count (of |the )?venture capital funds/i,
      /number of (unique |distinct |different )?vc funds/i,
      /number of (unique |distinct |different )?venture capital funds/i
    ];
    
    return vcFundCountPatterns.some(pattern => pattern.test(lowerQuery));
  }

  /**
   * Checks if the query likely depends on conversation context
   */
  private queryNeedsContextEnhancement(query: string): boolean {
    // Check for references to previous context
    const contextDependentPatterns = [
      /this|that|these|those/i, // Demonstrative pronouns
      /the (aforementioned|above|previous)/i, // References to previous things
      /it|they|them|their|he|she|his|her/i, // Pronouns that might refer to previously mentioned entities
      /as (mentioned|discussed|noted|stated|described)/i, // References to previous discussion
      /\b(can you )?(elaborate|explain more|tell me more)\b/i, // Requests for elaboration
      /\b(in|from) (your|the) (previous|last|earlier) (answer|response)\b/i, // Direct references
      /\b(the|that) (document|information|content|data|article|paper|text)\b/i, // References to documents
    ];
    
    return contextDependentPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Enhances a query with context from conversation history
   */
  private enhanceQueryWithContext(
    query: string,
    history: ChatCompletionMessageParam[],
    entities: string[]
  ): string {
    // For very short queries that need context, add recent entities
    if (query.length < 20 && entities.length > 0) {
      // Limit to 3 most recent entities to avoid cluttering
      const recentEntities = entities.slice(-3);
      return `${query} (in the context of our discussion about ${recentEntities.join(', ')})`;
    }
    
    // If query contains pronouns without clear referents, try to resolve them
    const pronounPattern = /\b(it|they|them|this|that|these|those)\b/i;
    if (pronounPattern.test(query)) {
      // Get the last user and assistant messages
      const lastMessages = history.slice(-2);
      
      // Extract the likely subject of discussion
      let subjects: string[] = [];
      for (const msg of lastMessages) {
        // Extract entities or key phrases from the last messages
        const extractedEntities = this.extractEntitiesFromContent(msg.content || '');
        subjects.push(...extractedEntities);
      }
      
      // Use up to 2 most recent subjects
      if (subjects.length > 0) {
        const recentSubjects = subjects.slice(-2);
        return query.replace(pronounPattern, match => {
          return `${match} (referring to ${recentSubjects.join(' and ')})`;
        });
      }
    }
    
    // If no special enhancement is needed, return the original query
    return query;
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
   * Filter sources from history that are still relevant to the current query
   */
  private async filterRelevantSources(query: string, sources: any[]): Promise<any[]> {
    if (!sources.length) return [];
    
    try {
      // Get embeddings for the query and sources
      const texts = [query, ...sources.map(s => s.content || '')];
      const embeddings = await this.openaiService.createEmbeddings(texts);
      
      if (!embeddings || embeddings.length < texts.length) {
        return [];
      }
      
      // The first embedding is for the query
      const queryEmbedding = embeddings[0];
      
      // Calculate similarity between query and each source
      const relevantSources = [];
      for (let i = 0; i < sources.length; i++) {
        const sourceEmbedding = embeddings[i + 1]; // +1 because query embedding is first
        const similarity = this.calculateCosineSimilarity(queryEmbedding, sourceEmbedding);
        
        // Consider sources with similarity above threshold
        if (similarity > 0.75) {
          relevantSources.push({
            ...sources[i],
            metadata: {
              ...(sources[i].metadata || {}),
              similarity
            }
          });
        }
      }
      
      return relevantSources;
    } catch (error) {
      this.logger.error('Error filtering relevant sources:', error);
      return [];
    }
  }
  
  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
   * Get the status of data sources
   * @returns Object containing data source status information
   */
  async getStatus(): Promise<{
    available: boolean;
    message: string;
    dataSources: number;
    supportedModels: string[];
  }> {
    try {
      // Attempt to check if data sources exist
      const result = await db('data_sources').count('id as count').first();
      const count = result ? Number(result.count) : 0;
      
      return {
        available: true,
        message: 'RAG service is available',
        dataSources: count,
        supportedModels: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o1-mini']
      };
    } catch (error) {
      this.logger.error('Error checking RAG status:', error);
      return {
        available: false,
        message: 'Error checking RAG status',
        dataSources: 0,
        supportedModels: []
      };
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
  }> {
    this.logger.info(`Processing analytical content for query: "${query}"`);

    try {
      // Retrieve documents from all data sources with appropriate limits
      const allDocuments = [];
      
      for (const dataSourceId of dataSourceIds) {
        try {
          // Normalize collection name
          const collectionName = this.normalizeCollectionName(dataSourceId.toString());
          
          // Check if collection exists
          const exists = await this.qdrantService.collectionExists(collectionName);
          if (!exists) {
            this.logger.warn(`Collection ${collectionName} does not exist, skipping`);
            continue;
          }
          
          // Generate embedding for the query - handle types safely
          try {
            const embeddingResult = await this.openaiService.createEmbeddings(query);
            
            // Create a safe embedding by ensuring it's flattened to a simple number array
            // This avoids the TypeScript error by using "any" temporarily
            const safeEmbedding = Array.isArray(embeddingResult) && embeddingResult.length > 0
              ? (Array.isArray(embeddingResult[0]) ? embeddingResult[0] : embeddingResult)
              : [];
            
            // Use our qdrantService directly for search with properly typed embedding
            const results = await this.qdrantService.search(
              collectionName,
              safeEmbedding as any, // Force type compatibility
              {}, // No additional filter
              queryAnalysis.searchLimit
            );
            
            if (results && results.length > 0) {
              this.logger.info(`Found ${results.length} results in collection ${collectionName}`);
              allDocuments.push(...results);
            }
          } catch (embeddingError) {
            this.logger.error(`Error creating embeddings for query: ${embeddingError}`);
            continue; // Skip this data source
          }
        } catch (error) {
          this.logger.error(`Error searching collection for source ${dataSourceId}: ${error}`);
          // Continue with other data sources
        }
      }
      
      if (allDocuments.length === 0) {
        return {
          sources: [],
          content: `I couldn't find any relevant documents to analyze for your query about "${query}".`
        };
      }
      
      // Deduplicate documents
      const uniqueDocuments = this.deduplicateDocuments(allDocuments);
      this.logger.info(`Found ${uniqueDocuments.length} unique documents for analysis`);
      
      // For data visualization requests, add specific instructions
      let systemPrompt = `You are an advanced analytics assistant that provides data-driven insights.
Analyze the information in the provided context thoroughly.
${queryAnalysis.dataVisualization ? 
  'Include recommendations for data visualizations that would best represent this information. For each recommended visualization, specify the chart type, axes, and what insights it would highlight.' : ''}
${queryAnalysis.timeFrame ? 
  `Pay special attention to information related to the time frame: ${queryAnalysis.timeFrame}.` : ''}
${queryAnalysis.entities.length > 0 ? 
  `Focus on these specific entities in your analysis: ${queryAnalysis.entities.join(', ')}.` : ''}
Organize your response in a clear, structured format with headings for different aspects of the analysis.`;

      // Prepare user prompt with the query
      const userPrompt = query;
      
      // Create context from documents
      const contextText = uniqueDocuments.map(doc => {
        const content = doc.content || doc.payload?.text || '';
        const source = doc.metadata?.source || doc.sourceName || 'Unknown';
        return `Source: ${source}\n${content}`;
      }).join('\n\n');
      
      // Create messages for the completion
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `I need an analysis of the following information regarding this query: "${userPrompt}"\n\nContext information:\n${contextText}` }
      ];
      
      // Select model based on complexity
      const modelName = queryAnalysis.complexity === 'high' ? 'gpt-4o' : 'o3-mini';
      
      // Generate completion
      const result = await this.openaiService.generateChatCompletion(messages, {
        model: modelName,
        temperature: 0.2 // Low temperature for analytical content
      });
      
      // Extract response content
      let responseContent = "I couldn't generate an analysis for your query.";
      let model = modelName;
      
      // Check if the response has the expected structure
      if (result && typeof result === 'object' && 'choices' in result && 
          Array.isArray(result.choices) && result.choices.length > 0 && 
          result.choices[0].message) {
        responseContent = result.choices[0].message.content || responseContent;
      }
      
      return {
        sources: uniqueDocuments.map(doc => ({
          content: doc.content || doc.payload?.text || '',
          metadata: doc.metadata || {},
          sourceId: doc.sourceId || doc.id,
          sourceName: doc.sourceName || 'Document'
        })),
        content: responseContent,
        model: model
      };
    } catch (error) {
      this.logger.error(`Error processing analytical content: ${error instanceof Error ? error.message : String(error)}`);
      return {
        sources: [],
        content: `I encountered an error while analyzing information for your query: "${query}".`
      };
    }
  }

  /**
   * Normalize a collection name to ensure it follows Qdrant conventions
   * @param dataSourceId The data source ID to normalize
   * @returns Normalized collection name
   */
  private normalizeCollectionName(dataSourceId: string): string {
    // Extract numeric part if it's a string like "datasource_123"
    let numericId = dataSourceId;
    if (dataSourceId.includes('_')) {
      numericId = dataSourceId.split('_').pop() || dataSourceId;
    }
    
    // Ensure we're using a standard format
    return `datasource_${numericId}`;
  }

  /**
   * Detect entity count queries from natural language
   * @param query The user query to analyze
   * @returns Object with entity type, pattern, and boolean indicating if it's an entity count query
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
   * Process a document summary query
   * @param query The user query requesting a document summary
   * @param dataSourceIds Array of data source IDs to query
   * @returns Object with sources, content, and model information
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
      const modelName = 'gpt-4o-mini';
      
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
            model = 'gpt-4o-mini';
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
   * @param query The user query requesting entity counts
   * @param dataSourceIds Array of data source IDs to query
   * @param entityType Type of entity to count
   * @param pattern RegExp pattern to match entities
   * @returns Object with sources, content, and model information
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
      
      // Select a model for the completion - this returns the correct ModelName type
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
            model = 'gpt-4o-mini';
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
}