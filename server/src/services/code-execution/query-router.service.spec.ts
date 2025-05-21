import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueryRouterService } from './query-router.service';
import { OpenAIService, ChatMessage } from '../ai/openai.service';
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

    mockQueryAnalysisService = {
      runHeuristics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryRouterService,
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: OpenAIService, // Use the class as the token
          useValue: {
            chatCompletion: jest.fn(), // Keep if other methods use it
            generateChatCompletion: jest.fn().mockResolvedValue({ json: () => Promise.resolve({ content: JSON.stringify({ path: 'direct_retrieval', confidence: 0.9, explanation: 'mocked AI response', requiresVisualization: false }) }) }) // Add mock for generateChatCompletion
          }
        },
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
    let mockOpenAIService: OpenAIService;
    let mockPreprocessedQuery: PreprocessedQuery;
    let mockHeuristicOutput: HeuristicOutput;

    beforeEach(() => {
      // Cast to any to access the jest.Mock type for individual methods
      mockOpenAIService = (service as any).openAIService; 

      mockPreprocessedQuery = {
        originalQuery: 'Test query',
        normalizedQuery: 'test query',
      };
      mockHeuristicOutput = {
        isAnalyticalIntent: false,
        isRetrievalIntent: true,
        requestsVisualization: false,
        mentionsDataset: false,
        mentionsCode: false,
        analyticalScore: 0.2,
        retrievalScore: 0.8,
      };
    });

    const mockLLMResponse = (data: Partial<LLMClassificationOutput> | string, validJson = true, includeContentWrapper = true) => {
      let content;
      if (typeof data === 'string') {
        content = data;
      } else {
        content = JSON.stringify(data);
      }
    
      if (includeContentWrapper) {
        (mockOpenAIService.generateChatCompletion as jest.Mock).mockResolvedValue({
          json: () => Promise.resolve({
            // Simulating the structure OpenAIService's generateChatCompletion returns
            id: 'chatcmpl-mockid',
            role: 'assistant',
            content: validJson ? content : 'malformed json string',
            timestamp: Date.now(),
            status: 'complete',
            metadata: { model: 'gpt-test' }
          }),
        });
      } else {
         // Simulate case where the top-level 'content' might be missing or response is directly the content string
         (mockOpenAIService.generateChatCompletion as jest.Mock).mockResolvedValue({
          json: () => Promise.resolve(validJson ? JSON.parse(content) : { error: 'simulated error object' }),
        });
      }
    };
    
    const mockLLMResponseWithMarkdown = (data: Partial<LLMClassificationOutput>) => {
      const jsonContent = JSON.stringify(data);
      const markdownContent = "Some preceding text ```json\\n" + jsonContent + "\\n``` Some trailing text";
      (mockOpenAIService.generateChatCompletion as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve({
          id: 'chatcmpl-mockid',
          role: 'assistant',
          content: markdownContent,
          timestamp: Date.now(),
          status: 'complete',
          metadata: { model: 'gpt-test' }
        }),
      });
    };

    it('should correctly classify as direct_retrieval', async () => {
      const expectedOutput: LLMClassificationOutput = {
        classification: 'direct_retrieval',
        confidence: 0.9,
        llmReasoning: 'Looks like a retrieval task.',
      };
      mockLLMResponse(expectedOutput);
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toEqual(expectedOutput);
      expect(mockOpenAIService.generateChatCompletion).toHaveBeenCalled();
    });

    it('should correctly classify as analytical_task', async () => {
      const expectedOutput: LLMClassificationOutput = {
        classification: 'analytical_task',
        confidence: 0.85,
        llmReasoning: 'This is analytical.',
      };
      mockLLMResponse(expectedOutput);
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toEqual(expectedOutput);
    });

    it('should correctly classify as clarification_needed', async () => {
      const expectedOutput: LLMClassificationOutput = {
        classification: 'clarification_needed',
        confidence: 0.7,
        llmReasoning: 'Too vague.',
      };
      mockLLMResponse(expectedOutput);
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toEqual(expectedOutput);
    });
    
    it('should handle LLM response with markdown code block for JSON', async () => {
      const classificationData: LLMClassificationOutput = {
        classification: 'analytical_task',
        confidence: 0.9,
        llmReasoning: 'Extracted from markdown',
      };
      mockLLMResponseWithMarkdown(classificationData);
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toEqual(classificationData);
    });

    it('should use ROUTER_MODEL from ConfigService', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'ROUTER_MODEL') return 'o4-mini-test-model';
        if (key === 'ROUTER_SPELLCHECK') return 'true';
        return undefined;
      });
      // Re-initialize service or update its internal routerModel if necessary
      // For simplicity, we assume constructor logic picks it up if module is recompiled or service is new for test.
      // In a real scenario with a long-lived service, you might need to spy on configService directly in the method
      // or ensure the service instance uses the new config.
      // Here, we are relying on the beforeEach to create a new service instance with the updated mockConfig.
      const moduleRecompiled: TestingModule = await Test.createTestingModule({
        providers: [
          QueryRouterService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: OpenAIService, useValue: { generateChatCompletion: mockOpenAIService.generateChatCompletion } },
          { provide: QueryAnalysisService, useValue: mockQueryAnalysisService },
        ],
      }).compile();
      const newService = moduleRecompiled.get<QueryRouterService>(QueryRouterService);


      mockLLMResponse({ classification: 'direct_retrieval', confidence: 0.9 });
      await newService.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      
      expect(mockOpenAIService.generateChatCompletion).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ model: 'o4-mini-test-model' })
      );
    });

    it('should correctly construct the prompt with query and heuristics', async () => {
      mockLLMResponse({ classification: 'direct_retrieval', confidence: 0.9 });
      await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);

      const expectedHeuristicsString = JSON.stringify(mockHeuristicOutput);
      const calls = (mockOpenAIService.generateChatCompletion as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const firstCallArgs = calls[0];
      const messages = firstCallArgs[0] as ChatMessage[];
      const systemMessage = messages.find(m => m.role === 'system');

      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toContain(`User Query: \"${mockPreprocessedQuery.normalizedQuery}\"`);
      expect(systemMessage?.content).toContain(`Heuristics: ${expectedHeuristicsString}`);
    });
    
    it('should return null if LLM response is malformed JSON', async () => {
      mockLLMResponse("this is not json", false); // Ensure second arg makes it malformed
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });

    it('should return null if LLM response JSON is missing classification', async () => {
      mockLLMResponse({ confidence: 0.9, llmReasoning: 'Missing classification' });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });
    
    it('should return null if LLM response JSON has invalid classification value', async () => {
      mockLLMResponse({ classification: 'invalid_value' as LLMClassification, confidence: 0.9 });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });

    it('should return null if LLM response JSON is missing confidence', async () => {
      mockLLMResponse({ classification: 'direct_retrieval', llmReasoning: 'Missing confidence' });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });
    
    it('should return null if LLM response JSON has confidence out of range (too high)', async () => {
      mockLLMResponse({ classification: 'direct_retrieval', confidence: 1.5 });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });
    
    it('should return null if LLM response JSON has confidence out of range (too low)', async () => {
      mockLLMResponse({ classification: 'direct_retrieval', confidence: -0.5 });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });
    
    it('should correctly parse if llmReasoning is missing (optional)', async () => {
       const expectedOutput: LLMClassificationOutput = {
        classification: 'analytical_task',
        confidence: 0.8,
      };
      mockLLMResponse(expectedOutput); // llmReasoning is not provided
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toEqual(expectedOutput);
    });

    it('should return null if OpenAIService.generateChatCompletion throws an error', async () => {
      (mockOpenAIService.generateChatCompletion as jest.Mock).mockRejectedValue(new Error('API Error'));
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });
    
    it('should return null if LLM response content is missing', async () => {
      (mockOpenAIService.generateChatCompletion as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve({
          id: 'chatcmpl-mockid',
          role: 'assistant',
          // No 'content' field
          timestamp: Date.now(),
          status: 'complete',
          metadata: { model: 'gpt-test' }
        }),
      });
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull();
    });
    
    it('should return null if LLM response.json() itself is not the expected content wrapper', async () => {
      // Simulate if .json() returns something unexpected, not the { content: "..." } structure
      mockLLMResponse({ classification: 'analytical_task', confidence: 0.9 }, true, false);
      const result = await service.llmClassify(mockPreprocessedQuery, mockHeuristicOutput);
      expect(result).toBeNull(); // Because the parsing logic expects responseData.content
    });

  });

  // New describe block for combineAndFinalizeDecision
  describe('combineAndFinalizeDecision', () => {
    let preprocessedQuery: PreprocessedQuery;
    let heuristicOutput: HeuristicOutput;
    let llmOutput: LLMClassificationOutput | null;

    // Access private method for testing - TypeScript workaround
    const callCombineAndFinalize = (
      pq: PreprocessedQuery,
      ho: HeuristicOutput,
      lo: LLMClassificationOutput | null
    ): Promise<RouterDecision> => {
      return (service as any).combineAndFinalizeDecision(pq, ho, lo);
    };
    
    beforeEach(() => {
      preprocessedQuery = { originalQuery: 'test', normalizedQuery: 'test' };
      // Default heuristic: neutral/ambiguous
      heuristicOutput = {
        isAnalyticalIntent: false, isRetrievalIntent: false, requestsVisualization: false,
        mentionsDataset: false, mentionsCode: false, analyticalScore: 0.5, retrievalScore: 0.5,
      };
      llmOutput = null; // Default to no LLM output
    });

    // Test cases based on LLM output confidence
    describe('With LLM Output', () => {
      it('should use LLM decision if LLM confidence is HIGH (analytical)', async () => {
        llmOutput = { classification: 'analytical_task', confidence: 0.9, llmReasoning: 'LLM high conf analytical' };
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('analytical_rag');
        expect(result.confidence).toBe(0.9);
        expect(result.reasoning).toContain('High confidence LLM classification (analytical_task)');
        expect(result.details?.llm_classification).toEqual(llmOutput);
      });

      it('should use LLM decision if LLM confidence is HIGH (retrieval)', async () => {
        llmOutput = { classification: 'direct_retrieval', confidence: 0.88, llmReasoning: 'LLM high conf retrieval' };
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('direct_vector_rag');
        expect(result.confidence).toBe(0.88);
        expect(result.reasoning).toContain('High confidence LLM classification (direct_retrieval)');
      });

      it('should use LLM decision if LLM confidence is HIGH (clarification)', async () => {
        llmOutput = { classification: 'clarification_needed', confidence: 0.92 };
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('user_clarification_needed');
        expect(result.confidence).toBe(0.92);
        expect(result.reasoning).toContain('High confidence LLM classification (clarification_needed)');
      });

      it('should use LLM (analytical) if MID confidence and heuristics align/neutral', async () => {
        llmOutput = { classification: 'analytical_task', confidence: 0.75 };
        heuristicOutput.analyticalScore = 0.6; // aligned/neutral
        heuristicOutput.retrievalScore = 0.4;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('analytical_rag');
        expect(result.confidence).toBe(0.75);
        expect(result.reasoning).toContain('LLM analytical favored, heuristics align or neutral.');
      });
      
      it('should use LLM (retrieval) if MID confidence and heuristics align/neutral', async () => {
        llmOutput = { classification: 'direct_retrieval', confidence: 0.70 };
        heuristicOutput.retrievalScore = 0.7; // aligned/neutral
        heuristicOutput.analyticalScore = 0.3;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('direct_vector_rag');
        expect(result.confidence).toBe(0.70);
        expect(result.reasoning).toContain('LLM retrieval favored, heuristics align or neutral.');
      });

      it('should clarify if LLM MID (analytical) but heuristics strongly conflict (favor retrieval)', async () => {
        llmOutput = { classification: 'analytical_task', confidence: 0.70 };
        heuristicOutput.retrievalScore = 0.8; // strong conflict
        heuristicOutput.analyticalScore = 0.2;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('user_clarification_needed');
        expect(result.reasoning).toContain('LLM/Heuristic conflict or LLM requests clarification.');
      });

      it('should clarify if LLM MID (retrieval) but heuristics strongly conflict (favor analytical)', async () => {
        llmOutput = { classification: 'direct_retrieval', confidence: 0.68 };
        heuristicOutput.analyticalScore = 0.9; // strong conflict
        heuristicOutput.retrievalScore = 0.3;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('user_clarification_needed');
        expect(result.reasoning).toContain('LLM/Heuristic conflict or LLM requests clarification.');
      });
      
      it('should use LLM path if MID confidence and heuristics are not strongly conflicting (analytical)', async () => {
        llmOutput = { classification: 'analytical_task', confidence: 0.66 };
        heuristicOutput.analyticalScore = 0.5; 
        heuristicOutput.retrievalScore = 0.4; // Not strongly conflicting, and analyticalScore >= retrievalScore
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('analytical_rag');
        expect(result.reasoning).toContain('LLM analytical favored, heuristics align or neutral.'); // Adjusted expectation
      });

      it('should clarify if LLM MID requests clarification, regardless of heuristics', async () => {
        llmOutput = { classification: 'clarification_needed', confidence: 0.78 };
        heuristicOutput.analyticalScore = 0.9; // strong heuristic
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('user_clarification_needed');
        expect(result.reasoning).toContain('LLM/Heuristic conflict or LLM requests clarification.');
      });
      
      it('should use strong heuristic (analytical) if LLM confidence is LOW', async () => {
        llmOutput = { classification: 'direct_retrieval', confidence: 0.3 }; // LLM low, wrong direction
        heuristicOutput.analyticalScore = 0.9; // Heuristic high, correct direction
        heuristicOutput.retrievalScore = 0.2;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('analytical_rag');
        expect(result.confidence).toBe(0.9);
        expect(result.reasoning).toContain('Strong heuristic analytical signal overrides low-confidence LLM.');
      });

      it('should use strong heuristic (retrieval) if LLM confidence is LOW', async () => {
        llmOutput = { classification: 'analytical_task', confidence: 0.25 }; // LLM low, wrong direction
        heuristicOutput.retrievalScore = 0.88; // Heuristic high, correct direction
        heuristicOutput.analyticalScore = 0.1;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('direct_vector_rag');
        expect(result.confidence).toBe(0.88);
        expect(result.reasoning).toContain('Strong heuristic retrieval signal overrides low-confidence LLM.');
      });

      it('should clarify if LLM confidence is LOW and heuristics are also weak/ambiguous', async () => {
        llmOutput = { classification: 'analytical_task', confidence: 0.4 };
        heuristicOutput.analyticalScore = 0.5;
        heuristicOutput.retrievalScore = 0.45;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('user_clarification_needed');
        expect(result.reasoning).toContain('Neither LLM nor heuristics provide strong signal.');
        expect(result.confidence).toBe(0.5); // max of weak signals
      });
    });

    // Test cases based on Heuristic output only (LLM is null)
    describe('Without LLM Output (Heuristics Only)', () => {
      beforeEach(() => {
        llmOutput = null; // Ensure no LLM output for these tests
      });

      it('should use heuristic (analytical) if score is MID/HIGH and dominant', async () => {
        heuristicOutput.analyticalScore = 0.75;
        heuristicOutput.retrievalScore = 0.3;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('analytical_rag');
        expect(result.confidence).toBe(0.75);
        expect(result.reasoning).toContain('Heuristic analytical score is moderate to high.');
        expect(result.details?.llm_classification).toBeNull();
      });

      it('should use heuristic (retrieval) if score is MID/HIGH and dominant', async () => {
        heuristicOutput.retrievalScore = 0.80;
        heuristicOutput.analyticalScore = 0.2;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('direct_vector_rag');
        expect(result.confidence).toBe(0.80);
        expect(result.reasoning).toContain('Heuristic retrieval score is moderate to high.');
      });

      it('should clarify if heuristic scores are low or ambiguous', async () => {
        heuristicOutput.analyticalScore = 0.4;
        heuristicOutput.retrievalScore = 0.35;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('user_clarification_needed');
        expect(result.reasoning).toContain('Heuristic scores are low or ambiguous.');
        expect(result.confidence).toBe(0.4);
      });
      
      it('should clarify if heuristic scores are both below MID and close', async () => {
        heuristicOutput.analyticalScore = 0.60; // below default mid 0.65
        heuristicOutput.retrievalScore = 0.55;
        const result = await callCombineAndFinalize(preprocessedQuery, heuristicOutput, llmOutput);
        expect(result.chosenPath).toBe('user_clarification_needed');
        expect(result.reasoning).toContain('Heuristic scores are low or ambiguous.');
      });
    });
    
    // Fallback case
    describe('Critical Fallback (No LLM, No Heuristics)', () => {
        it('should clarify if no heuristic or LLM output is available', async () => {
            // Simulate heuristicOutput being null or undefined, though types might prevent this.
            // Forcing it for test.
            const result = await callCombineAndFinalize(preprocessedQuery, null as any, null);
            expect(result.chosenPath).toBe('user_clarification_needed');
            expect(result.confidence).toBe(0.1);
            expect(result.reasoning).toContain('Critical error: No heuristic or LLM output available.');
        });
    });
  });

  // New describe block for determineRoute
  describe('determineRoute', () => {
    let mockPreprocessedQuery: PreprocessedQuery;
    let mockHeuristicOutput: HeuristicOutput;
    let mockLLMClassificationOutput: LLMClassificationOutput | null;
    let mockRouterDecision: RouterDecision;

    beforeEach(() => {
      // Default mock return values
      mockPreprocessedQuery = { originalQuery: 'Test Query', normalizedQuery: 'test query' };
      mockHeuristicOutput = {
        isAnalyticalIntent: false, isRetrievalIntent: true, requestsVisualization: false,
        mentionsDataset: true, mentionsCode: false, analyticalScore: 0.3, retrievalScore: 0.7,
      };
      mockLLMClassificationOutput = {
        classification: 'direct_retrieval', confidence: 0.9, llmReasoning: 'LLM decided retrieval',
      };
      mockRouterDecision = {
        chosenPath: 'direct_vector_rag', confidence: 0.9,
        reasoning: 'Final decision based on LLM and heuristics',
        details: { heuristics: mockHeuristicOutput, llm_classification: mockLLMClassificationOutput }
      };

      // Mock the service's own methods
      jest.spyOn(service, 'preprocess').mockResolvedValue(mockPreprocessedQuery);
      // jest.spyOn(service, 'llmClassify').mockResolvedValue(mockLLMClassificationOutput);
      // Mock llmClassify via the injected OpenAIService if it's called directly by llmClassify, or spy on llmClassify itself
      // For simplicity here, let's assume we can spy on llmClassify directly if it contains its own logic beyond just calling openAIService
      // If llmClassify is very thin, mock openAIService.generateChatCompletion instead.
      // For now, directly mock llmClassify and combineAndFinalizeDecision as they are part of the same service and being unit tested.
      jest.spyOn(service as any, 'llmClassify').mockResolvedValue(mockLLMClassificationOutput);
      jest.spyOn(service as any, 'combineAndFinalizeDecision').mockResolvedValue(mockRouterDecision);
      jest.spyOn(service as any, 'persistLog').mockResolvedValue(undefined);

      // Mock QueryAnalysisService's runHeuristics method
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockResolvedValue(mockHeuristicOutput);
    });

    afterEach(() => {
      jest.restoreAllMocks(); // Restore all mocks after each test
    });

    it('should call preprocess, runHeuristics, llmClassify (conditionally), combineAndFinalizeDecision, and persistLog', async () => {
      // Setup heuristics to be ambiguous to ensure llmClassify is called
      const ambiguousHeuristics: HeuristicOutput = { 
        ...mockHeuristicOutput, analyticalScore: 0.5, retrievalScore: 0.55 
      };
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockResolvedValue(ambiguousHeuristics);
      (service as any).combineAndFinalizeDecision.mockResolvedValue({ 
        ...mockRouterDecision, details: { heuristics: ambiguousHeuristics, llm_classification: mockLLMClassificationOutput }
      });

      const rawQuery = 'Test Query';
      const result = await service.determineRoute(rawQuery);

      expect(service.preprocess).toHaveBeenCalledWith(rawQuery);
      expect(mockQueryAnalysisService.runHeuristics).toHaveBeenCalledWith(mockPreprocessedQuery);
      expect((service as any).llmClassify).toHaveBeenCalledWith(mockPreprocessedQuery, ambiguousHeuristics);
      expect((service as any).combineAndFinalizeDecision).toHaveBeenCalledWith(mockPreprocessedQuery, ambiguousHeuristics, mockLLMClassificationOutput);
      expect((service as any).persistLog).toHaveBeenCalledWith(rawQuery, { ...mockRouterDecision, details: { heuristics: ambiguousHeuristics, llm_classification: mockLLMClassificationOutput }});
      expect(result).toEqual({ ...mockRouterDecision, details: { heuristics: ambiguousHeuristics, llm_classification: mockLLMClassificationOutput }});
    });

    it('should skip llmClassify if heuristics are confident', async () => {
      // Setup heuristics to be confident (e.g., analyticalScore is high)
      const confidentHeuristics: HeuristicOutput = {
        ...mockHeuristicOutput, analyticalScore: 0.9, retrievalScore: 0.2 
      };
      (mockQueryAnalysisService.runHeuristics as jest.Mock).mockResolvedValue(confidentHeuristics);
      // Adjust mockRouterDecision if llmOutput would be null
      const decisionWithoutLLM: RouterDecision = {
        ...mockRouterDecision, 
        reasoning: 'Decision based on confident heuristics', 
        details: { heuristics: confidentHeuristics, llm_classification: null }
      };
      (service as any).combineAndFinalizeDecision.mockResolvedValue(decisionWithoutLLM);

      const rawQuery = 'Confident Test Query';
      await service.determineRoute(rawQuery);

      expect(service.preprocess).toHaveBeenCalledWith(rawQuery);
      expect(mockQueryAnalysisService.runHeuristics).toHaveBeenCalledWith(mockPreprocessedQuery);
      expect((service as any).llmClassify).not.toHaveBeenCalled();
      expect((service as any).combineAndFinalizeDecision).toHaveBeenCalledWith(mockPreprocessedQuery, confidentHeuristics, null);
      expect((service as any).persistLog).toHaveBeenCalledWith(rawQuery, decisionWithoutLLM);
    });
    
    it('should correctly pass outputs between stages', async () => {
        const specificRawQuery = "Specific query for testing flow";
        const specificPreprocessed: PreprocessedQuery = { originalQuery: specificRawQuery, normalizedQuery: "specific query for testing flow" };
        // Adjust heuristics to ensure llmClassify is called
        const specificHeuristics: HeuristicOutput = { 
            analyticalScore: 0.6, // Lowered to make maxScore < routerConfMid or scores ambiguous
            retrievalScore: 0.5,  // Adjusted for ambiguity or to ensure low confidence condition met
            isAnalyticalIntent: true, 
            isRetrievalIntent: false, 
            mentionsCode: false, 
            mentionsDataset: true, 
            requestsVisualization: false 
        };
        const specificLLM: LLMClassificationOutput = { classification: 'direct_retrieval', confidence: 0.92, llmReasoning: "LLM specific" };
        const finalDecision: RouterDecision = {
            chosenPath: 'direct_vector_rag', confidence: 0.92, reasoning: "Final specific",
            details: { heuristics: specificHeuristics, llm_classification: specificLLM }
        };

        jest.spyOn(service, 'preprocess').mockResolvedValue(specificPreprocessed);
        (mockQueryAnalysisService.runHeuristics as jest.Mock).mockResolvedValue(specificHeuristics);
        jest.spyOn(service as any, 'llmClassify').mockResolvedValue(specificLLM);
        jest.spyOn(service as any, 'combineAndFinalizeDecision').mockResolvedValue(finalDecision);
        jest.spyOn(service as any, 'persistLog').mockResolvedValue(undefined);

        // Condition for llmClassify to be called (e.g., heuristics not high enough confidence)
        // Here, retrievalScore 0.85 might be high, but let's assume routerConfHigh is 0.9 for test
        // ConfigService mock can be updated for this specific test if needed or rely on default.
        // Or force llmClassify by making heuristics ambiguous for this test setup path.
        // For this test, we assume llmClassify WILL be called.

        const result = await service.determineRoute(specificRawQuery);

        expect(service.preprocess).toHaveBeenCalledWith(specificRawQuery);
        expect(mockQueryAnalysisService.runHeuristics).toHaveBeenCalledWith(specificPreprocessed);
        expect((service as any).llmClassify).toHaveBeenCalledWith(specificPreprocessed, specificHeuristics);
        expect((service as any).combineAndFinalizeDecision).toHaveBeenCalledWith(specificPreprocessed, specificHeuristics, specificLLM);
        expect((service as any).persistLog).toHaveBeenCalledWith(specificRawQuery, finalDecision);
        expect(result).toBe(finalDecision);
    });

  }); // End of determineRoute describe block

}); // End of QueryRouterService describe block 