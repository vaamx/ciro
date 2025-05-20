import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, ChatMessage } from '../ai/openai.service';

/**
 * Enum for different query processing paths
 */
export enum QueryProcessingPath {
  RAG = 'rag',
  CODE_EXECUTION = 'code_execution',
  HYBRID = 'hybrid'
}

/**
 * Result of routing a query
 */
export interface QueryRoutingResult {
  path: QueryProcessingPath;
  confidence: number;
  explanation: string;
  requiresVisualization: boolean;
}

/**
 * Service for routing queries to the appropriate processing path
 * This helps determine whether to use RAG, code execution, or a hybrid approach
 */
@Injectable()
export class QueryRouterService {
  private readonly logger = createServiceLogger('QueryRouterService');
  private openAIService?: OpenAIService;

  constructor() {
    try {
      // Comment out ServiceRegistry usage - will be replaced by NestJS DI
      // this.openAIService = ServiceRegistry.resolve(OpenAIService);
      this.logger.info('QueryRouterService initialized (DI pending)');
    } catch (error) {
      this.logger.error(`Error during initial setup of QueryRouterService: ${error}`);
    }
  }

  /**
   * Route a query to the appropriate processing path
   * @param query The user's query
   * @returns The routing result
   */
  async routeQuery(query: string): Promise<QueryRoutingResult> {
    try {
      this.logger.info(`Routing query: "${query}"`);
      
      // Check for analytical keywords
      const analyticalKeywords = [
        'calculate', 'compute', 'analyze', 'find', 'chart', 'graph', 'plot',
        'average', 'mean', 'median', 'sum', 'total', 'count', 'max', 'min',
        'correlate', 'correlation', 'regression', 'trend', 'compare', 'distribution',
        'percentage', 'ratio', 'proportion', 'aggregate', 'group by', 'sort',
        'filter', 'where', 'visualization', 'visualize', 'show me'
      ];
      
      // Check for visualization keywords
      const visualizationKeywords = [
        'chart', 'graph', 'plot', 'visualize', 'visualization', 'show me',
        'display', 'draw', 'bar chart', 'line chart', 'pie chart', 'scatter plot',
        'histogram', 'heat map', 'table', 'dashboard'
      ];
      
      // Simple heuristic approach
      const queryLower = query.toLowerCase();
      const containsAnalyticalKeywords = analyticalKeywords.some(keyword => 
        queryLower.includes(keyword.toLowerCase()));
      const containsVisualizationKeywords = visualizationKeywords.some(keyword => 
        queryLower.includes(keyword.toLowerCase()));
      
      // For more accurate classification, use AI to analyze the query intent
      if (this.openAIService) {
        try {
          const systemPrompt = `
            You are a query router that determines how to process user queries.
            Analyze the query and determine if it should be processed by:
            1. RAG (Retrieval Augmented Generation) - for factual questions, explanations, or information retrieval
            2. Code Execution - for data analysis, calculations, or generating visualizations
            3. Hybrid - for complex queries that need both approaches
            
            Also determine if the query would benefit from a visualization.
            
            Respond in JSON format with:
            {
              "path": "rag" | "code_execution" | "hybrid",
              "confidence": <number between 0 and 1>,
              "explanation": "<explanation of routing decision>",
              "requiresVisualization": <boolean>
            }
          `;
          
          // Convert messages to the format expected by OpenAIService
          const messages: ChatMessage[] = [
            { 
              id: 'system-' + Date.now(),
              role: 'system', 
              content: systemPrompt,
              timestamp: Date.now(),
              status: 'complete'
            },
            { 
              id: 'user-' + Date.now(),
              role: 'user', 
              content: query,
              timestamp: Date.now(),
              status: 'complete'
            }
          ];
          
          const response = await this.openAIService.generateChatCompletion(messages, {
            temperature: 0.1,
            systemPrompt
          });
          
          // Parse the response content
          const responseData = await response.json() as {
            id: string;
            role: string;
            content: string;
            timestamp: number;
            status: string;
          };
          
          if (responseData && responseData.content) {
            try {
              const result = JSON.parse(responseData.content);
              
              return {
                path: result.path as QueryProcessingPath,
                confidence: result.confidence,
                explanation: result.explanation,
                requiresVisualization: result.requiresVisualization
              };
            } catch (parseError) {
              this.logger.error(`Error parsing AI response: ${parseError}`);
            }
          }
        } catch (aiError) {
          this.logger.error(`Error using AI for routing: ${aiError}`);
        }
      }
      
      // Fallback to simple heuristic if AI classification fails
      if (containsAnalyticalKeywords) {
        return {
          path: QueryProcessingPath.CODE_EXECUTION,
          confidence: 0.75,
          explanation: 'Query contains analytical keywords that suggest code execution is needed',
          requiresVisualization: containsVisualizationKeywords
        };
      } else {
        return {
          path: QueryProcessingPath.RAG,
          confidence: 0.8,
          explanation: 'Query appears to be information-seeking, routing to RAG',
          requiresVisualization: containsVisualizationKeywords
        };
      }
    } catch (error) {
      this.logger.error(`Error routing query: ${error}`);
      
      // Default to RAG as a fallback
      return {
        path: QueryProcessingPath.RAG,
        confidence: 0.5,
        explanation: 'Error occurred during routing, defaulting to RAG',
        requiresVisualization: false
      };
    }
  }
} 