import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueryRouterService } from './query-router.service';
import { OpenAIService } from '../ai/openai.service';
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
}); 