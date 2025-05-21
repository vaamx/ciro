import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, ChatMessage } from '../ai/openai.service';
import { PreprocessedQuery } from '../../types/router.types';
import {
  validateText,
  getDefaultSettings,
  combineTextAndLanguageSettings,
  finalizeSettings,
  type ValidationIssue,
} from 'cspell-lib';

// Import cspell-lib for its actual functions, which will be mocked by Jest for tests
import * as cspellLib from 'cspell-lib';

// Minimal local interface to represent cspell-lib's Suggestion structure
interface CSpellSuggestion {
  word: string;
  isPreferred?: boolean;
}

/**
 * Enum for different query processing paths
 */
export enum QueryProcessingPath {
  DIRECT_RETRIEVAL = 'direct_retrieval',
  ANALYTICAL_TASK = 'analytical_task',
  CLARIFICATION_NEEDED = 'clarification_needed',
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
export class QueryRouterService implements OnModuleInit {
  private readonly logger = createServiceLogger(QueryRouterService.name);
  private readonly routerSpellcheck: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly openAIService: OpenAIService, // Assuming this is for LLM classification later
  ) {
    this.routerSpellcheck = this.configService.get<string>('ROUTER_SPELLCHECK') === 'true';
    this.logger.log({ level: 'info', message: `QueryRouterService initialized. Spellcheck enabled: ${this.routerSpellcheck}` });
  }

  async onModuleInit() {
    this.logger.log({ level: 'info', message: 'QueryRouterService onModuleInit called.' });
    if (this.routerSpellcheck) {
      try {
        const settings = await cspellLib.getDefaultSettings();
        this.logger.debug('Successfully pre-loaded cspell default settings during init.', { settings });
      } catch (error) {
        this.logger.error('Failed to pre-load cspell default settings during init:', { error });
      }
    }
  }

  /**
   * Preprocesses the user query for consistent processing.
   * Includes trimming, lowercasing, and optional spell-checking.
   * @param rawQuery The original user query string.
   * @returns A PreprocessedQuery object.
   */
  public async preprocess(rawQuery: string): Promise<PreprocessedQuery> {
    if (!rawQuery) {
      return {
        originalQuery: '',
        normalizedQuery: '',
      };
    }

    let normalizedQuery = rawQuery.trim().toLowerCase();

    // If the normalized query is empty (e.g., input was only spaces), return early.
    if (!normalizedQuery) {
      this.logger.debug('Normalized query is empty, skipping spellcheck.');
      return {
        originalQuery: rawQuery,
        normalizedQuery,
      };
    }

    if (this.routerSpellcheck) {
      try {
        const settings = await cspellLib.getDefaultSettings();
        const languageSettings = cspellLib.combineTextAndLanguageSettings(settings, '', 'en');
        const finalCSpellSettings = cspellLib.finalizeSettings(languageSettings);

        this.logger.debug('CSpell settings loaded:', { finalCSpellSettings });

        const issues: ValidationIssue[] = await cspellLib.validateText(normalizedQuery, finalCSpellSettings);

        if (issues.length > 0) {
          let correctedQuery = normalizedQuery;
          // Apply corrections in reverse order to maintain correct offsets
          for (let i = issues.length - 1; i >= 0; i--) {
            const issue = issues[i];
            if (issue.suggestions && issue.suggestions.length > 0) {
              const firstSuggestion = issue.suggestions[0];
              let firstSuggestionText: string;

              if (typeof firstSuggestion === 'string') {
                firstSuggestionText = firstSuggestion;
              } else if (typeof firstSuggestion === 'object' && firstSuggestion !== null && 'word' in firstSuggestion) {
                firstSuggestionText = (firstSuggestion as CSpellSuggestion).word;
              } else {
                this.logger.warn(`Unexpected suggestion format for "${issue.text}" at offset ${issue.offset}, skipping.`);
                continue; // Skip this issue
              }

              if (issue.text.toLowerCase() !== firstSuggestionText.toLowerCase()) {
                correctedQuery =
                  correctedQuery.substring(0, issue.offset) +
                  firstSuggestionText +
                  correctedQuery.substring(issue.offset + issue.text.length);
              }
            }
          }
          normalizedQuery = correctedQuery;
        }
      } catch (error) {
        this.logger.error('Error during spellchecking:', error);
        // Fallback to original normalized query if spellcheck fails
      }
    }

    return {
      originalQuery: rawQuery,
      normalizedQuery,
    };
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
          path: QueryProcessingPath.ANALYTICAL_TASK,
          confidence: 0.75,
          explanation: 'Query contains analytical keywords that suggest code execution is needed',
          requiresVisualization: containsVisualizationKeywords
        };
      } else {
        return {
          path: QueryProcessingPath.DIRECT_RETRIEVAL,
          confidence: 0.8,
          explanation: 'Query appears to be information-seeking, routing to direct retrieval',
          requiresVisualization: containsVisualizationKeywords
        };
      }
    } catch (error) {
      this.logger.error(`Error routing query: ${error}`);
      
      // Default to direct retrieval as a fallback
      return {
        path: QueryProcessingPath.DIRECT_RETRIEVAL,
        confidence: 0.5,
        explanation: 'Error occurred during routing, defaulting to direct retrieval',
        requiresVisualization: false
      };
    }
  }
} 