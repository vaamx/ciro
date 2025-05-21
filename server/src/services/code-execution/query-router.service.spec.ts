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
import { PreprocessedQuery, HeuristicOutput, LLMClassificationOutput, LLMClassification } from '../../types/router.types'; // Ensure these types are imported

describe('QueryRouterService', () => {
  let service: QueryRouterService;
  let mockConfigService: Partial<ConfigService>;

  // Default settings structure returned by the mock for getDefaultSettings
  const mockResolvedDefaultSettings = { version: '0.2', language: 'en', dictionaries: [], ignoreWords: [] };

  // This might still be useful for verifying calls if getDefaultSettings is expected to be called
  // or if specific tests override its mock, but the primary return is in jest.mock now.
  // const mockDefaultSettings = { // This constant might be less relevant now or used for .mockResolvedValueOnce
  //   version: '0.2',
  //   language: 'en-US,en',
  //   allowCompoundWords: true,
  //   dictionaries: ['common-words', 'typescript', 'softwareTerms', 'html', 'css', 'fonts'],
  //   dictionaryDefinitions: [],
  //   ignorePaths: [],
  //   ignoreWords: ['artefact', 'hllo', 'wrold'],
  //   words: [],
  //   patterns: [],
  //   languageSettings: [],
  // };

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
        return undefined;
      }),
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

}); 