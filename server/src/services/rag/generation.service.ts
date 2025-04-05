import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { createServiceLogger } from '../../utils/logger-factory';
import { OpenAIService, ChatMessage } from '../ai/openai.service';
import { Document, GenerationOptions } from './interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for generating responses from retrieved documents
 * for RAG (Retrieval Augmented Generation)
 */
@Injectable()
export class GenerationService {
  private readonly logger = createServiceLogger('GenerationService');
  
  private openaiService: OpenAIService;

  private constructor(
    private readonly openAIService: OpenAIService,
    ) {
    this.logger.info('GenerationService initialized');
    this.openaiService = this.openAIService;
  }

  /**
   * Get the singleton instance of the service
   */
  

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
    options: GenerationOptions = {}
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
    
    // Build context from documents
    const context = this.buildContext(query, documents);
    
    // Create system message
    const systemMessage = this.createSystemMessage(options.extraSystemPrompt);
    
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
      let parsedResponse = {};
      
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
      if (parsedResponse && typeof parsedResponse === 'object' && 'content' in parsedResponse) {
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
   * Build context from documents for the prompt
   * @param query The user query
   * @param documents Retrieved documents
   * @returns Formatted context string
   */
  private buildContext(query: string, documents: Document[]): string {
    // Format search results into a context string
    let context = `Query: ${query}\n\n`;
    context += `Search Results (${documents.length}):\n\n`;

    // Add each document as context
    documents.forEach((doc, index) => {
      context += `Document ${index + 1}:\n`;
      context += `${doc.content}\n\n`;
    });

    return context;
  }

  /**
   * Create system message for the LLM
   * @param extraPrompt Additional system prompt instructions
   * @returns Formatted system message
   */
  private createSystemMessage(extraPrompt?: string): ChatMessage {
    const basePrompt = 
      `You are an AI assistant that answers questions based on the provided information. 
      Only use the information from the search results to answer the question. 
      If you don't have enough information, say so. 
      Format your answer in a clear, concise way. Use markdown for formatting.`;
    
    const systemContent = extraPrompt ? `${basePrompt}\n\n${extraPrompt}` : basePrompt;
    
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
    if (length > 200) complexityScore += 0.3;
    else if (length > 100) complexityScore += 0.2;
    else if (length > 50) complexityScore += 0.1;
    
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
      complexityScore += 0.2; // Multiple questions in one query
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
} 