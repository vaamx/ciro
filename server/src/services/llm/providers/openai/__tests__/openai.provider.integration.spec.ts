import { OpenAIProvider } from '../openai.provider';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ChatCompletionRequest, EmbeddingRequest, LLMResponse, EmbeddingResponse } from '../../../types/llm-request.types';
import { LLMProviderError } from '../../../types/llm-types';

// Mock ConfigService for integration tests
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'OPENAI_API_KEY') {
      return process.env.OPENAI_API_KEY;
    }
    if (key === 'OPENAI_ORG_ID') {
      return process.env.OPENAI_ORG_ID;
    }
    return undefined;
  }),
} as any;

describe('OpenAIProvider Integration Tests', () => {
  let openaiProvider: OpenAIProvider;

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable must be set for integration tests.');
    }
    openaiProvider = new OpenAIProvider(mockConfigService);
  });

  describe('generateChatCompletion', () => {
    // List of OpenAI models you want to test against
    // Focusing on models expected to work with standard chat completion API.
    // Specialized models (audio, realtime, pure transcription/TTS) should have their own test suites.
    const modelsToTest = [
      'o3-2025-04-16',          // Uses max_completion_tokens
      'o4-mini-2025-04-16',    // Uses max_completion_tokens
      'gpt-4.1-2025-04-14',
      'gpt-4o-2024-11-20',
      // 'gpt-4o-realtime-preview-2024-12-17', // Requires different API interaction
      // 'gpt-4o-mini-realtime-preview-2024-12-17', // Requires different API interaction
      // 'gpt-4o-audio-preview-2024-12-17', // Requires audio input/output
    ];

    test.each(modelsToTest)('should get a successful chat completion from %s', async (model) => {
      const isOSeries = model.startsWith('o3') || model.startsWith('o4-mini');
      const request: ChatCompletionRequest = {
        messages: [
          {
            role: 'user',
            content: 'Hello! What is the capital of France? Please answer in one sentence.'
          }
        ],
        model,
        temperature: 0.7,
        maxTokens: isOSeries ? 100 : 60
      };

      let response: LLMResponse | null = null;

      try {
        response = await openaiProvider.generateChatCompletion(request);

        // Basic response structure validation
        expect(response).toBeDefined();
        expect(response?.content).toBeDefined();
        expect(typeof response?.content).toBe('string');
        expect(response?.content.length).toBeGreaterThan(0);

        // Validate that the response mentions Paris (expected answer)
        expect(response?.content?.toLowerCase()).toContain('paris');
        // OpenAI returns specific model snapshots (e.g., gpt-4o-2024-08-06 instead of gpt-4o)
        expect(response?.metadata.model).toMatch(new RegExp(`^${model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        expect(response?.usage).toBeDefined();
        expect(response?.usage?.totalTokens).toBeGreaterThan(0);
        expect(response?.finishReason).toBeDefined();

        console.log(`✅ Model ${model} responded: ${response?.content?.substring(0, 100)}...`);
      } catch (error) {
        console.error(`Error during test for model ${model} with request:`, request, 'Response:', response);
        console.error('Full error object:', error);
        
        // If it's an API error, OpenAI errors usually have a type and message
        if (error && typeof error === 'object' && 'message' in error) {
          console.error('API Error Message:', (error as any).message);
        }
        
        throw error;
      }
    }, 15000);

    test('should handle API error for chat completion (e.g., invalid API key)', async () => {
      const mockInvalidConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'OPENAI_API_KEY') {
            return 'invalid-api-key-12345';
          }
          return undefined;
        }),
      } as any;

      const providerWithInvalidKey = new OpenAIProvider(mockInvalidConfigService);

      const request: ChatCompletionRequest = {
        messages: [
          {
            role: 'user',
            content: 'Hello OpenAI!'
          }
        ],
        model: 'gpt-4o-mini',
        maxTokens: 10
      };

      try {
        await providerWithInvalidKey.generateChatCompletion(request);
        // If the above line does not throw, the test should fail.
        fail('The generateChatCompletion method should have thrown an error for an invalid API key.');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error).toBeInstanceOf(LLMProviderError);
        expect(error.message).toMatch(/OpenAI authentication failed/i);

        // Check the original error for the specific authentication issue
        const originalError = error.originalError;
        if (originalError && originalError.status === 401) {
          expect(originalError.status).toBe(401);
          // OpenAI typically returns 401 for invalid API keys
        } else {
          // Fallback if the structure is different
          expect(error.message).toMatch(/authentication|unauthorized|invalid.*key/i);
        }
      }
    }, 15000);
  });

  describe.skip('generateEmbedding', () => {
    // Embedding model tests are skipped as per user request to "keep only these models"
    // and the provided list did not include specific embedding models.
    const embeddingModelsToTest: string[] = [];

    test.each(embeddingModelsToTest)('should generate embeddings successfully with %s', async (model) => {
      const request: EmbeddingRequest = {
        input: 'This is a test sentence for embedding generation.',
        model
      };

      let response: EmbeddingResponse | null = null;

      try {
        response = await openaiProvider.generateEmbedding(request);

        // Basic response structure validation
        expect(response).toBeDefined();
        expect(response?.embeddings).toBeDefined();
        expect(Array.isArray(response?.embeddings)).toBe(true);
        expect(response?.embeddings.length).toBeGreaterThan(0);
        
        // Check the first embedding
        const firstEmbedding = response?.embeddings[0];
        expect(Array.isArray(firstEmbedding)).toBe(true);
        expect(firstEmbedding.length).toBeGreaterThan(0);
        
        // All values should be numbers
        expect(firstEmbedding.every(val => typeof val === 'number')).toBe(true);
        
        // OpenAI returns specific model snapshots (e.g., text-embedding-ada-002-v2 instead of text-embedding-ada-002)
        expect(response?.model).toMatch(new RegExp(`^${model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        expect(response?.usage).toBeDefined();
        expect(response?.usage?.totalTokens).toBeGreaterThan(0);

        console.log(`✅ Model ${model} generated embedding with ${firstEmbedding.length} dimensions`);
      } catch (error) {
        console.error(`Error during embedding test for model ${model}:`, error);
        throw error;
      }
    }, 20000);

    test('should handle batch embedding requests', async () => {
      const request: EmbeddingRequest = {
        input: [
          'First test sentence.',
          'Second test sentence.',
          'Third test sentence.'
        ],
        model: 'text-embedding-3-small'
      };

      const response = await openaiProvider.generateEmbedding(request);

      expect(response).toBeDefined();
      expect(response.embeddings).toBeDefined();
      expect(response.embeddings.length).toBe(3); // Should match input array length
      
      // Each embedding should be an array of numbers
      response.embeddings.forEach((embedding, index) => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
        expect(embedding.every(val => typeof val === 'number')).toBe(true);
        console.log(`✅ Batch embedding ${index + 1} has ${embedding.length} dimensions`);
      });
    }, 20000);
  });

  describe('provider health and availability', () => {
    test('should report as available when API key is valid', async () => {
      const isAvailable = await openaiProvider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    test('should return list of available models', async () => {
      const models = await openaiProvider.getModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      // Check that we have both chat and embedding models
      const chatModels = models.filter(model => model.capabilities.includes('chat'));
      const embeddingModels = models.filter(model => model.capabilities.includes('embedding'));
      
      expect(chatModels.length).toBeGreaterThan(0);
      expect(embeddingModels.length).toBeGreaterThan(0);
      
      console.log(`✅ Found ${chatModels.length} chat models and ${embeddingModels.length} embedding models`);
    }, 15000);

    test('should validate requests correctly', async () => {
      const validChatRequest: ChatCompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini'
      };

      const invalidChatRequest: ChatCompletionRequest = {
        messages: [], // Empty messages should be invalid
        model: 'gpt-4o-mini'
      };

      const validEmbeddingRequest: EmbeddingRequest = {
        input: 'Test input',
        model: 'text-embedding-3-small'
      };

      const invalidEmbeddingRequest: EmbeddingRequest = {
        input: '', // Empty input should be invalid
        model: 'text-embedding-3-small'
      };

      const validChatResult = await openaiProvider.validateRequest(validChatRequest);
      expect(validChatResult.isValid).toBe(true);
      expect(validChatResult.errors.length).toBe(0);

      const invalidChatResult = await openaiProvider.validateRequest(invalidChatRequest);
      expect(invalidChatResult.isValid).toBe(false);
      expect(invalidChatResult.errors.length).toBeGreaterThan(0);

      const validEmbeddingResult = await openaiProvider.validateRequest(validEmbeddingRequest);
      expect(validEmbeddingResult.isValid).toBe(true);

      const invalidEmbeddingResult = await openaiProvider.validateRequest(invalidEmbeddingRequest);
      expect(invalidEmbeddingResult.isValid).toBe(false);
    });
  });

  describe('provider initialization and lifecycle', () => {
    test('should initialize successfully', async () => {
      const provider = new OpenAIProvider(mockConfigService);
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    test('should dispose without errors', async () => {
      const provider = new OpenAIProvider(mockConfigService);
      await provider.initialize();
      await expect(provider.dispose()).resolves.not.toThrow();
    });
  });
}); 