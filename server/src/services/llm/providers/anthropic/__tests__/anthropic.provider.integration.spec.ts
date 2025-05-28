import { AnthropicProvider } from '../anthropic.provider';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ChatCompletionRequest, LLMResponse } from '../../../types/llm-request.types';
import { LLMProviderError } from '../../../types/llm-types';

// Mock ConfigService and Logger for integration tests
// In a full NestJS testing setup, these might be provided by the testing module
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'ANTHROPIC_API_KEY') {
      return process.env.ANTHROPIC_API_KEY;
    }
    if (key === 'ANTHROPIC_BASE_URL') {
      return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
    }
    // Add other config variables if your provider uses them
    return null;
  }),
} as any as ConfigService;

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setLogLevels: jest.fn(), // Added setLogLevels to satisfy the Logger interface
} as any as Logger;

describe('AnthropicProvider Integration Tests', () => {
  let anthropicProvider: AnthropicProvider;

  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable must be set for integration tests.');
    }
    anthropicProvider = new AnthropicProvider(mockConfigService);
  });

  describe('generateChatCompletion', () => {
    // List of Anthropic models you want to test against
    // Ensure these are models you have access to and are currently supported
    const modelsToTest = [
      'claude-opus-4-20250514',     // Claude Opus 4 (Latest & most capable)
      'claude-sonnet-4-20250514',   // Claude Sonnet 4 (Latest high-performance)
      'claude-3-7-sonnet-20250219', // Claude Sonnet 3.7 (High-performance with early extended thinking)
      'claude-3-5-sonnet-20241022', // Claude Sonnet 3.5 (Latest version of 3.5)
      'claude-3-opus-20240229',     // Claude Opus 3 (Previous generation most capable)
      'claude-3-haiku-20240307',    // Claude Haiku 3 (Fastest and most compact)
    ];

    modelsToTest.forEach(model => {
      it(`should get a successful chat completion from ${model}`, async () => {
        const request: ChatCompletionRequest = {
          messages: [{ role: 'user', content: 'Hello Claude! What is the capital of France?' }],
          model: model,
          temperature: 0.7,
          maxTokens: 60, // Adjusted to ensure a more complete answer for 'paris'
        };

        let response: LLMResponse | null = null;
        try {
          response = await anthropicProvider.generateChatCompletion(request);

          expect(response).toBeDefined();
          expect(response?.content).toBeDefined();
          expect(typeof response?.content).toBe('string');
          // Making the check case-insensitive and more robust
          expect(response?.content?.toLowerCase()).toContain('paris');
          expect(response?.metadata.model).toBe(model);
          expect(response?.usage).toBeDefined();
          expect(response?.usage?.promptTokens).toBeGreaterThan(0);
          expect(response?.usage?.completionTokens).toBeGreaterThan(0);
          // Depending on maxTokens and model, finishReason can vary.
          // 'max_tokens' is likely if the response is truncated.
          // 'stop_sequence' is common if the model finishes naturally.
          expect(['max_tokens', 'stop_sequence', 'stop']).toContain(response?.finishReason);


        } catch (error) {
          console.error(`Error during test for model ${model} with request:`, request, 'Response:', response);
          console.error('Full error object:', error);
          // If it's an API error, Anthropic errors usually have a type and message
          if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
             console.error(`Anthropic API Error: Type - ${(error as any).type}, Message - ${(error as any).message}`);
          }
          throw error; // Re-throw to fail the test explicitly
        }
      }, 30000); // 30-second timeout for each API call
    });

    it('should handle API error for chat completion (e.g., invalid API key)', async () => {
      // Create a new provider instance with an invalid API key for this test
      const invalidKeyConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'ANTHROPIC_API_KEY') {
            return 'THIS_IS_AN_INVALID_API_KEY';
          }
          if (key === 'ANTHROPIC_BASE_URL') {
            return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
          }
          return null;
        }),
      } as any as ConfigService;
      const providerWithInvalidKey = new AnthropicProvider(invalidKeyConfigService);

      const request: ChatCompletionRequest = {
        messages: [{ role: 'user', content: 'This request should fail.' }],
        model: 'claude-3-haiku-20240307', // Use a fast model for error testing
      };

      try {
        await providerWithInvalidKey.generateChatCompletion(request);
        // If the above line does not throw, the test should fail.
        fail('The generateChatCompletion method should have thrown an error for an invalid API key.');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error).toBeInstanceOf(LLMProviderError); // Check if it's our wrapped error
        expect(error.message).toMatch(/Anthropic client error/i); // General wrapped error message

        // Check the original error for the specific authentication issue
        const originalError = error.originalError;
        expect(originalError).toBeDefined();
        
        // Anthropic SDK errors often have a status and an error object with type and message
        if (originalError && originalError.status === 401 && originalError.error && originalError.error.error) {
          expect(originalError.error.error.type).toBe('authentication_error');
          expect(originalError.error.error.message).toMatch(/invalid x-api-key/i);
        } else {
          // Fallback if the structure is different or less nested
          expect(originalError.message).toMatch(/invalid x-api-key|authentication_error/i);
        }
      }
    }, 15000); // 15-second timeout for error test

    // Potential future tests:
    // - Test with system prompts
    // - Test with tool usage (once supported and defined in ILLMProvider)
    // - Test streaming responses (once supported and defined in ILLMProvider)
    // - Test requests near max token limits for prompts/completions
    // - Test for specific error types (e.g., rate limits, model not found)
  });

  describe('streamChatCompletion', () => {
    const modelToTest = 'claude-3-haiku-20240307'; // Use a fast and cost-effective model for streaming tests

    it(`should get a successful streaming chat completion from ${modelToTest}`, async () => {
      const request: ChatCompletionRequest = {
        messages: [{ role: 'user', content: 'Hello Claude! Tell me a very short story about a brave robot.' }],
        model: modelToTest,
        temperature: 0.7,
        maxTokens: 150,
        stream: true, // Explicitly enabling stream
      };

      let fullContent = '';
      let chunkCount = 0;
      let finalResponseMetadata: any = null;
      let usageInfo: any = null;

      try {
        const streamingResponse = await anthropicProvider.streamChatCompletion(request);
        expect(streamingResponse).toBeDefined();
        expect(streamingResponse.stream).toBeDefined();
        expect(streamingResponse.metadata?.model).toBe(modelToTest);

        for await (const chunk of streamingResponse.stream) {
          expect(chunk).toBeDefined();
          chunkCount++;
          if (chunk.delta) {
            fullContent += chunk.delta;
          }
          if (chunk.finishReason) { // Anthropic sends usage and stop_reason in the last 'message_stop' event
            finalResponseMetadata = chunk; // The last chunk often has more complete metadata
          }
          if(chunk.usage) {
            usageInfo = chunk.usage;
          }
        }

        expect(chunkCount).toBeGreaterThan(0);
        expect(fullContent.length).toBeGreaterThan(0);
        expect(fullContent.toLowerCase()).toContain('robot'); // Check for relevant content
        
        // Check for finish reason and usage in the final relevant chunk
        expect(finalResponseMetadata).toBeDefined();
        // Anthropic streaming might send 'stop_sequence' or 'max_tokens' in the 'message_stop' event's content_block_stop or similar event_type.
        // The ILLMProvider interface maps this to StreamChunk.finishReason
        expect(['stop_sequence', 'max_tokens', 'stop']).toContain(finalResponseMetadata?.finishReason);

        expect(usageInfo).toBeDefined();
        expect(usageInfo.promptTokens).toBeGreaterThan(0);
        expect(usageInfo.completionTokens).toBeGreaterThan(0); // For Anthropic, output_tokens in usage

        console.log(`✅ Streamed from ${modelToTest}: ${fullContent.substring(0,100)}... (${chunkCount} chunks)`);

      } catch (error) {
        console.error(`Error during streaming test for model ${modelToTest}:`, error);
        throw error;
      }
    }, 30000); // 30-second timeout for the streaming test

    it('should handle API error for streaming chat completion (e.g., invalid API key)', async () => {
      const invalidKeyConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'ANTHROPIC_API_KEY') return 'THIS_IS_AN_INVALID_API_KEY';
          return null;
        }),
      } as any as ConfigService;
      const providerWithInvalidKey = new AnthropicProvider(invalidKeyConfigService);

      const request: ChatCompletionRequest = {
        messages: [{ role: 'user', content: 'This stream should fail.' }],
        model: 'claude-3-haiku-20240307',
        stream: true,
      };

      try {
        await providerWithInvalidKey.streamChatCompletion(request);
        fail('The streamChatCompletion method should have thrown an error for an invalid API key.');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error).toBeInstanceOf(LLMProviderError);
        expect(error.message).toMatch(/Anthropic client error/i);
        
        const originalError = error.originalError;
        expect(originalError).toBeDefined();
        if (originalError && originalError.status === 401 && originalError.error && originalError.error.error) {
          expect(originalError.error.error.type).toBe('authentication_error');
        } else {
          expect(originalError.message).toMatch(/invalid x-api-key|authentication_error/i);
        }
      }
    }, 15000);
  });

  // Placeholder for generateEmbedding tests, if Anthropic models are used for embeddings
  // and if the AnthropicProvider implements this part of ILLMProvider.
  // describe('generateEmbedding', () => {
  //   it.skip('should generate embeddings successfully (if supported)', async () => {
  //     // const request: EmbeddingRequest = { input: ['Test embedding string'] };
  //     // const response: EmbeddingResponse = await anthropicProvider.generateEmbedding(request);
  //     // expect(response.embeddings).toBeInstanceOf(Array);
  //     // expect(response.embeddings[0]).toBeInstanceOf(Array);
  //     // expect(response.embeddings[0].length).toBeGreaterThan(0);
  //   });
  // });

  // Placeholder for getModels tests
  // describe('getModels', () => {
  //   it.skip('should retrieve a list of available Anthropic models (if implemented)', async () => {
  //     // const models = await anthropicProvider.getModels();
  //     // expect(models).toBeInstanceOf(Array);
  //     // expect(models.length).toBeGreaterThan(0);
  //     // models.forEach(model => {
  //     //   expect(model).toHaveProperty('id');
  //     //   expect(model).toHaveProperty('provider', 'anthropic');
  //     // });
  //   });
  // });
  
  // Placeholder for isAvailable tests
  // describe('isAvailable', () => {
  //    it.skip('should return true if the API key is valid and API is reachable', async () => {
  //        const available = await anthropicProvider.isAvailable();
  //        expect(available).toBe(true);
  //    });

  //    it.skip('should return false if the API key is invalid', async () => {
  //        const invalidKeyConfig = { get: jest.fn().mockReturnValue('invalid-key') } as any as ConfigService;
  //        const providerWithInvalidKey = new AnthropicProvider(invalidKeyConfig, mockLogger);
  //        const available = await providerWithInvalidKey.isAvailable();
  //        expect(available).toBe(false);
  //    });
  // });

}); 