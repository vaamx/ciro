import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService, EmbeddingOptions } from './embedding.service';
import { OpenAIService, EmbeddingAPIOptions } from './openai.service';
import { ConfigService } from '@nestjs/config';
import { createServiceLogger } from '../../common/utils/logger-factory';

// Mock logger factory
jest.mock('../../common/utils/logger-factory', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  const defaultModel = 'text-embedding-ada-002'; // Default model in EmbeddingService

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create a mock OpenAIService instance with a mocked createEmbeddings method
    // We need to provide all methods of OpenAIService if we want to type it as OpenAIService
    // Or use Partial<OpenAIService> and cast, but jest.Mocked is cleaner for methods we call.
    const mockOpenAIServiceInstance = {
        createEmbeddings: jest.fn(),
        // Add other methods from OpenAIService if EmbeddingService ever calls them
        // For now, assuming only createEmbeddings is relevant here
        uploadFile: jest.fn(),
        createFineTuningJob: jest.fn(),
        getFineTuningJob: jest.fn(),
        cancelFineTuningJob: jest.fn(),
        generateChatCompletion: jest.fn(),
        generateStreamingResponse: jest.fn(),
    } as unknown as jest.Mocked<OpenAIService>; // Cast to allow jest.Mocked type


    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: OpenAIService,
          useValue: mockOpenAIServiceInstance,
        },
        { 
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CACHE_EMBEDDINGS') return true;
              if (key === 'DEFAULT_EMBEDDING_MODEL') return 'text-embedding-ada-002';
              if (key === 'OPENAI_API_KEY') return 'test-api-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    mockOpenAIService = module.get(OpenAIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmbedding (single text)', () => {
    const testText = 'Hello world';
    const mockEmbedding = [0.1, 0.2, 0.3];

    beforeEach(() => {
      // Default mock for openAIService.createEmbeddings to return a single embedding in an array
      mockOpenAIService.createEmbeddings.mockResolvedValue([mockEmbedding]);
    });

    it('should call OpenAIService.createEmbeddings with default model if no options provided', async () => {
      await service.createEmbedding(testText);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith([testText], {}); // Empty API options
    });

    it('should call OpenAIService.createEmbeddings with specified model', async () => {
      const options: EmbeddingOptions = { model: 'custom-model' };
      await service.createEmbedding(testText, options);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith(
        [testText],
        { model: 'custom-model' } as EmbeddingAPIOptions,
      );
    });

    it('should call OpenAIService.createEmbeddings with specified dimensions', async () => {
      const options: EmbeddingOptions = { dimensions: 1024 };
      await service.createEmbedding(testText, options);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith(
        [testText],
        { dimensions: 1024 } as EmbeddingAPIOptions,
      );
    });

    it('should call OpenAIService.createEmbeddings with specified model and dimensions', async () => {
      const options: EmbeddingOptions = { model: 'custom-model', dimensions: 512 };
      await service.createEmbedding(testText, options);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith(
        [testText],
        { model: 'custom-model', dimensions: 512 } as EmbeddingAPIOptions,
      );
    });

    it('should return the first embedding from OpenAIService result', async () => {
      const result = await service.createEmbedding(testText);
      expect(result).toEqual(mockEmbedding);
    });

    it('should use cache if skipCache is false or not provided', async () => {
      await service.createEmbedding(testText); // First call, caches
      await service.createEmbedding(testText); // Second call, should use cache
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(1);
    });

    it('should not use cache if skipCache is true', async () => {
      await service.createEmbedding(testText, { skipCache: true });
      await service.createEmbedding(testText, { skipCache: true });
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(2);
    });

    it('should cache based on model', async () => {
      await service.createEmbedding(testText, { model: 'model-a' });
      await service.createEmbedding(testText, { model: 'model-b' });
      await service.createEmbedding(testText, { model: 'model-a' }); // Should hit cache for model-a
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(2);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith([testText], { model: 'model-a' });
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith([testText], { model: 'model-b' });
    });

    it('should throw error if OpenAIService fails', async () => {
      mockOpenAIService.createEmbeddings.mockRejectedValueOnce(new Error('OpenAI call failed'));
      await expect(service.createEmbedding(testText)).rejects.toThrow('OpenAI call failed');
    });

    it('should throw error if OpenAIService returns no embeddings', async () => {
      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([]);
      await expect(service.createEmbedding(testText)).rejects.toThrow('Failed to create embedding');
    });
  });

  describe('createEmbeddings (multiple texts)', () => {
    const testTexts = ['Hello world', 'Another text'];
    const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]];

    beforeEach(() => {
      mockOpenAIService.createEmbeddings.mockResolvedValue(mockEmbeddings);
    });

    it('should call OpenAIService.createEmbeddings with texts and options', async () => {
      const options: EmbeddingOptions = { model: 'multi-model', dimensions: 256 };
      await service.createEmbeddings(testTexts, options);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith(
        testTexts,
        { model: 'multi-model', dimensions: 256 } as EmbeddingAPIOptions,
      );
    });

    it('should return the embeddings from OpenAIService', async () => {
      const result = await service.createEmbeddings(testTexts);
      expect(result).toEqual(mockEmbeddings);
    });

    it('should handle single text input as an array', async () => {
      const singleText = 'Single one';
      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([[0.5,0.6]]);
      await service.createEmbeddings(singleText, {});
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledWith([singleText], {});
    });

    it('should use cache for single text in batch if not skipped', async () => {
      const singleText = 'Cache this';
      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([[0.7,0.8]]);
      await service.createEmbeddings(singleText); // First call, populates cache from batch logic
      mockOpenAIService.createEmbeddings.mockClear(); // Clear mocks for the next assertion
      // The createEmbeddings method's internal caching for single text in batch needs specific test conditions
      // The specific line: if (!options.skipCache && validTexts.length === 1 && this.cache.has(cacheKey))
      // Call again to check cache hit
      await service.createEmbeddings(singleText);
      expect(mockOpenAIService.createEmbeddings).not.toHaveBeenCalled(); // Should hit cache for the single text
    });

    it('should not use cache for single text in batch if skipCache is true', async () => {
      const singleText = 'No cache for this';
      mockOpenAIService.createEmbeddings.mockResolvedValue([[0.9,1.0]]);
      await service.createEmbeddings(singleText, { skipCache: true });
      await service.createEmbeddings(singleText, { skipCache: true });
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(2);
    });

     it('should throw error if no texts provided', async () => {
      await expect(service.createEmbeddings([])).rejects.toThrow('No texts provided for embedding creation');
    });

    it('should throw error if all texts are empty', async () => {
      await expect(service.createEmbeddings([' ', '\n'])).rejects.toThrow('All provided texts were empty');
    });
  });

  describe('clearCache', () => {
    it('should clear this.embeddingCache (used by createEmbeddings) but not this.cache (used by createEmbedding)', async () => {
      // Populate this.embeddingCache via createEmbeddings (batch)
      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([[0.1], [0.2]]);
      await service.createEmbeddings(['batch_text1', 'batch_text2']);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(1);

      // Populate this.cache via createEmbedding (single)
      // Note: createEmbedding internally calls createEmbeddings, so the mock needs to be set up for it.
      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([[0.3]]);
      await service.createEmbedding('single_text1');
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(2); // 1 for batch, 1 for single

      service.clearCache(); // This clears this.embeddingCache

      // Try to fetch from this.embeddingCache again - should be a cache miss
      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([[0.1], [0.2]]);
      await service.createEmbeddings(['batch_text1', 'batch_text2']);
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(3); // Cache miss for batch

      // Try to fetch from this.cache again - should be a cache hit
      await service.createEmbedding('single_text1'); 
      // No new call to mockOpenAIService.createEmbeddings for 'single_text1' because this.cache was not cleared
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(3); // Still 3, hit this.cache
    });

    it('should log that cache was cleared', () => {
      service.clearCache();
      const mockLoggerInstance = createServiceLogger(EmbeddingService.name);
      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Embedding cache cleared.');
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate cosine similarity correctly for valid vectors', async () => {
      const vecA = [1, 2, 3];
      const vecB = [4, 5, 6];
      const expectedSimilarity = 0.9746318461920664;

      // Mock OpenAIService.createEmbeddings 
      // It expects (query: string | string[], apiOptions?: EmbeddingAPIOptions)
      // EmbeddingService.calculateSimilarity calls this.createEmbeddings([textA, textB]), which then calls openAIService.createEmbeddings.
      mockOpenAIService.createEmbeddings.mockImplementation(async (queryInput: string | string[], apiOptions?: EmbeddingAPIOptions) => {
        const texts = Array.isArray(queryInput) ? queryInput : [queryInput];
        if (texts.length === 2 && texts[0] === 'textA' && texts[1] === 'textB') {
          return [vecA, vecB];
        }
        // Fallback for other potential calls during the test if needed, though not expected for this specific test flow
        if (texts.length === 1 && texts[0] === 'textA') return [vecA]; 
        if (texts.length === 1 && texts[0] === 'textB') return [vecB];
        return []; // Should not happen for this test call
      });

      const similarity = await service.calculateSimilarity('textA', 'textB');
      expect(similarity).toBeCloseTo(expectedSimilarity, 4);
    });

    it('should return 0 similarity for zero vectors', async () => {
      const vecA = [0, 0, 0];
      const vecB = [1, 2, 3];
      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([vecA, vecB]);
      const similarity1 = await service.calculateSimilarity('textA', 'textB');
      expect(similarity1).toBe(0);

      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([vecB, vecA]);
      const similarity2 = await service.calculateSimilarity('textB', 'textA');
      expect(similarity2).toBe(0);

      mockOpenAIService.createEmbeddings.mockResolvedValueOnce([vecA, vecA]);
      const similarity3 = await service.calculateSimilarity('textA', 'textA'); // two zero vectors
      expect(similarity3).toBe(0);
    });

    it('should throw error if vector dimensions do not match (via private method)', async () => {
      const vecA = [1, 2];
      const vecB = [1, 2, 3];
      // This case would actually throw an error earlier if createEmbeddings is mocked to return this
      // The service.calculateCosineSimilarity is private, but if it were public and called directly:
      // expect(() => (service as any).calculateCosineSimilarity(vecA, vecB)).toThrow("Vector dimensions don't match");
      // For the public calculateSimilarity, the error would likely come from createEmbeddings or subsequent processing
      // if the OpenAI service somehow returned mismatched embeddings for a pair of texts (unlikely).
      // Let's assume createEmbeddings provides valid, same-length embeddings.
      // If we want to test the private method directly (not best practice but for completeness):
      expect(() => (service as any).calculateCosineSimilarity(vecA,vecB)).toThrow("Vector dimensions don't match: 2 vs 3");
    });
    
    it('should throw error if createEmbeddings fails', async () => {
      mockOpenAIService.createEmbeddings.mockRejectedValueOnce(new Error('Embedding fetch failed'));
      await expect(service.calculateSimilarity('textA', 'textB')).rejects.toThrow('Embedding fetch failed');
    });
  });

  describe('normalizeVector', () => {
    it('should normalize a vector correctly', () => {
      const vec = [3, 4]; // Magnitude sqrt(9+16) = 5
      const normalized = service.normalizeVector(vec);
      expect(normalized.length).toBe(2);
      expect(normalized[0]).toBeCloseTo(3 / 5);
      expect(normalized[1]).toBeCloseTo(4 / 5);
      // Check magnitude is 1
      const magnitude = Math.sqrt(normalized[0]**2 + normalized[1]**2);
      expect(magnitude).toBeCloseTo(1);
    });

    it('should return a copy of zero vector if input is zero vector', () => {
      const vec = [0, 0, 0];
      const normalized = service.normalizeVector(vec);
      expect(normalized).toEqual([0, 0, 0]);
      expect(normalized).not.toBe(vec); // Ensure it's a copy
    });
  });

  describe('Configuration Interaction', () => {
    // Save the original mock for OpenAIService to restore if needed, or re-mock it simply
    // For these tests, we primarily care about ConfigService affecting EmbeddingService behavior.
    let configuredService: EmbeddingService;
    let mockConfiguredOpenAIService: jest.Mocked<OpenAIService>;

    const setupServiceWithMockConfig = async (configValues: Record<string, any>) => {
      jest.resetModules(); // Important to re-evaluate imports with the new mock
      
      const mockLocalOpenAIService = {
        createEmbeddings: jest.fn(),
        // Add other methods from OpenAIService if needed by EmbeddingService for these specific tests
        uploadFile: jest.fn(), createFineTuningJob: jest.fn(), getFineTuningJob: jest.fn(), cancelFineTuningJob: jest.fn(), generateChatCompletion: jest.fn(), generateStreamingResponse: jest.fn(),
      } as unknown as jest.Mocked<OpenAIService>;

      jest.mock('@nestjs/config', () => ({
        ConfigService: jest.fn().mockImplementation(() => ({
          get: jest.fn((key: string, defaultValue?: any) => {
            return configValues.hasOwnProperty(key) ? configValues[key] : defaultValue;
          }),
        })),
      }));
      jest.mock('./openai.service', () => ({
        OpenAIService: jest.fn(() => mockLocalOpenAIService)
      }));
       // Re-import services after mocks are set up
      const { EmbeddingService: DynamicEmbeddingService } = await import('./embedding.service');
      const { OpenAIService: DynamicOpenAIService } = await import('./openai.service'); // To get the mocked instance provider
      const { ConfigService: DynamicConfigService } = await import('@nestjs/config');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DynamicEmbeddingService,
          { provide: DynamicOpenAIService, useValue: mockLocalOpenAIService },
          { provide: DynamicConfigService, useClass: DynamicConfigService }, // Use the mocked class
        ],
      }).compile();

      configuredService = module.get<EmbeddingService>(DynamicEmbeddingService);
      mockConfiguredOpenAIService = module.get(DynamicOpenAIService);
    };

    it('should not use cache if CACHE_EMBEDDINGS is false in config', async () => {
      await setupServiceWithMockConfig({ 'CACHE_EMBEDDINGS': false });
      mockConfiguredOpenAIService.createEmbeddings.mockResolvedValue([[0.1, 0.2]]);
      
      await configuredService.createEmbedding('test-no-cache-config');
      await configuredService.createEmbedding('test-no-cache-config'); // Call again
      
      expect(mockConfiguredOpenAIService.createEmbeddings).toHaveBeenCalledTimes(2);
    });

    it('should use defaultEmbeddingModel from config if no model specified in options', async () => {
      const customDefaultModel = 'config-default-model';
      await setupServiceWithMockConfig({ 'openai.embeddingModel': customDefaultModel });
      mockConfiguredOpenAIService.createEmbeddings.mockResolvedValue([[0.3, 0.4]]);

      await configuredService.createEmbedding('test-default-model-config');
      
      expect(mockConfiguredOpenAIService.createEmbeddings).toHaveBeenCalledWith(
        ['test-default-model-config'],
        { model: customDefaultModel } // Expecting model from config to be passed to OpenAIService
      );
    });

    it('should still use model from options if provided, even with defaultEmbeddingModel in config', async () => {
      const customDefaultModel = 'config-default-model';
      const optionModel = 'option-specified-model';
      await setupServiceWithMockConfig({ 'openai.embeddingModel': customDefaultModel });
      mockConfiguredOpenAIService.createEmbeddings.mockResolvedValue([[0.5, 0.6]]);

      await configuredService.createEmbedding('test-option-override', { model: optionModel });
      
      expect(mockConfiguredOpenAIService.createEmbeddings).toHaveBeenCalledWith(
        ['test-option-override'],
        { model: optionModel } // Options model should take precedence
      );
    });
  });

}); 