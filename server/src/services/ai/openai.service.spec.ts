import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIService, EmbeddingAPIOptions } from './openai.service';
import OpenAI from 'openai'; // Import the main OpenAI type for mocking

// Mock the entire openai SDK module
// const mockOpenAIEmbeddingsCreate = jest.fn(); // Moved into the mock factory
// const mockOpenAIChatCompletionsCreate = jest.fn(); // Moved into the mock factory

jest.mock('openai', () => {
  // Define mocks inside the factory scope
  const mockOpenAIEmbeddingsCreate = jest.fn();
  const mockOpenAIChatCompletionsCreate = jest.fn();
  
  // Store them for access in tests if needed for individual reset/setup
  // This is a bit of a hack for this pattern. Ideally, the instance would hold them.
  (global as any).__mockOpenAIEmbeddingsCreate = mockOpenAIEmbeddingsCreate;
  (global as any).__mockOpenAIChatCompletionsCreate = mockOpenAIChatCompletionsCreate;

  // console.log('Mocking OpenAI module'); // Debugging line
  return jest.fn().mockImplementation(() => ({
    // console.log('OpenAI constructor mock called'); // Debugging line
    embeddings: {
      create: mockOpenAIEmbeddingsCreate,
    },
    chat: {
      completions: {
        create: mockOpenAIChatCompletionsCreate,
      },
    },
    // Mock other parts of the OpenAI client if your service uses them (e.g., files, fineTuning)
    files: {
        create: jest.fn(),
    },
    fineTuning: {
        jobs: {
            create: jest.fn(),
            retrieve: jest.fn(),
            cancel: jest.fn(),
        }
    }
  }));
});

// Mock config if it's complex or to control values specifically for tests
// jest.mock('../../config', () => ({
//   config: {
//     openai: {
//       apiKey: 'test-api-key',
//       orgId: 'test-org-id',
//     },
//   },
// }));

describe('OpenAIService', () => {
  let service: OpenAIService;
  // Access the hoisted mocks for test setup
  let currentMockEmbeddingsCreate: jest.Mock;
  let currentMockChatCompletionsCreate: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks(); // Clear mocks before each test

    // Retrieve the mock functions for this test run
    currentMockEmbeddingsCreate = (global as any).__mockOpenAIEmbeddingsCreate;
    currentMockChatCompletionsCreate = (global as any).__mockOpenAIChatCompletionsCreate;
    currentMockEmbeddingsCreate.mockClear(); // Clear them specifically
    currentMockChatCompletionsCreate.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenAIService],
    }).compile();

    service = module.get<OpenAIService>(OpenAIService);
    // console.log('OpenAIService instance created for test', service); // Debugging line
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmbeddings', () => {
    const testQuery = 'Test query for embedding';
    const mockEmbeddingVector = [0.1, 0.2, 0.3, 0.4];

    beforeEach(() => {
      // Setup default mock response for embeddings.create
      currentMockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbeddingVector, index: 0 }],
        model: 'text-embedding-ada-002', // Default model in service
        object: 'list',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      });
    });

    it('should call openai.embeddings.create with default model if no model is provided', async () => {
      await service.createEmbeddings(testQuery);
      expect(currentMockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: [testQuery],
      });
    });

    it('should call openai.embeddings.create with the specified model', async () => {
      const customModel = 'text-embedding-custom-model';
      await service.createEmbeddings(testQuery, { model: customModel });
      expect(currentMockEmbeddingsCreate).toHaveBeenCalledWith({
        model: customModel,
        input: [testQuery],
      });
    });

    it('should include dimensions in the request if provided', async () => {
      const customModel = 'text-embedding-vNext';
      const dimensions = 512;
      await service.createEmbeddings(testQuery, { model: customModel, dimensions });
      expect(currentMockEmbeddingsCreate).toHaveBeenCalledWith({
        model: customModel,
        input: [testQuery],
        dimensions: dimensions, // Type Parameters<typeof openai.embeddings.create>[0] should allow this if SDK supports it
      });
    });

    it('should handle an array of queries', async () => {
      const queries = ['query1', 'query2'];
      currentMockEmbeddingsCreate.mockResolvedValue({
        data: [
          { embedding: [0.1], index: 0 },
          { embedding: [0.2], index: 1 },
        ],
        model: 'text-embedding-ada-002',
        object: 'list',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      });
      await service.createEmbeddings(queries);
      expect(currentMockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: queries,
      });
    });

    it('should return an array of embedding vectors', async () => {
      const result = await service.createEmbeddings(testQuery);
      expect(result).toEqual([mockEmbeddingVector]);
    });

    it('should throw an error if openai.embeddings.create fails', async () => {
      const errorMessage = 'OpenAI API Error';
      currentMockEmbeddingsCreate.mockRejectedValue(new Error(errorMessage));
      await expect(service.createEmbeddings(testQuery)).rejects.toThrow(errorMessage);
    });
  });

  // Add more tests for other methods like generateChatCompletion, uploadFile, etc., as needed.
  // For example, a simple test for generateChatCompletion if it's used elsewhere and critical:
  describe('generateChatCompletion', () => {
    it('should call openai.chat.completions.create with appropriate parameters', async () => {
        const messages = [{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now(), status: 'complete' } as any];
        const options = { model: 'gpt-3.5-turbo', temperature: 0.5, systemPrompt: 'Be brief.' };
        
        currentMockChatCompletionsCreate.mockResolvedValue({
            id: 'chatcmpl-xxxx',
            object: 'chat.completion',
            created: Date.now(),
            model: options.model,
            choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        });

        // The method returns a Web API Response object. We check the call to OpenAI SDK here.
        await service.generateChatCompletion(messages, options);

        expect(currentMockChatCompletionsCreate).toHaveBeenCalledWith({
            model: options.model,
            messages: [
                { role: 'system', content: options.systemPrompt },
                { role: 'user', content: 'Hello' },
            ],
            temperature: options.temperature,
        });
    });
  });

}); 