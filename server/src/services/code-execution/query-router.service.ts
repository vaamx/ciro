import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, ChatMessage } from '../ai/openai.service';
import { PreprocessedQuery, HeuristicOutput, LLMClassificationOutput, LLMClassification } from '../../types/router.types';
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
  private readonly routerModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly openAIService: OpenAIService, // Assuming this is for LLM classification later
  ) {
    this.routerSpellcheck = this.configService.get<string>('ROUTER_SPELLCHECK') === 'true';
    this.routerModel = this.configService.get<string>('ROUTER_MODEL') || 'o4-mini-2025-04-16'; // Changed default
    this.logger.log({ level: 'info', message: `QueryRouterService initialized. Spellcheck enabled: ${this.routerSpellcheck}, Router Model: ${this.routerModel}` });
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

  private getLLMClassificationPromptTemplate(): string {
    return `\
You are an intelligent query classification assistant. Your task is to analyze a user's query and the output of an initial heuristic analysis, and then classify the primary intent of the query.

You must classify the query into one of three categories:
1.  'direct_retrieval': Queries asking for factual information, summaries, explanations of documents, or general knowledge that can likely be answered by retrieving and synthesizing existing text.
2.  'analytical_task': Queries that require data analysis, calculations, code generation (e.g., SQL, Python), data manipulation, or the creation of visualizations (charts, graphs).
3.  'clarification_needed': Queries that are too ambiguous, vague, or lack sufficient information to be confidently routed to either direct retrieval or an analytical task.

You will be provided with:
1.  The user's preprocessed query.
2.  The output of a heuristic analysis, which includes:
    - isAnalyticalIntent: boolean (true if heuristic analysis detected analytical keywords)
    - isRetrievalIntent: boolean (true if heuristic analysis detected retrieval keywords)
    - requestsVisualization: boolean (true if visualization keywords were detected)
    - mentionsDataset: boolean (true if dataset mentions were detected)
    - mentionsCode: boolean (true if code mentions were detected)
    - analyticalScore: number (0-1, heuristic score for analytical intent)
    - retrievalScore: number (0-1, heuristic score for retrieval intent)

Based on ALL this information, determine the most appropriate classification.

Consider the following examples:

Example 1 (Direct Retrieval):
User Query: "What were the main findings of the Q3 financial report?"
Heuristics: { isAnalyticalIntent: false, isRetrievalIntent: true, requestsVisualization: false, mentionsDataset: true, mentionsCode: false, analyticalScore: 0.1, retrievalScore: 0.8 }
Output:
{
  "classification": "direct_retrieval",
  "confidence": 0.9,
  "llmReasoning": "The query asks for specific findings from a report, indicating a need to retrieve and summarize information."
}

Example 2 (Analytical Task - Code Gen):
User Query: "Generate SQL to find all users in the 'customers' table who signed up last month and live in California."
Heuristics: { isAnalyticalIntent: true, isRetrievalIntent: false, requestsVisualization: false, mentionsDataset: true, mentionsCode: true, analyticalScore: 0.9, retrievalScore: 0.2 }
Output:
{
  "classification": "analytical_task",
  "confidence": 0.95,
  "llmReasoning": "The query explicitly asks for SQL generation, which is an analytical task involving code."
}

Example 3 (Analytical Task - Visualization):
User Query: "Plot the monthly sales trend for product X over the last year."
Heuristics: { isAnalyticalIntent: true, isRetrievalIntent: false, requestsVisualization: true, mentionsDataset: true, mentionsCode: false, analyticalScore: 0.85, retrievalScore: 0.1 }
Output:
{
  "classification": "analytical_task",
  "confidence": 0.9,
  "llmReasoning": "The query requests a plot (visualization) of sales data, clearly an analytical task."
}

Example 4 (Clarification Needed):
User Query: "Tell me about the data."
Heuristics: { isAnalyticalIntent: false, isRetrievalIntent: true, requestsVisualization: false, mentionsDataset: true, mentionsCode: false, analyticalScore: 0.3, retrievalScore: 0.6 }
Output:
{
  "classification": "clarification_needed",
  "confidence": 0.8,
  "llmReasoning": "The query is too vague. 'The data' is not specific enough to determine if the user wants a summary or an analysis."
}

Example 5 (Mixed, but leans Analytical):
User Query: "Explain the performance metrics for our new feature and calculate the week-over-week growth."
Heuristics: { isAnalyticalIntent: true, isRetrievalIntent: true, requestsVisualization: false, mentionsDataset: true, mentionsCode: false, analyticalScore: 0.7, retrievalScore: 0.5 }
Output:
{
  "classification": "analytical_task",
  "confidence": 0.75,
  "llmReasoning": "While it asks for an explanation (retrieval), the core task is to calculate week-over-week growth, which is analytical. The analytical aspect takes precedence for routing."
}

You MUST respond with a JSON object matching the following TypeScript interface:
interface LLMClassificationOutput {
  classification: 'direct_retrieval' | 'analytical_task' | 'clarification_needed';
  confidence: number; // A score between 0.0 and 1.0
  llmReasoning?: string; // Your brief explanation for the classification
}

Current Query and Heuristics:
User Query: "{userQuery}"
Heuristics: {heuristicOutput}

Your JSON Output:
`;
  }

  /**
   * Uses an LLM to classify the query based on preprocessed query and heuristic output.
   * @param preprocessedQuery The preprocessed user query.
   * @param heuristicOutput The output from the heuristic analysis.
   * @returns LLMClassificationOutput or null if an error occurs.
   */
  public async llmClassify(
    preprocessedQuery: PreprocessedQuery,
    heuristicOutput: HeuristicOutput,
  ): Promise<LLMClassificationOutput | null> {
    this.logger.info('Performing LLM classification for query:', { originalQuery: preprocessedQuery.originalQuery });

    const promptTemplate = this.getLLMClassificationPromptTemplate();
    const systemPrompt = promptTemplate
      .replace('{userQuery}', preprocessedQuery.normalizedQuery)
      .replace('{heuristicOutput}', JSON.stringify(heuristicOutput));
      
    // The prompt template itself becomes the system message, guiding the LLM.
    // The "user" message in this context is a placeholder to trigger the LLM to follow instructions.
    // A more accurate user message for the LLM would be the actual user query.
    // However, the full context (query + heuristics) is already in the system prompt.
    // For this pattern, the user query is embedded in the detailed system prompt.

    const messages: ChatMessage[] = [
      // The detailed prompt template is the system message.
      {
        id: 'system-' + Date.now(),
        role: 'system',
        content: systemPrompt,
        timestamp: Date.now(),
        status: 'complete',
      },
      // A minimal user message to trigger the LLM based on the system prompt.
      // The actual user query is already part of the system_prompt.
      {
        id: 'user-' + Date.now(),
        role: 'user',
        content: "Based on the information I provided in the system prompt (user query and heuristics), please provide your JSON output.",
        timestamp: Date.now(),
        status: 'complete',
      },
    ];

    try {
      const llmResponse = await this.openAIService.generateChatCompletion(messages, {
        model: this.routerModel,
        temperature: 0.1, // Low temperature for more deterministic classification
        // systemPrompt is already part of the messages array.
      });

      // Define an interface for the expected structure of responseData
      interface LLMResponseData {
        id: string;
        role: 'assistant' | 'error';
        content: string;
        timestamp: number;
        status: 'complete' | 'error';
        metadata?: {
          model?: string;
          tokens?: {
            prompt: number;
            completion: number;
            total: number;
          };
        };
      }

      const responseData = await llmResponse.json() as LLMResponseData;
      
      this.logger.debug('Raw LLM response for classification:', { responseData });

      if (responseData && responseData.content) {
        // Attempt to parse the content, which should be a JSON string
        // The LLM's response might sometimes include markdown ```json ... ```, so we try to extract it.
        let jsonString = responseData.content;
        const jsonMatch = jsonString.match(/```json\\n([\s\S]*?)\\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1];
        }
        
        jsonString = jsonString.trim(); // Trim whitespace

        try {
          const parsedOutput: LLMClassificationOutput = JSON.parse(jsonString);

          // Validate the parsed output
          if (
            parsedOutput &&
            typeof parsedOutput.classification === 'string' &&
            ['direct_retrieval', 'analytical_task', 'clarification_needed'].includes(parsedOutput.classification) &&
            typeof parsedOutput.confidence === 'number' &&
            parsedOutput.confidence >= 0 &&
            parsedOutput.confidence <= 1 &&
            (parsedOutput.llmReasoning === undefined || typeof parsedOutput.llmReasoning === 'string')
          ) {
            this.logger.info('LLM Classification successful:', { parsedOutput });
            return parsedOutput;
          } else {
            this.logger.error('LLM response content failed validation:', { jsonString, parsedOutput });
            return null;
          }
        } catch (parseError) {
          this.logger.error('Error parsing LLM JSON response for classification:', { error: parseError, content: responseData.content });
          return null;
        }
      } else {
        this.logger.error('LLM response did not contain content for classification.', { responseData });
        return null;
      }
    } catch (error) {
      this.logger.error('Error during LLM classification API call:', { error });
      return null;
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