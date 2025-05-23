import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService, EmbeddingOptions } from './embedding.service';
import { OpenAIService, EmbeddingAPIOptions } from './openai.service';
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
    it('should clear the cache and return the number of cleared items', async () => {
      await service.createEmbedding('text1');
      await service.createEmbedding('text2', { model: 'other-model' });
      // Cache should have 2 items

      const clearedCount = service.clearCache();
      expect(clearedCount).toBe(2);

      // Verify cache is empty by trying to fetch again (should call OpenAI service)
      mockOpenAIService.createEmbeddings.mockClear();
      await service.createEmbedding('text1');
      expect(mockOpenAIService.createEmbeddings).toHaveBeenCalledTimes(1);
    });
  });

  // Tests for calculateSimilarity, normalizeVector, findMostSimilar can also be added
  // These typically don't directly interact with OpenAIService for their core logic once embeddings are fetched,
  // but rather with the results of createEmbedding/createEmbeddings.
}); 