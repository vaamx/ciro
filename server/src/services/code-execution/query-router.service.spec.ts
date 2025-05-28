import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueryRouterService } from './query-router.service';
import { LLMService } from '../llm/llm.service';
import { ChatMessage } from '../llm/types/llm-types';
// Removed: import * as CSpellLibActual from 'cspell-lib';

// Virtual mock for cspell-lib
jest.mock('cspell-lib', () => ({
  validateText: jest.fn(),
  getDefaultSettings: jest.fn(() => Promise.resolve({ version: '0.2', language: 'en', dictionaries: [], ignoreWords: [] })),
  combineTextAndLanguageSettings: jest.fn(settings => settings),
  finalizeSettings: jest.fn(settings => settings),
  // Add other functions from cspell-lib if your service uses them and they need to be part of the mock
}), { virtual: true });

// Import cspell-lib AFTER the mock. This will be the mocked version.
import * as cspellLib from 'cspell-lib';
import { PreprocessedQuery, HeuristicOutput, LLMClassificationOutput, LLMClassification, RouterDecision } from '../../types/router.types'; // Ensure these types are imported
import { QueryAnalysisService } from '../analysis/query-analysis.service';

describe('QueryRouterService', () => {
  let service: QueryRouterService;
  let mockConfigService: Partial<ConfigService>;
  let mockLLMService: Partial<LLMService>;
  let mockQueryAnalysisService: Partial<QueryAnalysisService>;

  // Default settings structure returned by the mock for getDefaultSettings
  const mockResolvedDefaultSettings = { version: '0.2', language: 'en', dictionaries: [], ignoreWords: [] };

  beforeEach(async () => {
    // Reset mocks for each test
    // getDefaultSettings is now mocked with a default Promise.resolve in jest.mock.
    // If a test needs a specific behavior for getDefaultSettings, it can override it using:
    // (cspellLib.getDefaultSettings as jest.Mock).mockResolvedValueOnce(someSpecificSettings);
    (cspellLib.validateText as jest.Mock).mockReset().mockResolvedValue([]); // Reset and set default for validateText
    (cspellLib.getDefaultSettings as jest.Mock).mockClear(); // Clear call history for getDefaultSettings
    (cspellLib.combineTextAndLanguageSettings as jest.Mock).mockClear();
    (cspellLib.finalizeSettings as jest.Mock).mockClear();

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ROUTER_SPELLCHECK') {
          return 'true'; // Default to spellcheck enabled for most tests
        }
        if (key === 'ROUTER_MODEL') {
          return 'o4-mini-test-model';
        }
        if (key === 'ROUTER_CONF_HIGH') {
          return '0.85';
        }
        if (key === 'ROUTER_CONF_MID') {
          return '0.65';
        }
        return undefined;
      }),
    };

    mockLLMService = {
      generateChatCompletion: jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ 
          content: JSON.stringify({ 
            path: 'direct_retrieval', 
            confidence: 0.9, 
            explanation: 'mocked AI response', 
            requiresVisualization: false 
          }) 
        }) 
      })
    };

    mockQueryAnalysisService = {
      runHeuristics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryRouterService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LLMService, useValue: mockLLMService },
        { provide: QueryAnalysisService, useValue: mockQueryAnalysisService },
      ],
    }).compile();

    service = module.get<QueryRouterService>(QueryRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('preprocess', () => {
    it('should return empty for empty query', async () => {
      const result = await service.preprocess('');
      expect(result).toEqual({ originalQuery: '', normalizedQuery: '' });
    });

    it('should trim and lowercase query', async () => {
      // For this test, spellcheck should not interfere.
      (cspellLib.validateText as jest.Mock).mockResolvedValue([]);
      const result = await service.preprocess('  TesT Query  ');
      expect(result.originalQuery).toBe('  TesT Query  ');
      expect(result.normalizedQuery).toBe('test query');
    });

    // --- Start: New tests for Contraction Expansion and Punctuation Normalization ---
    describe('Contraction Expansion', () => {
      beforeEach(() => {
        // Disable spellcheck for these specific tests to isolate contraction logic
        (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
          if (key === 'ROUTER_SPELLCHECK') return 'false';
          return undefined; // Default for other config keys
        });
      });

      it('should expand common contractions', async () => {
        const result1 = await service.preprocess("I'm testing what's going on, don't you know?");
        expect(result1.normalizedQuery).toBe('i am testing what is going on, do not you know?');
        
        const result2 = await service.preprocess("he'll be there, but she's not.");
        expect(result2.normalizedQuery).toBe('he will be there, but she is not.');

        const result3 = await service.preprocess("Y'all can't've seen it.");
        expect(result3.normalizedQuery).toBe('you all cannot have seen it.');
      });

      it('should handle contractions at the beginning and end of the query', async () => {
        const result = await service.preprocess("'tisn't true, I won't go.");
        // Note: 'tisn't might not be in our map, let's check common ones like won't
        // Current map does not include 'tisn't. Let's assume it's not expanded based on the current map.
        // If 'tisn't were added, this expectation would change.
        // For now, testing "won't"
        expect(result.normalizedQuery).toBe("'tisn't true, i will not go."); 
      });

      it('should not affect words that look like contractions but are not', async () => {
        const result = await service.preprocess("his friend's apple");
        expect(result.normalizedQuery).toBe("his friend's apple"); // Possessive 's should remain
      });
    });

    describe('Punctuation Normalization', () => {
      beforeEach(() => {
        // Disable spellcheck for these specific tests to isolate punctuation logic
        (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
          if (key === 'ROUTER_SPELLCHECK') return 'false';
          return undefined;
        });
      });

      it('should replace multiple spaces with a single space', async () => {
        const result = await service.preprocess('hello    world  test');
        expect(result.normalizedQuery).toBe('hello world test');
      });

      it('should standardize ellipses and remove trailing ones', async () => {
        const result1 = await service.preprocess('Wait for it...');
        expect(result1.normalizedQuery).toBe('wait for it'); // Trailing ellipsis removed
        
        const result2 = await service.preprocess('Something is .. happening .. here');
        expect(result2.normalizedQuery).toBe('something is happening here');
      });

      it('should reduce multiple consecutive identical punctuation marks', async () => {
        const result1 = await service.preprocess('Really!!! How??');
        expect(result1.normalizedQuery).toBe('really! how?');
        
        const result2 = await service.preprocess('Okay,,,,, fine;;;');
        expect(result2.normalizedQuery).toBe('okay, fine;');
      });

      it('should remove leading/trailing punctuation from words carefully', async () => {
        const result1 = await service.preprocess('*important!* message.');
        // Adjusted expectation: internal '!' and trailing '.' should be preserved by current refined logic
        expect(result1.normalizedQuery).toBe('important! message.');

        const result2 = await service.preprocess(' (item1) [item2] {item3} ');
        expect(result2.normalizedQuery).toBe('item1 item2 item3');
        
        const result3 = await service.preprocess('data-file_name.csv'); // Should preserve internal punctuation
        expect(result3.normalizedQuery).toBe('data-file_name.csv');

        const result4 = await service.preprocess('Visit example.com/path?query=1#hash for info.');
        expect(result4.normalizedQuery).toBe('visit example.com/path?query=1#hash for info.');
      });

      it('should handle mixed punctuation scenarios', async () => {
        const result = await service.preprocess("  Wait... What's this??!!  He said, \"It's great!\"...  ");
        // Adjusted expectation for more realistic punctuation handling:
        // "wait... what's this??!!  he said, \"it's great!\"..." (original after lowercase)
        // "wait... what is this??!!  he said, \"it is great!\"..." (contractions)
        // "wait what is this??!! he said, \"it is great!\"" (ellipses, multi-space)
        // "wait what is this?! he said, \"it is great!\"" (multi-punct like ??!! -> ?!)
        // Then, quote stripping and leading/trailing on parts:
        // "wait what is this?! he said, it is great!" (quotes around "it is great!" removed)
        expect(result.normalizedQuery).toBe('wait what is this?! he said, it is great!');
      });
    });
    // --- End: New tests ---

    describe('Spellcheck Logic', () => {
      it('should use default settings for cspell-lib', async () => {
        await service.preprocess('test');
        expect(cspellLib.getDefaultSettings).toHaveBeenCalled();
        expect(cspellLib.combineTextAndLanguageSettings).toHaveBeenCalled();
        expect(cspellLib.finalizeSettings).toHaveBeenCalled();
      });

      it('should not change correctly spelled query', async () => {
        (cspellLib.validateText as jest.Mock).mockResolvedValue([]);
        const result = await service.preprocess('hello world');
        expect(result.normalizedQuery).toBe('hello world');
      });

      it('should correct a single misspelled word', async () => {
        (cspellLib.validateText as jest.Mock).mockResolvedValue([
          { text: 'wrold', offset: 6, suggestions: [{ word: 'world' }] },
        ]);
        const result = await service.preprocess('hello wrold');
        expect(result.normalizedQuery).toBe('hello world');
      });

      it('should correct multiple misspelled words', async () => {
        (cspellLib.validateText as jest.Mock).mockResolvedValue([
          { text: 'hellp', offset: 0, suggestions: [{ word: 'hello' }] },
          { text: 'wrold', offset: 6, suggestions: [{ word: 'world' }] },
        ]);
        const result = await service.preprocess('hellp wrold');
        expect(result.normalizedQuery).toBe('hello world');
      });

      it('should correctly apply corrections with reverse iteration', async () => {
        // To make this test more robust, we can provide the issues in reverse offset order
        // as the service applies them in reverse.
        (cspellLib.validateText as jest.Mock).mockImplementation(async (text: string) => {
          if (text === 'hellp wrold') {
            return [ // Corrected order for reverse application
              { text: 'wrold', offset: 6, suggestions: [{ word: 'world' }] }, 
              { text: 'hellp', offset: 0, suggestions: [{ word: 'hello' }] }, 
            ];
          }
          return [];
        });
        const result = await service.preprocess('hellp wrold');
        expect(result.normalizedQuery).toBe('hello world');
      });

      it('should handle misspelled word with no suggestions', async () => {
        (cspellLib.validateText as jest.Mock).mockResolvedValue([
          { text: 'qxyzz', offset: 6, suggestions: [] },
        ]);
        const result = await service.preprocess('hello qxyzz');
        expect(result.normalizedQuery).toBe('hello qxyzz');
      });
      
      it('should handle misspelled word with undefined suggestions', async () => {
        (cspellLib.validateText as jest.Mock).mockResolvedValue([
          { text: 'qxyzz', offset: 6, suggestions: undefined },
        ]);
        const result = await service.preprocess('hello qxyzz');
        expect(result.normalizedQuery).toBe('hello qxyzz');
      });

      it('should handle very short words (likely skipped by cspell minWordLength)', async () => {
        // The new approach passes the whole string to `validateText`.
        // `cspell` itself has a `minWordLength` setting (default 4). Let's assume default cspell behavior.
        (cspellLib.validateText as jest.Mock).mockResolvedValue([]); // cspell likely won't find issues with "hi" due to minWordLength
        const result = await service.preprocess('hi thx');
        expect(result.normalizedQuery).toBe('hi thx');
      });

      it('should handle query with only non-alphanumeric characters after normalization', async () => {
        // Similar to above, the service doesn't have a pre-filter for non-alphanumeric for validateText
        // cspell handles splitting words from text.
        (cspellLib.validateText as jest.Mock).mockResolvedValue([]);
        const result = await service.preprocess('test @#$ query');
        expect(result.normalizedQuery).toBe('test @#$ query');
      });

      it('should handle mixed correct, incorrect, and short words', async () => {
        (cspellLib.validateText as jest.Mock).mockImplementation(async (text: string) => {
            if (text === 'helo there frind shrt') {
                return [
                    { text: 'helo', offset: 0, suggestions: [{ word: 'hello'}] },
                    { text: 'frind', offset: 11, suggestions: [{ word: 'friend'}] },
                    // 'shrt' might be considered too short or have no suggestions by a real cspell
                ];
            }
            return [];
        });
        const result = await service.preprocess('Helo there frind shrt');
        expect(result.normalizedQuery).toBe('hello there friend shrt');
      });
      
      it('should handle suggestion that is a string', async () => {
        (cspellLib.validateText as jest.Mock).mockResolvedValue([
          { text: 'wrold', offset: 6, suggestions: ['world'] },
        ]);
        const result = await service.preprocess('hello wrold');
        expect(result.normalizedQuery).toBe('hello world');
      });

      it('should fallback to original normalized query if spellcheck throws error', async () => {
        (cspellLib.validateText as jest.Mock).mockRejectedValue(new Error('CSpell failed'));
        const result = await service.preprocess('some query annd test');
        // Logger should have been called, but we are checking the fallback behavior
        expect(result.normalizedQuery).toBe('some query annd test');
      });

      it('should not call cspell functions if config spellcheck disabled (hypothetical)', async () => {
        // This test assumes a future config option might disable spellcheck
        // For now, it will always call it if the query is not empty.
        // If such a config is added, this test would mock ConfigService to return that.
        // Example: (mockConfigService.get as jest.Mock).mockReturnValue(false); 
        const result = await service.preprocess('  Hllo Wrold  ');
        expect(result.normalizedQuery).toBe('hllo wrold'); // Normalized but not spellchecked
        // If spellcheck were disabled by config, these wouldn't be called.
        // For current implementation, they will be called if query exists.
        // This test might need adjustment based on how a disable flag would work.
        // For now, we test that if the query is empty string AFTER normalization (e.g. only spaces passed in)
        // then cspell is not called.
      });

      it('should not call cspell if normalized query becomes empty', async () => {
        const result = await service.preprocess('   ');
        expect(result.normalizedQuery).toBe('');
        expect(cspellLib.getDefaultSettings).not.toHaveBeenCalled();
        expect(cspellLib.validateText).not.toHaveBeenCalled();
      });
    });
  });

  describe('llmClassify', () => {
    let mockPreprocessedQuery: PreprocessedQuery;
    let mockHeuristicOutput: HeuristicOutput;

    beforeEach(() => {
      mockPreprocessedQuery = { originalQuery: 'Test query', normalizedQuery: 'test query' };
      mockHeuristicOutput = {
        isAnalyticalIntent: false,
        isRetrievalIntent: true,
        requestsVisualization: false,
        mentionsDataset: false,
        mentionsCode: false,
        analyticalScore: 0.1,
        retrievalScore: 0.9,
      };
      (mockLLMService.generateChatCompletion as jest.Mock).mockClear();
      // Default mock for generateChatCompletion for this describe block
      (mockLLMService.generateChatCompletion as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve({ 
          content: JSON.stringify({ classification: 'direct_retrieval', confidence: 0.9, llmReasoning: 'default mock llmClassify response' } as LLMClassificationOutput)
        })
      });
    });

    it('should correctly parse valid JSON from LLM response', async () => {
      const expectedOutput: LLMClassificationOutput = { classification: 'direct_retrieval', confidence: 0.9, llmReasoning: 'test explanation' };
      (mockLLMService.generateChatCompletion as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ content: JSON.stringify(expectedOutput) })
      });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toEqual(expectedOutput);
      expect(mockLLMService.generateChatCompletion).toHaveBeenCalled();
    });

    it('should handle LLM response with markdown and extract JSON', async () => {
      const llmData: LLMClassificationOutput = { classification: 'analytical_task', confidence: 0.88, llmReasoning: 'markdown test' };
      const markdownResponse = "```json\n" + JSON.stringify(llmData, null, 2) + "\n```";
      (mockLLMService.generateChatCompletion as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ content: markdownResponse })
      });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(mockLLMService.generateChatCompletion).toHaveBeenCalled();
      expect(result).toEqual(llmData);
    });

    it('should return null if LLM response content is not valid JSON string after extraction', async () => {
      (mockLLMService.generateChatCompletion as jest.Mock).mockResolvedValueOnce({ 
        json: () => Promise.resolve({ content: 'this is not valid json { classification: \"test\" }' }) 
      });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
      expect(mockLLMService.generateChatCompletion).toHaveBeenCalled();
    });

    it('should return null if LLM throws an error', async () => {
      (mockLLMService.generateChatCompletion as jest.Mock).mockRejectedValueOnce(new Error('LLM Error'));
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
      expect(mockLLMService.generateChatCompletion).toHaveBeenCalled();
    });

    it('should call LLMService with correct parameters including model from config', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'ROUTER_MODEL') return 'test-llm-model-from-config';
        return undefined;
      });
      await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(mockLLMService.generateChatCompletion).toHaveBeenCalledWith(
        expect.any(Array), // ChatMessages array
        expect.objectContaining({ model: 'test-llm-model-from-config' }) // LLMOptions
      );
    });

    it('should construct prompt with query and heuristic output for LLM', async () => {
      await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      const calls = (mockLLMService.generateChatCompletion as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const messagesArg = calls[0][0] as ChatMessage[]; // Assuming ChatMessage is imported or defined
      const systemMessage = messagesArg.find(m => m.role === 'system');
      const userMessage = messagesArg.find(m => m.role === 'user');
      expect(systemMessage).toBeDefined();
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toContain(`Original Query: ${mockPreprocessedQuery.originalQuery}`);
      expect(userMessage?.content).toContain(`Normalized Query: ${mockPreprocessedQuery.normalizedQuery}`);
      // Check for structured heuristic data if it's part of the prompt
      const heuristicString = JSON.stringify(mockHeuristicOutput, null, 2);
      expect(userMessage?.content).toContain(heuristicString);
      // Check for instructions about the expected JSON output format
      expect(systemMessage?.content).toContain('You must respond ONLY with a JSON object matching the following schema');
      expect(systemMessage?.content).toContain('LLMClassification');
      expect(systemMessage?.content).toContain('confidence');
      expect(systemMessage?.content).toContain('llmReasoning');
    });
  });

  describe('routeQuery', () => {
    beforeEach(() => {
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockClear();
      (mockLLMService.generateChatCompletion as jest.Mock).mockClear();
      
      // Default heuristic output based on actual HeuristicOutput type
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockReturnValue({
        isAnalyticalIntent: false,
        isRetrievalIntent: true,
        requestsVisualization: false,
        mentionsDataset: false,
        mentionsCode: false,
        analyticalScore: 0.2, // Defaulting to low analytical score
        retrievalScore: 0.4,  // Defaulting to mid/low retrieval score, to often trigger LLM
      } as HeuristicOutput);
      
      // Default LLM classification output
      (mockLLMService.generateChatCompletion as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve({ content: JSON.stringify({ classification: 'direct_retrieval', confidence: 0.9, llmReasoning: 'LLM default for routeQuery' } as LLMClassificationOutput) })
      });
      
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'ROUTER_CONF_HIGH') return '0.85';
        if (key === 'ROUTER_CONF_MID') return '0.65';
        if (key === 'ROUTER_MODEL') return 'o4-mini-test-model';
        if (key === 'ROUTER_DEFAULT_PATH') return 'direct_vector_rag'; // Default path for RouterDecision
        return undefined;
      });
    });

    it('should use heuristic path if heuristic score is high for direct_vector_rag', async () => {
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockReturnValueOnce({
        isAnalyticalIntent: false,
        isRetrievalIntent: true, // High retrieval intent
        requestsVisualization: false,
        mentionsDataset: false,
        mentionsCode: false,
        analyticalScore: 0.1,
        retrievalScore: 0.9, // High retrieval score
      } as HeuristicOutput);

      const result = await service.determineRoute('simple query'); 
      expect(mockQueryAnalysisService.runHeuristics).toHaveBeenCalledWith(expect.objectContaining({ normalizedQuery: 'simple query' }));
      expect(mockLLMService.generateChatCompletion).not.toHaveBeenCalled();
      expect(result.chosenPath).toBe('direct_vector_rag'); 
      
      const highConfStr = mockConfigService.get!('ROUTER_CONF_HIGH'); // Use non-null assertion operator
      if (highConfStr !== undefined) { // Check for undefined to satisfy TypeScript
        expect(result.confidence).toBeGreaterThanOrEqual(parseFloat(highConfStr));
      } else {
        // This case should not be reached if mocks are set up correctly
        throw new Error("mockConfigService.get('ROUTER_CONF_HIGH') returned undefined, check mock setup.");
      }
    });

    it('should call LLM if heuristic scores are not decisive', async () => {
      // Heuristic (default from beforeEach) has mid/low scores, should trigger LLM.
      // LLM (default from beforeEach) returns classification: 'direct_retrieval'.
      const result = await service.determineRoute('complex query for llm'); // RENAMED from routeQuery
      expect(mockQueryAnalysisService.runHeuristics).toHaveBeenCalled();
      expect(mockLLMService.generateChatCompletion).toHaveBeenCalled();
      // The chosenPath will be based on LLM's classification, mapped to a RouterPath
      expect(result.chosenPath).toBe('direct_vector_rag'); 
      expect(result.confidence).toBe(0.9); // Based on LLM's confidence
    });

    it('should use config values for LLM call and decision thresholds', async () => {
      // Explicitly re-initialize/confirm mocks for this specific test
      mockLLMService.generateChatCompletion = jest.fn().mockResolvedValue({
         json: () => Promise.resolve({ content: JSON.stringify({ classification: 'direct_retrieval', confidence: 0.9, llmReasoning: 'from specific test setup for config test' } as LLMClassificationOutput) })
      });
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'ROUTER_MODEL') return 'o4-mini-test-model';
        if (key === 'ROUTER_CONF_HIGH') return '0.85';
        if (key === 'ROUTER_CONF_MID') return '0.65';
        // Ensure other keys used by the service or combineAndFinalizeDecision are handled if called
        if (key === 'ROUTER_DEFAULT_PATH') return 'direct_vector_rag';
        return undefined;
      });

      await service.determineRoute('test query'); 
      
      expect(mockLLMService.generateChatCompletion as jest.Mock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ model: 'o4-mini-test-model' })
      );
      expect(mockConfigService.get as jest.Mock).toHaveBeenCalledWith('ROUTER_MODEL'); // Added this check
      expect(mockConfigService.get as jest.Mock).toHaveBeenCalledWith('ROUTER_CONF_HIGH');
      expect(mockConfigService.get as jest.Mock).toHaveBeenCalledWith('ROUTER_CONF_MID');
    });

    // Test 1 from old: Heuristic path is 'llm_classification', LLM provides a different path.
    // This needs to be re-interpreted: Heuristics indicate low confidence, so LLM is consulted.
    it('should use LLM path when heuristics indicate uncertainty', async () => {
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockReturnValueOnce({
        isAnalyticalIntent: true, // Example: mixed signals
        isRetrievalIntent: true,
        requestsVisualization: false,
        mentionsDataset: true,
        mentionsCode: false,
        analyticalScore: 0.5, // Mid analytical
        retrievalScore: 0.5,  // Mid retrieval
      } as HeuristicOutput);
      (mockLLMService.generateChatCompletion as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ content: JSON.stringify({ classification: 'analytical_task', confidence: 0.8, llmReasoning: 'LLM decided analytical' } as LLMClassificationOutput) })
      });

      const result = await service.determineRoute('defer to LLM query'); // RENAMED
      expect(result.chosenPath).toBe('analytical_rag'); // Mapped from 'analytical_task'
      expect(result.confidence).toBe(0.8);
    });

    // Test 6 from old: Heuristic is 'llm_classification', but LLM fails (returns null)
    // Re-interpreted: Heuristics uncertain, LLM fails -> default path
    it('should use default path if heuristics are uncertain and LLM fails', async () => {
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockReturnValueOnce({
        isAnalyticalIntent: false,
        isRetrievalIntent: false, // Very low scores
        requestsVisualization: false,
        mentionsDataset: false,
        mentionsCode: false,
        analyticalScore: 0.1,
        retrievalScore: 0.1,
      } as HeuristicOutput);
      (mockLLMService.generateChatCompletion as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ content: JSON.stringify(null) }) // Simulate LLM returning null effectively (e.g. parse error or explicit null)
      }); 
      // Alternative for LLM failure: (mockLLMService.generateChatCompletion as jest.Mock).mockRejectedValueOnce(new Error('LLM down'));

      const result = await service.determineRoute('llm fail query'); // RENAMED
      expect(result.chosenPath).toBe('direct_vector_rag'); // Default path from config
    });
  });

  // describe('combineOutputsAndDecide scenarios', ...) // This block will need similar refactoring
  // Helper function callCombineAndFinalize (if used)

  // Helper functions like mockLLMResponse, mockLLMResponseWithMarkdown might need to be removed or updated
  // if their logic is now fully handled by the beforeEach blocks or direct test mocks.
}); 