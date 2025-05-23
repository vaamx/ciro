import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, ChatMessage } from '../ai/openai.service';
import { Document, GenerationOptions, IGenerationService, ContextBuilderOptions, ContextFormat } from '../vector/vector.interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for generating responses from retrieved documents
 * for RAG (Retrieval Augmented Generation)
 */
@Injectable()
export class GenerationService implements IGenerationService {
  private readonly logger = createServiceLogger('GenerationService');
  
  private openaiService: OpenAIService;

  constructor(
    private readonly openAIService: OpenAIService,
    ) {
    this.logger.info('GenerationService initialized');
    this.openaiService = this.openAIService;
  }

  /**
   * Generate content based on a prompt and context
   * @param prompt The prompt text
   * @param context String or array of documents providing context
   * @param options Generation options
   * @returns Generated text
   */
  async generate(prompt: string, context: string | Document[], options?: GenerationOptions): Promise<string> {
    // If context is a string, use it directly, otherwise build context from documents
    const contextString = typeof context === 'string' 
      ? context 
      : this.buildContext(prompt, context, options?.contextOptions);
    
    // Create messages for the model
    const systemMessage = this.createSystemMessage(options?.systemPrompt);
    const userMessage = this.createUserMessage(prompt, contextString);
    
    // Generate response
    try {
      // Format messages for OpenAI
      const messages: ChatMessage[] = [
        systemMessage,
        userMessage
      ];
      
      // Select model
      const model = options?.model || this.selectAppropriateModel(prompt);
      
      // Send to OpenAI
      const response = await this.openaiService.generateChatCompletion(messages, {
        model: model as any,
        temperature: options?.temperature || 0.7,
        ...(options?.maxTokens ? { maxTokens: options?.maxTokens } : {})
      });
      
      // Parse the response
      const responseText = await response.text();
      let parsedResponse: Record<string, any> = {};
      
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        this.logger.error('Failed to parse JSON response', { response: responseText });
        return "There was an error generating a response. Please try again.";
      }
      
      // Extract content from response
      let content = '';
      if (parsedResponse?.choices?.length > 0 && parsedResponse.choices[0].message) {
        content = parsedResponse.choices[0].message.content || '';
      } else if (parsedResponse && typeof parsedResponse === 'object' && 'content' in parsedResponse) {
        // Fallback for direct content or other less common structures
        content = (parsedResponse as any).content || '';
      }
      
      return content;
    } catch (error) {
      this.logger.error('Error generating response:', error);
      return "I encountered an error while generating a response. Please try again.";
    }
  }

  /**
   * Generate a response based on the query and retrieved documents
   * @param query User query
   * @param documents Retrieved documents
   * @param options Generation options
   * @returns Generated content and model used
   */
  async generateResponse(
    query: string,
    documents: Document[],
    options: GenerationOptions & { contextOptions?: ContextBuilderOptions } = {}
  ): Promise<{
    content: string;
    model: string;
  }> {
    const startTime = Date.now();
    this.logger.info(`Generating response for query: "${query.substring(0, 50)}..." with ${documents.length} documents`);
    
    if (!documents || documents.length === 0) {
      this.logger.warn('No documents provided for generating response');
      return {
        content: "I couldn't find any relevant information to answer your question. Please try rephrasing or selecting a different data source.",
        model: 'fallback'
      };
    }
    
    // Select the appropriate model
    const model = options.model || this.selectAppropriateModel(query);
    
    // Build context using enhanced logic (moved from ContextBuilder)
    const context = this.buildContext(query, documents, options.contextOptions);
    
    // Create system message
    const systemMessage = this.createSystemMessage(options.systemPrompt);
    
    // Create user message
    const userMessage = this.createUserMessage(query, context);
    
    // Generate response
    try {
      // Format messages for OpenAI
      const messages: ChatMessage[] = [
        systemMessage,
        userMessage
      ];
      
      // Send to OpenAI
      const response = await this.openaiService.generateChatCompletion(messages, {
        model: model as any,
        temperature: options.temperature || 0.7,
        ...(options.maxTokens ? { maxTokens: options.maxTokens } : {})
      });
      
      // Parse the response
      const responseText = await response.text();
      let parsedResponse: Record<string, any> = {};
      
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        this.logger.error('Failed to parse JSON response', { response: responseText });
        return {
          content: "There was an error generating a response. Please try again.",
          model: model
        };
      }
      
      // Extract content from response
      let content = '';
      if (parsedResponse?.choices?.length > 0 && parsedResponse.choices[0].message) {
        content = parsedResponse.choices[0].message.content || '';
      } else if (parsedResponse && typeof parsedResponse === 'object' && 'content' in parsedResponse) {
        // Fallback for direct content or other less common structures
        content = (parsedResponse as any).content || '';
      }
      
      const duration = Date.now() - startTime;
      this.logger.info(`Generated response in ${duration}ms using model ${model}`);
      
      return {
        content,
        model
      };
    } catch (error) {
      this.logger.error('Error generating response:', error);
      
      return {
        content: "I encountered an error while generating a response. Please try again.",
        model: 'error'
      };
    }
  }

  /**
   * Build context from documents for the prompt, incorporating logic from ContextBuilder
   * @param query The user query
   * @param documents Retrieved documents
   * @param options ContextBuilder options
   * @returns Formatted context string
   */
  private buildContext(
    query: string,
    documents: Document[],
    options?: ContextBuilderOptions
  ): string {
    if (!documents || documents.length === 0) {
      return '';
    }
    
    const {
      format = 'default',
      maxChars,
      maxDocuments
    } = options || {};

    // Apply document limit if specified
    const filteredDocs = maxDocuments && maxDocuments > 0 
      ? documents.slice(0, maxDocuments) 
      : documents;
    
    // Sort by similarity score (if available)
    const sortedDocs = [...filteredDocs].sort((a, b) => 
      (b.similarity || 0) - (a.similarity || 0)
    );

    let formattedContext = `Context for query: "${query}"\nBased on ${sortedDocs.length} documents:\n\n`;

    // Create a utility function to include metadata formatting consistently
    const formatWithMetadata = (doc: Document, prefix: string): string => {
      const metadataStr = doc.metadata ? `\nSource: ${this.formatMetadata(doc.metadata)}` : '';
      return `${prefix}${metadataStr}\n${doc.content.trim()}`;
    };

    // Default format if none specified or invalid
    const defaultFormat = (docs: Document[]): string => {
      return docs.map((doc, index) => 
        formatWithMetadata(doc, `[Document ${index + 1}]`)
      ).join('\n\n');
    };

    // Convert string format to enum if needed
    // This allows us to support both string literals and enum values
    const getFormatType = (fmt: string | ContextFormat): ContextFormat | string => {
      // If it's already an enum value, return it
      if (typeof fmt === 'number') return fmt;
      
      // Map string values to enum
      switch(fmt) {
        case 'markdown': return ContextFormat.MARKDOWN;
        case 'array': return ContextFormat.ARRAY;
        case 'string': return ContextFormat.STRING;
        // Keep other string literals as is
        default: return fmt;
      }
    };

    // Get normalized format
    const formatType = getFormatType(format);

    // Handle different format cases based on the normalized format
    if (formatType === ContextFormat.MARKDOWN) {
      // Markdown format
      formattedContext += sortedDocs.map((doc, index) => 
        formatWithMetadata(doc, `### Document ${index + 1}`)
      ).join('\n\n');
    } else if (formatType === ContextFormat.ARRAY) {
      // Array/list format
      formattedContext += sortedDocs.map((doc, index) => 
        formatWithMetadata(doc, `- Document ${index + 1}:`)
      ).join('\n\n');
    } else if (formatType === ContextFormat.STRING || formatType === 'compact') {
      // String/compact format just shows content without metadata
      formattedContext += sortedDocs.map(doc => doc.content.trim()).join('\n\n');
    } else if (formatType === 'numbered') {
      // Numbered format (custom string format)
      formattedContext += sortedDocs.map((doc, index) => 
        formatWithMetadata(doc, `Document ${index + 1}:`)
      ).join('\n\n');
    } else {
      // Default formatting for any other value
      formattedContext += defaultFormat(sortedDocs);
    }

    // Apply character limit if specified
    if (maxChars && maxChars > 0 && formattedContext.length > maxChars) {
      formattedContext = formattedContext.substring(0, maxChars) + '... [truncated]';
    }

    return formattedContext;
  }

  /**
   * Deduplicate documents based on content similarity (moved from ContextBuilder)
   * @param documents Retrieved documents
   * @returns Deduplicated documents
   */
  private deduplicateDocuments(documents: Document[]): Document[] {
    const uniqueDocs: Document[] = [];
    const seenContent = new Set<string>();
    for (const doc of documents) {
      const contentKey = doc.content.trim().toLowerCase().slice(0, 100);
      if (seenContent.has(contentKey)) continue;
      seenContent.add(contentKey);
      uniqueDocs.push(doc);
    }
    this.logger.debug(`Deduplicated ${documents.length} docs down to ${uniqueDocs.length}`);
    return uniqueDocs;
  }

  /**
   * Format metadata object into a string (moved from ContextBuilder)
   * @param metadata Metadata object
   * @returns Formatted metadata string
   */
  private formatMetadata(metadata: Record<string, any> | undefined): string {
    if (!metadata) return '';
    const title = metadata.title || metadata.name || '';
    const source = metadata.source || metadata.url || metadata.filename || '';
    const author = metadata.author || '';
    const date = metadata.date || metadata.createdAt || '';
    const parts = [];
    if (title) parts.push(`'${title}'`);
    if (source) parts.push(`from ${source}`);
    if (author) parts.push(`by ${author}`);
    if (date) parts.push(`(${date})`);
    return parts.filter(p => p).join(' ') || 'Unknown Source';
  }

  /**
   * Create system message for the LLM
   * @param systemPrompt Additional system prompt instructions
   * @returns Formatted system message
   */
  private createSystemMessage(systemPrompt?: string): ChatMessage {
    const basePrompt = 
      `You are an AI assistant that answers questions based on the provided information. 
      Only use the information from the search results to answer the question. 
      If you don't have enough information, say so. 
      Format your answer in a clear, concise way. Use markdown for formatting.`;
    
    const systemContent = systemPrompt ? `${basePrompt}\n\n${systemPrompt}` : basePrompt;
    
    return {
      id: uuidv4(),
      role: 'system',
      content: systemContent,
      timestamp: Date.now(),
      status: 'complete'
    };
  }

  /**
   * Create user message with query and context
   * @param query The user query
   * @param context The document context
   * @returns Formatted user message
   */
  private createUserMessage(query: string, context: string): ChatMessage {
    return {
      id: uuidv4(),
      role: 'user',
      content: `Context Information:\n${context}\n\nUser Question: ${query}`,
      timestamp: Date.now(),
      status: 'complete'
    };
  }

  /**
   * Select appropriate model based on query complexity
   * @param query The user query
   * @returns Model name
   */
  private selectAppropriateModel(query: string): string {
    const complexityScore = this.estimateQueryComplexity(query);
    
    // Select model based on complexity
    if (complexityScore > 0.7) {
      return 'gpt-4o'; // Most capable model for complex queries
    } else if (complexityScore > 0.4) {
      return 'gpt-4o-mini'; // Medium complexity
    } else {
      return 'o3-mini'; // Simple queries
    }
  }

  /**
   * Estimate query complexity based on various factors
   * @param query The user query
   * @returns Complexity score between 0 and 1
   */
  private estimateQueryComplexity(query: string): number {
    if (!query) return 0;
    
    const lowerQuery = query.toLowerCase();
    let complexityScore = 0;
    
    // Length factor (longer queries tend to be more complex)
    const length = query.length;
    if (length > 200) complexityScore += 0.35;
    else if (length > 100) complexityScore += 0.25;
    else if (length > 50) complexityScore += 0.15;
    
    // Keyword factors
    const analyticalKeywords = [
      'analyze', 'analysis', 'compare', 'correlation', 'relationship',
      'trend', 'pattern', 'calculate', 'statistics', 'perspective',
      'implications', 'impact', 'evaluate', 'assessment'
    ];
    
    const complexStructureKeywords = [
      'however', 'nevertheless', 'therefore', 'consequently',
      'furthermore', 'moreover', 'conversely', 'alternatively',
      'specifically', 'particularly', 'subsequently'
    ];
    
    // Check for analytical keywords
    for (const keyword of analyticalKeywords) {
      if (lowerQuery.includes(keyword)) {
        complexityScore += 0.05;
      }
    }
    
    // Check for complex structure
    for (const keyword of complexStructureKeywords) {
      if (lowerQuery.includes(keyword)) {
        complexityScore += 0.03;
      }
    }
    
    // Check for question complexity
    const questionWords = ['what', 'why', 'how', 'when', 'where', 'who', 'which'];
    let questionCount = 0;
    for (const word of questionWords) {
      const pattern = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerQuery.match(pattern);
      if (matches) {
        questionCount += matches.length;
      }
    }
    
    if (questionCount > 2) {
      complexityScore += 0.25;
    } else if (questionCount > 0) {
      complexityScore += 0.1;
    }
    
    // Check for patterns suggesting complexity
    if (lowerQuery.includes('explain') && lowerQuery.includes('why')) {
      complexityScore += 0.1; // Explanatory questions are complex
    }
    
    if (lowerQuery.includes('difference between') || lowerQuery.includes(' vs ')) {
      complexityScore += 0.1; // Comparison questions
    }
    
    // Limit to range 0-1
    return Math.min(1, complexityScore);
  }

  /**
   * Generate content directly from a pre-formatted prompt string.
   * This method is intended for scenarios where the calling service has already constructed the full prompt.
   * @param fullPrompt The complete prompt string to send to the LLM.
   * @param options Generation options (model, temperature, maxTokens).
   * @returns Generated text content.
   */
  async generateFromPreformattedPrompt(
    fullPrompt: string,
    options?: GenerationOptions,
  ): Promise<string> {
    const startTime = Date.now();
    this.logger.info(`Generating response from pre-formatted prompt (first 100 chars): "${fullPrompt.substring(0, 100)}..."`);

    if (!fullPrompt) {
      this.logger.warn('generateFromPreformattedPrompt called with an empty prompt.');
      return "Error: Prompt cannot be empty.";
    }

    const model = options?.model || this.selectAppropriateModel(fullPrompt); // Can use selectAppropriateModel or a simpler default
    const systemMessage = this.createSystemMessage(options?.systemPrompt); // Still use a system prompt wrapper if provided

    try {
      const messages: ChatMessage[] = [
        systemMessage, // A base system message can still be useful
        { role: 'user', content: fullPrompt, id: uuidv4(), timestamp: Date.now(), status: 'complete' },
      ];

      const response = await this.openaiService.generateChatCompletion(messages, {
        model: model as any,
        temperature: options?.temperature || 0.7,
        ...(options?.maxTokens ? { maxTokens: options.maxTokens } : {}),
      });

      const responseText = await response.text();
      let parsedResponse: Record<string, any> = {}; // Use any for parsedResponse as structure can vary

      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        this.logger.error('Failed to parse JSON response from pre-formatted prompt', { response: responseText });
        // Attempt to recover if it's a simple string response not in JSON format
        if (typeof responseText === 'string' && !responseText.startsWith('{')) {
            this.logger.info('Response appears to be a plain string, using as content.');
            const durationPlain = Date.now() - startTime;
            this.logger.info(`Generated plain string response from pre-formatted prompt in ${durationPlain}ms using model ${model}`);
            return responseText; 
        }
        return "Error: Could not parse LLM response.";
      }
      
      let content = '';
      // Standard OpenAI chat completion structure
      if (parsedResponse.choices && parsedResponse.choices.length > 0 && parsedResponse.choices[0].message) {
        content = parsedResponse.choices[0].message.content || '';
      } 
      // Fallback for direct content or other structures if necessary (adjust as per your LLMService actual responses)
      else if (parsedResponse.content) { 
        content = parsedResponse.content;
      }
      // Add other parsing logic if your LLM returns different structures

      const duration = Date.now() - startTime;
      this.logger.info(`Generated response from pre-formatted prompt in ${duration}ms using model ${model}`);

      return content;
    } catch (error) {
      this.logger.error('Error generating response from pre-formatted prompt:', error);
      return "I encountered an error while generating a response. Please try again.";
    }
  }
} 