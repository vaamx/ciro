import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIService, ChatMessage, ChatOptions, EmbeddingAPIOptions } from './openai.service';
import OpenAI from 'openai'; // Import the main OpenAI type for mocking and for asserting constructor calls
import * as fs from 'fs';
import type { FilePurpose } from 'openai/resources'; // Added import for FilePurpose
import { ConfigService } from '@nestjs/config';
import { ReadableStream } from 'stream/web'; // For mocking stream responses

// Remove global const method mocks, they will be defined inside jest.mock factory
// const mockEmbeddingsCreate = jest.fn();
// const mockChatCompletionsCreate = jest.fn();
// ... and so on for others

jest.mock('openai', () => {
  // Define all method mocks needed by the OpenAI client instance here, locally to the factory
  const mockEmbeddingsCreateInternal = jest.fn();
  const mockChatCompletionsCreateInternal = jest.fn();
  const mockFilesCreateInternal = jest.fn();
  const mockFineTuningJobsCreateInternal = jest.fn();
  const mockFineTuningJobsRetrieveInternal = jest.fn();
  const mockFineTuningJobsCancelInternal = jest.fn();

  const constructorMock = jest.fn().mockImplementation(() => ({
    embeddings: { create: mockEmbeddingsCreateInternal },
    chat: { completions: { create: mockChatCompletionsCreateInternal } },
    files: { create: mockFilesCreateInternal },
    fineTuning: {
      jobs: {
        create: mockFineTuningJobsCreateInternal,
        retrieve: mockFineTuningJobsRetrieveInternal,
        cancel: mockFineTuningJobsCancelInternal,
      }
    }
  }));

  // Attach the internal method mocks to the constructor mock itself
  // This allows tests to access them via: (OpenAI as any).mockEmbeddingsCreate.toHaveBeenCalledWith(...)
  (constructorMock as any).mockEmbeddingsCreate = mockEmbeddingsCreateInternal;
  (constructorMock as any).mockChatCompletionsCreate = mockChatCompletionsCreateInternal;
  (constructorMock as any).mockFilesCreate = mockFilesCreateInternal;
  (constructorMock as any).mockFineTuningJobsCreate = mockFineTuningJobsCreateInternal;
  (constructorMock as any).mockFineTuningJobsRetrieve = mockFineTuningJobsRetrieveInternal;
  (constructorMock as any).mockFineTuningJobsCancel = mockFineTuningJobsCancelInternal;

  return constructorMock;
});

// Mock for 'fs' can come after, its order relative to 'openai' mock is less critical here
jest.mock('fs', () => ({
  ...jest.requireActual('fs'), // Import and retain default behavior
  createReadStream: jest.fn(), // Override createReadStream with a mock function
}));

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
  // References to specific method mocks for convenience in tests
  let mockEmbeddingsCreate: jest.Mock;
  let mockChatCompletionsCreate: jest.Mock;
  let mockFilesCreate: jest.Mock;
  let mockFineTuningJobsCreate: jest.Mock;
  let mockFineTuningJobsRetrieve: jest.Mock;
  let mockFineTuningJobsCancel: jest.Mock;

  beforeEach(async () => {
    // Clear the main constructor mock and its attached method mocks implicitly via jest.clearAllMocks()
    // or specifically if needed after jest.resetModules()
    jest.clearAllMocks(); // This should clear the OpenAI import mock and its properties

    // Re-assign convenience variables to the method mocks attached to the (now fresh) OpenAI mock constructor
    mockEmbeddingsCreate = (OpenAI as any).mockEmbeddingsCreate;
    mockChatCompletionsCreate = (OpenAI as any).mockChatCompletionsCreate;
    mockFilesCreate = (OpenAI as any).mockFilesCreate;
    mockFineTuningJobsCreate = (OpenAI as any).mockFineTuningJobsCreate;
    mockFineTuningJobsRetrieve = (OpenAI as any).mockFineTuningJobsRetrieve;
    mockFineTuningJobsCancel = (OpenAI as any).mockFineTuningJobsCancel;

    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenAIService], // ConfigService might be needed by the actual service if it used DI for config
    }).compile();
    service = module.get<OpenAIService>(OpenAIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmbeddings', () => {
    const testQuery = 'Test query for embedding';
    const mockEmbeddingVector = [0.1, 0.2, 0.3, 0.4];

    beforeEach(() => {
      // Setup default mock response for embeddings.create
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbeddingVector, index: 0 }],
        model: 'text-embedding-ada-002', // Default model in service
        object: 'list',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      });
    });

    it('should call openai.embeddings.create with default model if no model is provided', async () => {
      await service.createEmbeddings(testQuery);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: [testQuery],
      });
    });

    it('should call openai.embeddings.create with the specified model', async () => {
      const customModel = 'text-embedding-custom-model';
      await service.createEmbeddings(testQuery, { model: customModel });
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: customModel,
        input: [testQuery],
      });
    });

    it('should include dimensions in the request if provided', async () => {
      const customModel = 'text-embedding-vNext';
      const dimensions = 512;
      await service.createEmbeddings(testQuery, { model: customModel, dimensions });
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: customModel,
        input: [testQuery],
        dimensions: dimensions, // Type Parameters<typeof openai.embeddings.create>[0] should allow this if SDK supports it
      });
    });

    it('should handle an array of queries', async () => {
      const queries = ['query1', 'query2'];
      mockEmbeddingsCreate.mockResolvedValue({
        data: [
          { embedding: [0.1], index: 0 },
          { embedding: [0.2], index: 1 },
        ],
        model: 'text-embedding-ada-002',
        object: 'list',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      });
      await service.createEmbeddings(queries);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
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
      mockEmbeddingsCreate.mockRejectedValue(new Error(errorMessage));
      await expect(service.createEmbeddings(testQuery)).rejects.toThrow(errorMessage);
    });
  });

  // Add more tests for other methods like generateChatCompletion, uploadFile, etc., as needed.
  // For example, a simple test for generateChatCompletion if it's used elsewhere and critical:
  describe('generateChatCompletion', () => {
    // Define a type for the expected response body for clarity
    interface MockResponseBody {
      id: string;
      role: string;
      content: string;
      timestamp: number;
      status: string;
      metadata: {
        model: string;
        tokens: {
          prompt: number;
          completion: number;
          total: number;
        };
      };
    }

    const sampleMessages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: Date.now(), status: 'complete' },
      { id: '2', role: 'assistant', content: 'Hi there!', timestamp: Date.now(), status: 'complete' },
      { id: '3', role: 'user', content: 'How are you?', timestamp: Date.now(), status: 'complete' },
    ];
    const mockChatId = 'chatcmpl-mockid123';
    const mockContent = 'I am fine, thank you!';
    const mockPromptTokens = 15;
    const mockCompletionTokens = 10;
    const mockTotalTokens = 25;

    const setupMockSuccess = (customContent?: string, customModel?: string) => {
      mockChatCompletionsCreate.mockResolvedValue({
        id: mockChatId,
        object: 'chat.completion',
        created: Date.now() / 1000, // OpenAI uses seconds
        model: customModel || 'gpt-3.5-turbo',
        choices: [{ index: 0, message: { role: 'assistant', content: customContent || mockContent }, finish_reason: 'stop' }],
        usage: { prompt_tokens: mockPromptTokens, completion_tokens: mockCompletionTokens, total_tokens: mockTotalTokens },
      });
    };

    it('should call openai.chat.completions.create and return correctly formatted non-streaming response', async () => {
      const options: ChatOptions = { model: 'gpt-3.5-turbo', temperature: 0.5, systemPrompt: 'Be brief.', stream: false };
      setupMockSuccess(mockContent, options.model);

      const response = await service.generateChatCompletion(sampleMessages, options);
      const responseBody = await response.json() as MockResponseBody;

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: options.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
        temperature: options.temperature,
        // stream: false is the default for the SDK call if not specified, so we don't strictly need to assert it unless the service explicitly sets it to false.
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toEqual('application/json');
      expect(responseBody.id).toBe(mockChatId);
      expect(responseBody.role).toBe('assistant');
      expect(responseBody.content).toBe(mockContent);
      expect(responseBody.status).toBe('complete');
      expect(responseBody.metadata.model).toBe(options.model);
      expect(responseBody.metadata.tokens.prompt).toBe(mockPromptTokens);
      expect(responseBody.metadata.tokens.completion).toBe(mockCompletionTokens);
      expect(responseBody.metadata.tokens.total).toBe(mockTotalTokens);
      expect(responseBody.timestamp).toBeDefined();
    });

    it('should use default systemPrompt if not provided in options (non-streaming)', async () => {
      const options: ChatOptions = { model: 'gpt-4', stream: false }; // No systemPrompt
      setupMockSuccess(mockContent, options.model);

      await service.generateChatCompletion(sampleMessages, options);

      // More specific assertions
      expect(mockChatCompletionsCreate).toHaveBeenCalled();
      const mockCalls = mockChatCompletionsCreate.mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      const lastCallArgs = mockCalls[mockCalls.length - 1][0]; // Arguments of the last call
      
      expect(lastCallArgs.messages).toEqual(
        expect.arrayContaining([
          { role: 'system', content: 'You are a helpful AI assistant.' }
        ])
      );
      expect(lastCallArgs.model).toBe(options.model);
      // Optionally, check that temperature is the default if not overridden
      expect(lastCallArgs.temperature).toBe(0.7); // Default from service
    });
    
    it('should map ChatMessage roles correctly, including \'error\' to \'assistant\' (non-streaming)', async () => {
      const messagesWithSystemAndError: ChatMessage[] = [
        { id: 'sys', role: 'system', content: 'System override.', timestamp: Date.now(), status: 'complete' },
        { id: 'u1', role: 'user', content: 'User query 1', timestamp: Date.now(), status: 'complete' },
        { id: 'a1', role: 'assistant', content: 'Assistant response 1', timestamp: Date.now(), status: 'complete' },
        { id: 'e1', role: 'error', content: 'Some error message content', timestamp: Date.now(), status: 'complete' },
      ];
      const systemPrompt = 'Specific System Prompt';
      setupMockSuccess();

      await service.generateChatCompletion(messagesWithSystemAndError, { systemPrompt, stream: false });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: systemPrompt },
            // The service's mapping logic takes ChatMessage[] and prepends its own system message.
            // So, 'system' role messages from input ChatMessage[] are effectively treated like 'user' or 'assistant' by OpenAI SDK if not filtered.
            // The current service implementation for generateChatCompletion prepends a system message from options OR a default.
            // It then maps the input `messages` array. A `ChatMessage` with `role: 'system'` would be passed as is by the map.
            // Let's verify based on current service logic for `generateChatCompletion`:
            // { role: 'system', content: 'System override.' }, // This will be part of the mapped messages sent to OpenAI
            { role: 'user', content: 'User query 1' },
            { role: 'assistant', content: 'Assistant response 1' },
            { role: 'assistant', content: 'Some error message content' }, // 'error' role mapped to 'assistant'
          ],
        })
      );
    });

    // Placeholder for streaming success tests
    describe('Streaming Success', () => {
      it('should return a Response object with SSE headers and stream body for streaming', async () => {
        const mockStream = new ReadableStream({
          start(controller) {
            controller.enqueue('event: message\ndata: chunk1\n\n');
            controller.close();
          }
        });
        mockChatCompletionsCreate.mockResolvedValue(mockStream as any); // Cast as any to satisfy OpenAI SDK complex type

        const options: ChatOptions = { model: 'gpt-3.5-turbo', stream: true };
        const response = await service.generateChatCompletion(sampleMessages, options);

        expect(response).toBeInstanceOf(Response);
        expect(response.headers.get('Content-Type')).toEqual('text/event-stream');
        expect(response.headers.get('Cache-Control')).toEqual('no-cache');
        expect(response.headers.get('Connection')).toEqual('keep-alive');
        
        // Check if the body is the stream we provided
        // Note: Directly comparing stream instances might be tricky.
        // For this test, we are ensuring the mock stream set up in the mockResolvedValue is what is returned.
        // A more robust test might involve reading from response.body and verifying content if the service modified the stream,
        // but the current service code returns the SDK stream directly.
        expect(response.body).toBe(mockStream);

        // Verify the SDK was called with stream: true implicitly by the service (if that were the logic)
        // or explicitly if the service passes it. The current service logic doesn't explicitly pass stream: true to the SDK for this method,
        // as it relies on the SDK's own handling if the return is a stream.
        // The service.generateChatCompletion method itself has stream in its options and if true, returns new Response(completion as any, ...)
        // So we ensure the mock is set up to return a stream when create() is called.
        expect(mockChatCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
          model: options.model,
          // stream: true, // The SDK call for non-streaming and streaming is the same, the handling of the return differs.
        }));
      });

      it.todo('should stream data correctly in SSE format'); // This would be more for generateStreamingResponse
    });
    
    // Placeholder for error handling tests
    describe('Error Handling', () => {
      it('should return a 500 error response for non-streaming API failure', async () => {
        const errorMessage = 'OpenAI API Error (Non-Stream)';
        mockChatCompletionsCreate.mockRejectedValue(new Error(errorMessage));

        const options: ChatOptions = { model: 'gpt-3.5-turbo', stream: false };
        const response = await service.generateChatCompletion(sampleMessages, options);
        const responseBody = await response.json() as any; // Type safety for error structure

        expect(response.status).toBe(500);
        expect(response.headers.get('Content-Type')).toEqual('application/json');
        expect(responseBody.role).toBe('error');
        expect(responseBody.content).toBe('Sorry, there was an error processing your request. Please try again.');
        expect(responseBody.status).toBe('error');
      });
      
      it('should return a 500 error response if API call fails synchronously during streaming request', async () => {
        const errorMessage = 'OpenAI API Error (Stream Sync Fail)';
        mockChatCompletionsCreate.mockRejectedValue(new Error(errorMessage));

        const options: ChatOptions = { model: 'gpt-3.5-turbo', stream: true };
        const response = await service.generateChatCompletion(sampleMessages, options);
        const responseBody = await response.json() as any; // Type safety for error structure

        expect(response.status).toBe(500);
        expect(response.headers.get('Content-Type')).toEqual('application/json');
        expect(responseBody.role).toBe('error');
        expect(responseBody.content).toBe('Sorry, there was an error processing your request. Please try again.');
        expect(responseBody.status).toBe('error');
      });

      // it.todo('should handle API error during streaming'); // This is covered by generateStreamingResponse tests usually
    });

  });

  describe('generateStreamingResponse', () => {
    const testQuery = 'Stream this query';
    const mockDocuments: any[] = [{ id: 'doc1', content: 'Some context' }];
    
    async function* mockOpenAIStream(chunks: string[]) {
      for (const content of chunks) {
        yield { choices: [{ delta: { content } }] };
      }
    }

    async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<string[]> {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const receivedChunks: string[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          receivedChunks.push(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }
      return receivedChunks.join('').split('\n\n').filter(s => s.trim() !== ''); // Split by SSE message boundary and filter empty
    }

    it('should stream data correctly in SSE format on success', async () => {
      const contentChunks = ['Hello', ' ', 'World', '!'];
      mockChatCompletionsCreate.mockResolvedValue(mockOpenAIStream(contentChunks) as any);

      const stream = await service.generateStreamingResponse(testQuery, mockDocuments);
      const sseMessages = await consumeStream(stream);

      expect(sseMessages.length).toBe(contentChunks.length);
      expect(sseMessages[0]).toBe('data: {"text":"Hello"}');
      expect(sseMessages[1]).toBe('data: {"text":" "}');
      expect(sseMessages[2]).toBe('data: {"text":"World"}');
      expect(sseMessages[3]).toBe('data: {"text":"!"}');

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview', // Default in service
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant. You analyze data and provide insights.' }, // Default
          { role: 'user', content: testQuery },
        ],
        temperature: 0.7, // Default
        stream: true,
      });
    });

    async function* mockOpenAIStreamWithError(chunks: string[], errorMessage: string) {
      for (const content of chunks) {
        yield { choices: [{ delta: { content } }] };
      }
      throw new Error(errorMessage);
    }

    it('should send SSE error if OpenAI stream yields an error chunk or fails mid-stream', async () => {
      const contentChunks = ['First', 'Second'];
      const streamErrorMessage = 'Stream failed mid-way';
      mockChatCompletionsCreate.mockResolvedValue(mockOpenAIStreamWithError(contentChunks, streamErrorMessage) as any);

      const stream = await service.generateStreamingResponse(testQuery, mockDocuments);
      const sseMessages = await consumeStream(stream);

      expect(sseMessages.length).toBe(contentChunks.length + 1); // Data chunks + 1 error chunk
      expect(sseMessages[0]).toBe('data: {"text":"First"}');
      expect(sseMessages[1]).toBe('data: {"text":"Second"}');
      expect(sseMessages[2]).toBe(`data: ${JSON.stringify({ error: true, message: streamErrorMessage })}`);
    });

    it('should send SSE error if openai.chat.completions.create call fails synchronously', async () => {
      const errorMessage = 'SDK Create Error';
      mockChatCompletionsCreate.mockRejectedValue(new Error(errorMessage));

      const stream = await service.generateStreamingResponse(testQuery, mockDocuments);
      const sseMessages = await consumeStream(stream);
      
      expect(sseMessages.length).toBe(1);
      expect(sseMessages[0]).toBe(`data: ${JSON.stringify({ error: true, message: errorMessage })}`);
    });

    it.todo('should call processingStatusCallback and metadataCallback if provided');
  });

  describe('uploadFile', () => {
    const mockFilePath = '/tmp/fakefile.txt';
    // let mockFsCreateReadStream: jest.SpyInstance; // No longer a SpyInstance

    beforeEach(() => {
      // Ensure the mock is clean before each test in this block
      (fs.createReadStream as jest.Mock).mockClear();
      // currentMockFilesCreate is cleared in the main file-level beforeEach
      (fs.createReadStream as jest.Mock).mockReturnValueOnce('mocked-stream-data' as any);
    });

    // afterEach is not strictly needed if mockClear() is used in beforeEach
    // and if we are not restoring a spyOn a real module part.

    it('should call openai.files.create with correct parameters and return file object', async () => {
      const fixedTimestamp = Date.now(); // Use a fixed timestamp
      mockFilesCreate.mockResolvedValue({ id: 'file-123', object: 'file', bytes: 1024, created_at: fixedTimestamp, filename: 'file.jsonl', purpose: 'fine-tune' });

      const result = await service.uploadFile(mockFilePath, 'fine-tune');

      expect(fs.createReadStream).toHaveBeenCalledWith(mockFilePath);
      expect(mockFilesCreate).toHaveBeenCalledWith({
        file: 'mocked-stream-data',
        purpose: 'fine-tune',
      });
      // expect(result).toEqual({ id: 'file-123', object: 'file', bytes: 1024, created_at: Date.now(), filename: 'file.jsonl', purpose: 'fine-tune' });
      expect(result).toEqual({ id: 'file-123', object: 'file', bytes: 1024, created_at: fixedTimestamp, filename: 'file.jsonl', purpose: 'fine-tune' });
    });

    it('should throw an error if openai.files.create fails', async () => {
      const errorMessage = 'File upload failed';
      mockFilesCreate.mockRejectedValue(new Error(errorMessage));

      await expect(service.uploadFile(mockFilePath, 'fine-tune')).rejects.toThrow(errorMessage);
    });
  });

  describe('Fine-Tuning Methods', () => {
    const mockJobId = 'ftjob-12345';
    const mockFineTuneParams = {
      training_file: 'file-train123',
      model: 'gpt-3.5-turbo-0613',
      suffix: 'my-custom-model',
      hyperparameters: { n_epochs: 4 },
    };
    const mockFineTuneObject = { id: mockJobId, object: 'fine_tuning.job', model: mockFineTuneParams.model, training_file: mockFineTuneParams.training_file, status: 'succeeded' }; // Simplified

    describe('createFineTuningJob', () => {
      it('should call openai.fineTuning.jobs.create with correct params and return job object', async () => {
        mockFineTuningJobsCreate.mockResolvedValue(mockFineTuneObject);
        const result = await service.createFineTuningJob(mockFineTuneParams);
        expect(mockFineTuningJobsCreate).toHaveBeenCalledWith(mockFineTuneParams);
        expect(result).toEqual(mockFineTuneObject);
      });

      it('should throw an error if openai.fineTuning.jobs.create fails', async () => {
        const errorMessage = 'Fine-tune creation failed';
        mockFineTuningJobsCreate.mockRejectedValue(new Error(errorMessage));
        await expect(service.createFineTuningJob(mockFineTuneParams)).rejects.toThrow(errorMessage);
      });
    });

    describe('getFineTuningJob', () => {
      it('should call openai.fineTuning.jobs.retrieve with job ID and return job object', async () => {
        mockFineTuningJobsRetrieve.mockResolvedValue(mockFineTuneObject);
        const result = await service.getFineTuningJob(mockJobId);
        expect(mockFineTuningJobsRetrieve).toHaveBeenCalledWith(mockJobId);
        expect(result).toEqual(mockFineTuneObject);
      });

      it('should throw an error if openai.fineTuning.jobs.retrieve fails', async () => {
        const errorMessage = 'Fine-tune retrieval failed';
        mockFineTuningJobsRetrieve.mockRejectedValue(new Error(errorMessage));
        await expect(service.getFineTuningJob(mockJobId)).rejects.toThrow(errorMessage);
      });
    });

    describe('cancelFineTuningJob', () => {
      it('should call openai.fineTuning.jobs.cancel with job ID and return job object', async () => {
        const mockCancelledJob = { ...mockFineTuneObject, status: 'cancelled' };
        mockFineTuningJobsCancel.mockResolvedValue(mockCancelledJob);
        const result = await service.cancelFineTuningJob(mockJobId);
        expect(mockFineTuningJobsCancel).toHaveBeenCalledWith(mockJobId);
        expect(result).toEqual(mockCancelledJob);
      });

      it('should throw an error if openai.fineTuning.jobs.cancel fails', async () => {
        const errorMessage = 'Fine-tune cancellation failed';
        mockFineTuningJobsCancel.mockRejectedValue(new Error(errorMessage));
        await expect(service.cancelFineTuningJob(mockJobId)).rejects.toThrow(errorMessage);
      });
    });
  });

  describe('Configuration', () => {
    let DynamicallyImportedOpenAIMock: jest.Mock;

    beforeEach(async () => {
      jest.resetModules(); 
      
      // Re-import OpenAI to get the fresh mock constructor after resetModules
      // Correctly access the default export if 'openai' is an ES module mock
      const openAIMockModule = await import('openai');
      DynamicallyImportedOpenAIMock = openAIMockModule.default as jest.Mock;
      
      // Re-assign convenience variables to the method mocks attached to the fresh OpenAI mock constructor
      mockEmbeddingsCreate = (DynamicallyImportedOpenAIMock as any).mockEmbeddingsCreate;
      mockChatCompletionsCreate = (DynamicallyImportedOpenAIMock as any).mockChatCompletionsCreate;
      mockFilesCreate = (DynamicallyImportedOpenAIMock as any).mockFilesCreate;
      mockFineTuningJobsCreate = (DynamicallyImportedOpenAIMock as any).mockFineTuningJobsCreate;
      mockFineTuningJobsRetrieve = (DynamicallyImportedOpenAIMock as any).mockFineTuningJobsRetrieve;
      mockFineTuningJobsCancel = (DynamicallyImportedOpenAIMock as any).mockFineTuningJobsCancel;

      // Clear these newly reassigned method mocks
      mockEmbeddingsCreate.mockClear();
      mockChatCompletionsCreate.mockClear();
      mockFilesCreate.mockClear();
      mockFineTuningJobsCreate.mockClear();
      mockFineTuningJobsRetrieve.mockClear();
      mockFineTuningJobsCancel.mockClear();
    });

    it('should initialize OpenAI client with apiKey and orgId from config', async () => {
      jest.mock('../../config', () => ({
        __esModule: true, 
        config: {
          openai: {
            apiKey: 'test-api-key-from-config',
            orgId: 'test-org-id-from-config',
          },
        },
      }));
      const { OpenAIService: ConfiguredService } = await import('./openai.service');
      new ConfiguredService(); 
      expect(DynamicallyImportedOpenAIMock).toHaveBeenCalledWith({ 
        apiKey: 'test-api-key-from-config',
        organization: 'test-org-id-from-config',
      });
    });

    it('should initialize OpenAI client with empty string for apiKey if not in config', async () => {
      jest.mock('../../config', () => ({
        __esModule: true,
        config: {
          openai: {
            orgId: 'test-org-id-no-apikey',
          },
        },
      }));
      const { OpenAIService: ConfiguredService } = await import('./openai.service');
      new ConfiguredService();
      expect(DynamicallyImportedOpenAIMock).toHaveBeenCalledWith({ 
        apiKey: '',
        organization: 'test-org-id-no-apikey',
      });
    });

    it('should initialize OpenAI client with undefined for orgId if not in config', async () => {
      jest.mock('../../config', () => ({
        __esModule: true,
        config: {
          openai: {
            apiKey: 'test-api-key-no-orgid',
          },
        },
      }));
      const { OpenAIService: ConfiguredService } = await import('./openai.service');
      new ConfiguredService();
      expect(DynamicallyImportedOpenAIMock).toHaveBeenCalledWith({ 
        apiKey: 'test-api-key-no-orgid',
        organization: undefined,
      });
    });
  });

  // TODO: Add configuration tests (API key, org ID handling)
});

// It can be helpful to namespace types imported from the service if they are also named generically
// However, ChatMessage and ChatOptions are interfaces in the service file and not directly exported modules.
// For testing, we typically rely on structural compatibility or define local interfaces for casting.
// Let's define a namespace here to mirror the structure if we were to import them.
namespace OpenAIServiceNamespace {
  export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'error';
    content: string;
    timestamp: number;
    status: 'complete' | 'streaming' | 'error' | 'loading';
    metadata?: any; // Loosen for testing if exact structure isn't critical for all tests
  }

  export interface ChatOptions {
    model?: string;
    temperature?: number;
    stream?: boolean;
    systemPrompt?: string;
  }
} 