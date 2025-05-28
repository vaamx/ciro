import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { LLMService, ChatMessage } from '../llm';
import { PreprocessedQuery, HeuristicOutput, LLMClassificationOutput, RouterDecision } from '../../types/router.types';
import { QueryAnalysisService } from '../analysis/query-analysis.service';
import { AnalyticalRAGService, AnalyticalResponse } from '../rag/analytical-rag.service';
// Temporarily disabled cspell-lib imports due to compatibility issues
// import {
//   validateText,
//   getDefaultSettings,
//   combineTextAndLanguageSettings,
//   finalizeSettings,
//   type ValidationIssue,
// } from 'cspell-lib';

// Import cspell-lib for its actual functions, which will be mocked by Jest for tests
// import * as cspellLib from 'cspell-lib';

// Mock ValidationIssue type
interface ValidationIssue {
  text: string;
  offset: number;
  length: number;
  suggestions?: any[];
}

// Minimal local interface to represent cspell-lib's Suggestion structure
interface CSpellSuggestion {
  word: string;
  isPreferred?: boolean;
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
  private readonly routerConfHigh: number;
  private readonly routerConfMid: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmService: LLMService,
    private readonly queryAnalysisService: QueryAnalysisService,
    private readonly analyticalRAGService: AnalyticalRAGService,
  ) {
    this.routerSpellcheck = this.configService.get<string>('ROUTER_SPELLCHECK') === 'true';
    this.routerModel = this.configService.get<string>('ROUTER_MODEL') || 'gpt-4o-mini';
    this.routerConfHigh = parseFloat(this.configService.get<string>('ROUTER_CONF_HIGH') || '0.85');
    this.routerConfMid = parseFloat(this.configService.get<string>('ROUTER_CONF_MID') || '0.65');
    this.logger.log({
      level: 'info',
      message: `QueryRouterService initialized with LLM abstraction layer. Spellcheck: ${this.routerSpellcheck}, Model: ${this.routerModel}, HighConf: ${this.routerConfHigh}, MidConf: ${this.routerConfMid}`,
    });
  }

  async onModuleInit() {
    this.logger.log({ level: 'info', message: 'QueryRouterService onModuleInit called.' });
    if (this.routerSpellcheck) {
      this.logger.warn('Spell checking is temporarily disabled due to cspell-lib compatibility issues');
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

    // --- Start: Contraction Expansion ---
    const contractionsMap: { [key: string]: string } = {
      "ain't": "am not", // or "are not", "is not", "has not", "have not"
      "aren't": "are not",
      "can't": "cannot",
      "can't've": "cannot have",
      "'cause": "because",
      "could've": "could have",
      "couldn't": "could not",
      "couldn't've": "could not have",
      "didn't": "did not",
      "doesn't": "does not",
      "don't": "do not",
      "hadn't": "had not",
      "hadn't've": "had not have",
      "hasn't": "has not",
      "haven't": "have not",
      "he'd": "he would", // or "he had"
      "he'd've": "he would have",
      "he'll": "he will",
      "he'll've": "he will have",
      "he's": "he is", // or "he has"
      "how'd": "how did",
      "how'd'y": "how do you",
      "how'll": "how will",
      "how's": "how is", // or "how has", "how does"
      "i'd": "i would", // or "i had"
      "i'd've": "i would have",
      "i'll": "i will",
      "i'll've": "i will have",
      "i'm": "i am",
      "i've": "i have",
      "isn't": "is not",
      "it'd": "it would", // or "it had"
      "it'd've": "it would have",
      "it'll": "it will",
      "it'll've": "it will have",
      "it's": "it is", // or "it has"
      "let's": "let us",
      "ma'am": "madam",
      "mayn't": "may not",
      "might've": "might have",
      "mightn't": "might not",
      "mightn't've": "might not have",
      "must've": "must have",
      "mustn't": "must not",
      "mustn't've": "must not have",
      "needn't": "need not",
      "needn't've": "need not have",
      "o'clock": "of the clock",
      "shan't": "shall not",
      "sha'n't": "shall not", // alternative spelling
      "shan't've": "shall not have",
      "she'd": "she would", // or "she had"
      "she'd've": "she would have",
      "she'll": "she will",
      "she'll've": "she will have",
      "she's": "she is", // or "she has"
      "should've": "should have",
      "shouldn't": "should not",
      "shouldn't've": "should not have",
      "so've": "so have",
      "so's": "so is", // or "so as"
      "that'd": "that would", // or "that had"
      "that'd've": "that would have",
      "that's": "that is", // or "that has"
      "there'd": "there would", // or "there had"
      "there'd've": "there would have",
      "there's": "there is", // or "there has"
      "they'd": "they would", // or "they had"
      "they'd've": "they would have",
      "they'll": "they will",
      "they'll've": "they will have",
      "they're": "they are",
      "they've": "they have",
      "to've": "to have",
      "wasn't": "was not",
      "we'd": "we would", // or "we had"
      "we'd've": "we would have",
      "we'll": "we will",
      "we'll've": "we will have",
      "we're": "we are",
      "we've": "we have",
      "weren't": "were not",
      "what'll": "what will",
      "what'll've": "what will have",
      "what're": "what are",
      "what's": "what is", // or "what has", "what does"
      "what've": "what have",
      "when's": "when is", // or "when has"
      "when've": "when have",
      "where'd": "where did",
      "where's": "where is", // or "where has"
      "where've": "where have",
      "who'll": "who will",
      "who'll've": "who will have",
      "who's": "who is", // or "who has"
      "who've": "who have",
      "why's": "why is", // or "why has"
      "why've": "why have",
      "will've": "will have",
      "won't": "will not",
      "won't've": "will not have",
      "would've": "would have",
      "wouldn't": "would not",
      "wouldn't've": "would not have",
      "y'all": "you all",
      "y'all'd": "you all would",
      "y'all'd've": "you all would have",
      "y'all're": "you all are",
      "y'all've": "you all have",
      "you'd": "you would", // or "you had"
      "you'd've": "you would have",
      "you'll": "you will",
      "you'll've": "you will have",
      "you're": "you are",
      "you've": "you have"
    };

    // Create a regex to match all contractions
    // Word boundaries are important to avoid matching parts of words
    const contractionRegex = new RegExp(`\\b(${Object.keys(contractionsMap).sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
    normalizedQuery = normalizedQuery.replace(contractionRegex, match => contractionsMap[match]);
    // --- End: Contraction Expansion ---

    // --- Start: Punctuation Normalization ---
    // Replace multiple spaces with a single space (might occur after contraction expansion)
    normalizedQuery = normalizedQuery.replace(/\s+/g, ' ').trim();

    // Standardize ellipses to a single space, then trim if it results in trailing space
    normalizedQuery = normalizedQuery.replace(/\.{2,}/g, ' ').trim();

    // Reduce multiple consecutive identical sentence-ending punctuation marks (e.g., "!!!" to "!")
    normalizedQuery = normalizedQuery.replace(/([!?])\1+/g, '$1');

    // Reduce multiple commas, semicolons, colons
    normalizedQuery = normalizedQuery.replace(/([,;:])\1+/g, '$1');

    // Remove leading/trailing decorative punctuation from words, but try to preserve sentence structure.
    // This is tricky. Let's focus on common wrappers and be less aggressive with general \p{P}\p{S}
    normalizedQuery = normalizedQuery.split(' ').map(part => {
      if (!part) return ''; // Handle empty parts if they occur

      // Preserve URLs or paths by checking for common patterns.
      if (part.match(/^(https?:\/\/|www\.|[a-zA-Z0-9._%+-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)$/i)) {
        return part;
      }
      // Preserve mentions or hashtags
      if (part.match(/^[@#][a-zA-Z0-9_]+$/)) {
        return part;
      }

      // More carefully remove leading/trailing punctuation. 
      // This regex targets common wrapping punctuation like quotes, brackets, asterisks.
      // It tries to be careful about not removing sentence-ending periods if they are part of the word itself (e.g. acronyms)
      // but this is difficult to do perfectly with regex alone without more context.
      
      // Iteratively remove common leading/trailing pairs or single decorative characters
      let oldPart;
      do {
        oldPart = part;
        // Common pairs (quotes, brackets)
        if ((part.startsWith('"') && part.endsWith('"')) || 
            (part.startsWith("'") && part.endsWith("'")) || 
            (part.startsWith('(') && part.endsWith(')')) || 
            (part.startsWith('[') && part.endsWith(']')) || 
            (part.startsWith('{') && part.endsWith('}'))) {
          if (part.length > 1) part = part.substring(1, part.length - 1);
        }
        // Common leading/trailing single characters (e.g., asterisks for emphasis)
        if ((part.startsWith('*') && part.endsWith('*')) && part.length > 1 && !part.substring(1, part.length-1).includes('*')) {
            part = part.substring(1, part.length -1);
        }
        // Individual leading punctuation (be more selective)
        if (part.match(/^[*_(\[{\"]/) && part.length > 0) part = part.substring(1);
        // Individual trailing punctuation (be more selective) - crucial not to remove sentence enders like period from last word here
        // This part is tricky: if a word ends with ',', ';', ':', '.', '?', '!', we might want to keep it for now
        // and handle sentence-level punctuation later if needed. The current regex below is very aggressive.
        // For now, we will rely on the earlier specific multiple punctuation reduction for !, ?
        // and only trim very specific trailing characters if they are common wrappers and not likely sentence enders.
        if (part.match(/[*_)\\]}\"]$/) && part.length > 0) part = part.substring(0, part.length -1);

      } while (part !== oldPart && part.length > 0);

      // Final check: if the part still ends with a single quote character after the loop,
      // and it's not the only character in the part (to avoid turning "\"" into ""), remove it.
      // This is a targeted fix for stubborn trailing quotes.
      if (part.length > 1 && part.endsWith('"')) {
        part = part.substring(0, part.length - 1);
      }
      // also for single quotes
      if (part.length > 1 && part.endsWith("'")) {
        part = part.substring(0, part.length - 1);
      }

      return part;
    }).filter(p => p).join(' '); // filter(p=>p) removes empty strings from array before join
    
    // Final trim for any leading/trailing spaces that might have been introduced or left over.
    normalizedQuery = normalizedQuery.trim();

    // Special handling for sentence-final period if it got detached or to ensure it's there if appropriate.
    // This is heuristic. If the original raw query ended with a period, and the normalized one doesn't, but is not empty,
    // and doesn't end with another sentence terminator like ? or !, add a period.
    // This step is commented out as it can be overly aggressive and might add periods where not intended.
    // if (rawQuery.endsWith('.') && normalizedQuery && !normalizedQuery.match(/[.?!]$/)) {
    //   normalizedQuery += '.';
    // }

    // --- End: Punctuation Normalization ---

    // If the normalized query is empty after all processing, return early.
    if (!normalizedQuery) {
      this.logger.debug('Normalized query is empty, skipping spellcheck.');
      return {
        originalQuery: rawQuery,
        normalizedQuery,
      };
    }

    if (this.routerSpellcheck) {
      this.logger.debug('Spell checking is disabled due to cspell-lib compatibility issues');
      // Spell checking functionality temporarily disabled
      // normalizedQuery remains unchanged
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
      },
      // A minimal user message to trigger the LLM based on the system prompt.
      // The actual user query is already part of the system_prompt.
      {
        id: 'user-' + Date.now(),
        role: 'user',
        content: "Based on the information I provided in the system prompt (user query and heuristics), please provide your JSON output.",
        timestamp: Date.now(),
      },
    ];

    try {
      const llmResponse = await this.llmService.generateChatCompletion(messages, {
        model: this.routerModel,
        temperature: 0.1, // Low temperature for more deterministic classification
        // systemPrompt is already part of the messages array.
      });

      this.logger.debug('Raw LLM response for classification:', { content: llmResponse.content });

      if (llmResponse && llmResponse.content) {
        // Attempt to parse the content, which should be a JSON string
        // The LLM's response might sometimes include markdown ```json ... ```, so we try to extract it.
        let jsonString = llmResponse.content;
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
          this.logger.error('Error parsing LLM JSON response for classification:', { error: parseError, content: llmResponse.content });
          return null;
        }
      } else {
        this.logger.error('LLM response did not contain content for classification.', { response: llmResponse });
        return null;
      }
    } catch (error) {
      this.logger.error('Error during LLM classification API call:', { error });
      return null;
    }
  }

  /**
   * Orchestrates the entire query routing process.
   * @param rawQuery The original user query.
   * @returns A Promise resolving to the RouterDecision.
   */
  public async determineRoute(rawQuery: string): Promise<RouterDecision> {
    this.logger.info('Starting query routing process for:', { rawQuery });

    const preprocessedQuery = await this.preprocess(rawQuery);
    this.logger.debug('Query preprocessed:', { preprocessedQuery });

    const heuristicOutput = await this.queryAnalysisService.runHeuristics(
      preprocessedQuery,
    );
    this.logger.debug('Heuristic analysis complete:', { heuristicOutput });

    let llmOutput: LLMClassificationOutput | null = null;

    // Determine if LLM classification is needed
    const { analyticalScore, retrievalScore } = heuristicOutput;
    const scoreDifference = Math.abs(analyticalScore - retrievalScore);
    const maxScore = Math.max(analyticalScore, retrievalScore);

    // Conditions to trigger LLM classification:
    // 1. Heuristic scores are too close (ambiguous).
    // 2. The highest heuristic score is below a mid-confidence threshold.
    // 3. Both scores are very low.
    const isAmbiguous = scoreDifference < 0.2; // Example: scores are 0.5 and 0.6
    const isLowConfidence = maxScore < this.routerConfMid; // Example: highest score is 0.6, midConf is 0.65
    const bothScoresLow = analyticalScore < 0.3 && retrievalScore < 0.3; // Example: 0.2 and 0.1

    if (isAmbiguous || isLowConfidence || bothScoresLow) {
      this.logger.info('Heuristics ambiguous or low confidence, proceeding with LLM classification.', {
        isAmbiguous,
        isLowConfidence,
        bothScoresLow,
        analyticalScore,
        retrievalScore,
      });
      llmOutput = await this.llmClassify(preprocessedQuery, heuristicOutput);
      this.logger.debug('LLM classification complete:', { llmOutput });
    } else {
      this.logger.info('Heuristics are sufficiently confident, skipping LLM classification.', {
        analyticalScore,
        retrievalScore,
      });
    }

    const decision = await this.combineAndFinalizeDecision(
      preprocessedQuery,
      heuristicOutput,
      llmOutput,
    );
    this.logger.info('Final routing decision:', { decision });

    await this.persistLog(rawQuery, decision);

    return decision;
  }

  /**
   * Execute an analytical query using the AnalyticalRAGService
   * @param sessionId Session ID for the sandbox
   * @param query The user query
   * @param context Optional context for the query
   * @returns Promise resolving to the analytical response
   */
  public async executeAnalyticalQuery(
    sessionId: string,
    query: string,
    context?: string
  ): Promise<AnalyticalResponse> {
    this.logger.info('Executing analytical query', { sessionId, query });
    
    try {
      const result = await this.analyticalRAGService.processAnalyticalQuery(sessionId, query, context);
      this.logger.info('Analytical query completed', { 
        sessionId, 
        success: result.success, 
        executionTime: result.executionTime,
        artifactsCount: result.artifacts.length 
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to execute analytical query', { sessionId, query, error });
      throw error;
    }
  }

  /**
   * Combines heuristic and LLM outputs to make a final routing decision.
   * @param preprocessedQuery The preprocessed query.
   * @param heuristicOutput The output from heuristic analysis.
   * @param llmOutput The output from LLM classification (can be null).
   * @returns A Promise resolving to the RouterDecision.
   */
  private async combineAndFinalizeDecision(
    preprocessedQuery: PreprocessedQuery,
    heuristicOutput: HeuristicOutput,
    llmOutput: LLMClassificationOutput | null,
  ): Promise<RouterDecision> {
    this.logger.debug('Combining heuristic and LLM outputs...', { preprocessedQuery, heuristicOutput, llmOutput, routerConfHigh: this.routerConfHigh, routerConfMid: this.routerConfMid });

    // Path determination logic
    let chosenPath: RouterDecision['chosenPath'] = 'user_clarification_needed';
    let confidence: number | undefined = undefined;
    let reasoning = 'Defaulting to user clarification due to ambiguity or low confidence.';

    if (llmOutput) {
      // High confidence LLM decision
      if (llmOutput.confidence >= this.routerConfHigh) {
        reasoning = `High confidence LLM classification (${llmOutput.classification}). ` + (llmOutput.llmReasoning || 'LLM provided decisive classification.');
        confidence = llmOutput.confidence;
        if (llmOutput.classification === 'analytical_task') chosenPath = 'analytical_rag';
        else if (llmOutput.classification === 'direct_retrieval') chosenPath = 'direct_vector_rag';
        else chosenPath = 'user_clarification_needed'; // clarification_needed from LLM
      } 
      // Mid confidence LLM - consider heuristics
      else if (llmOutput.confidence >= this.routerConfMid) {
        reasoning = `Medium confidence LLM classification (${llmOutput.classification}), considering heuristics. ` + (llmOutput.llmReasoning || '');
        confidence = llmOutput.confidence; 
        // If LLM says analytical, and heuristics agree or are neutral
        if (llmOutput.classification === 'analytical_task' && heuristicOutput.analyticalScore >= heuristicOutput.retrievalScore) {
          chosenPath = 'analytical_rag';
          reasoning += ' LLM analytical favored, heuristics align or neutral.';
        }
        // If LLM says retrieval, and heuristics agree or are neutral
        else if (llmOutput.classification === 'direct_retrieval' && heuristicOutput.retrievalScore >= heuristicOutput.analyticalScore) {
          chosenPath = 'direct_vector_rag';
          reasoning += ' LLM retrieval favored, heuristics align or neutral.';
        }
        // If LLM says clarification, or heuristics strongly conflict, or LLM and heuristics point different ways with similar strength
        else if (llmOutput.classification === 'clarification_needed' || 
                 (llmOutput.classification === 'analytical_task' && heuristicOutput.retrievalScore > heuristicOutput.analyticalScore + 0.2) ||
                 (llmOutput.classification === 'direct_retrieval' && heuristicOutput.analyticalScore > heuristicOutput.retrievalScore + 0.2) ){
          chosenPath = 'user_clarification_needed';
          reasoning += ' LLM/Heuristic conflict or LLM requests clarification.';
        } else { // LLM is mid confidence, heuristics are not strongly conflicting but not perfectly aligned
          if (llmOutput.classification === 'analytical_task') chosenPath = 'analytical_rag';
          else if (llmOutput.classification === 'direct_retrieval') chosenPath = 'direct_vector_rag';
          else chosenPath = 'user_clarification_needed';
          reasoning += ' Defaulting to LLM mid-confidence path due to lack of strong heuristic counter-signal.';
        }
      } 
      // Low confidence LLM - rely more on heuristics or clarify
      else {
        reasoning = `Low confidence LLM classification (${llmOutput.classification}), relying more on heuristics. ` + (llmOutput.llmReasoning || '');
        // If heuristics are strong, use them
        if (heuristicOutput.analyticalScore > this.routerConfHigh && heuristicOutput.analyticalScore > heuristicOutput.retrievalScore) {
          chosenPath = 'analytical_rag';
          confidence = heuristicOutput.analyticalScore;
          reasoning += ' Strong heuristic analytical signal overrides low-confidence LLM.';
        } else if (heuristicOutput.retrievalScore > this.routerConfHigh && heuristicOutput.retrievalScore > heuristicOutput.analyticalScore) {
          chosenPath = 'direct_vector_rag';
          confidence = heuristicOutput.retrievalScore;
          reasoning += ' Strong heuristic retrieval signal overrides low-confidence LLM.';
        } else {
          chosenPath = 'user_clarification_needed';
          reasoning += ' Neither LLM nor heuristics provide strong signal.';
          confidence = Math.max(heuristicOutput.analyticalScore, heuristicOutput.retrievalScore, llmOutput.confidence); // Use max of weak signals
        }
      }
    } 
    // No LLM output - rely solely on heuristics
    else if (heuristicOutput) {
      reasoning = 'No LLM output available, decision based solely on heuristics.';
      if (heuristicOutput.analyticalScore >= this.routerConfMid && heuristicOutput.analyticalScore > heuristicOutput.retrievalScore) {
        chosenPath = 'analytical_rag';
        confidence = heuristicOutput.analyticalScore;
        reasoning += ' Heuristic analytical score is moderate to high.';
      } else if (heuristicOutput.retrievalScore >= this.routerConfMid && heuristicOutput.retrievalScore > heuristicOutput.analyticalScore) {
        chosenPath = 'direct_vector_rag';
        confidence = heuristicOutput.retrievalScore;
        reasoning += ' Heuristic retrieval score is moderate to high.';
      } else {
        chosenPath = 'user_clarification_needed';
        reasoning += ' Heuristic scores are low or ambiguous.';
        confidence = Math.max(heuristicOutput.analyticalScore, heuristicOutput.retrievalScore);
      }
    }
    // No LLM and No Heuristic (should not happen if preprocess returns valid query for heuristics)
    else {
      reasoning = 'Critical error: No heuristic or LLM output available. Defaulting to user clarification.';
      chosenPath = 'user_clarification_needed';
      confidence = 0.1; // Very low confidence
    }

    return {
      chosenPath,
      confidence,
      reasoning,
      details: {
        heuristics: heuristicOutput,
        llm_classification: llmOutput,
      },
    };
  }

  /**
   * Persists the routing decision and related details for logging/auditing.
   * @param rawQuery The original raw query.
   * @param decision The final router decision.
   */
  private async persistLog(rawQuery: string, decision: RouterDecision): Promise<void> {
    // For now, we log to the standard service logger with a specific message.
    // In a production system, this might write to a dedicated audit log, database, or a specialized logging service.
    this.logger.log({
      level: 'info', // Or 'debug' if it's too verbose for info in production
      message: 'RoutingDecisionPersisted', // A specific keyword for easy filtering
      rawQuery: rawQuery,
      decision: decision, // The logger should handle object serialization
      // decisionStringified: JSON.stringify(decision) // Optionally, stringify if preferred for certain log collectors
    });
    // No actual async operation here for now, so resolve immediately.
    return Promise.resolve();
  }
} 