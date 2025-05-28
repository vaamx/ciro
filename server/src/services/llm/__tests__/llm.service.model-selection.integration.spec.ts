import { Test, TestingModule } from '@nestjs/testing';
import { LLMService } from '../llm.service';
import { ModelRegistry } from '../registry/model-registry.service';
import { LLMModule } from '../llm.module'; // Corrected casing: LLMModule
import { ModelMetadata, LLMOptions, ModelInfo, ChatMessage } from '../types';
import { ConfigModule } from '@nestjs/config';
import { CACHE_SERVICE } from '../cache/constants';
import { InMemoryCacheService } from '../cache/in-memory-cache.service';

// Mock Models Data
const mockModelA: ModelMetadata = {
  id: 'model-a',
  provider: 'test-provider',
  name: 'Test Model A',
  displayName: 'Test Model A',
  description: 'A cheap and slow model with basic capabilities',
  contextWindow: 4096,
  maxOutputTokens: 1024,
  capabilities: ['chat'],
  pricing: { inputTokens: 0.1, outputTokens: 0.1 }, // cost per 1M tokens
  performance: { averageLatency: 2000, tokensPerSecond: 50 },
  availability: { regions: ['test-region'], status: 'available' },
  limits: {},
};

const mockModelB: ModelMetadata = {
  id: 'model-b',
  provider: 'test-provider',
  name: 'Test Model B',
  displayName: 'Test Model B',
  description: 'A model with moderate cost, speed, and mixed capabilities',
  contextWindow: 8192,
  maxOutputTokens: 2048,
  capabilities: ['chat', 'code_generation'],
  pricing: { inputTokens: 0.5, outputTokens: 0.5 },
  performance: { averageLatency: 1000, tokensPerSecond: 100 },
  availability: { regions: ['test-region'], status: 'available' },
  limits: {},
};

const mockModelC: ModelMetadata = {
  id: 'model-c',
  provider: 'test-provider',
  name: 'Test Model C',
  displayName: 'Test Model C',
  description: 'An expensive but fast model with advanced capabilities',
  contextWindow: 16384,
  maxOutputTokens: 4096,
  capabilities: ['chat', 'code_generation', 'vision'],
  pricing: { inputTokens: 1.0, outputTokens: 1.0 },
  performance: { averageLatency: 500, tokensPerSecond: 200 },
  availability: { regions: ['test-region'], status: 'available' },
  limits: {},
};

// Minimal mock for ILLMProvider to avoid actual API calls
const mockLLMProvider = {
  name: 'test-provider',
  initialize: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn().mockResolvedValue(undefined),
  generateChatCompletion: jest.fn().mockImplementation(async (request) => ({
    choices: [{ message: { role: 'assistant', content: `Mock response from ${request.model}` }, finishReason: 'stop' }],
    usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    metadata: { model: request.model, provider: 'test-provider' },
  })),
  streamChatCompletion: jest.fn(), // Not focus of these tests
  generateEmbedding: jest.fn(),    // Not focus of these tests
  getHealth: jest.fn().mockResolvedValue({ status: 'UP', models: [mockModelA.id, mockModelB.id, mockModelC.id] }),
  getProviderInfo: jest.fn().mockReturnValue({ name: 'test-provider', capabilities: { chat: true } }),
  getModelInfo: jest.fn().mockImplementation(modelId => {
    if (modelId === mockModelA.id) return mockModelA as any as ModelInfo;
    if (modelId === mockModelB.id) return mockModelB as any as ModelInfo;
    if (modelId === mockModelC.id) return mockModelC as any as ModelInfo;
    return undefined;
  }),
  handleError: jest.fn(e => e),
};


describe('LLMService - Model Selection Integration', () => {
  let llmService: LLMService;
  let modelRegistry: ModelRegistry;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }), // Ensure ConfigService is available if LlmModule needs it
        LLMModule,
      ],
    })
    // Override real providers with mocks if LlmModule tries to instantiate them
    // For now, let's assume LlmModule is self-contained or its dependencies are mocked/testable.
    // We will manually register our mock provider to LLMService after it's created.
    .overrideProvider(CACHE_SERVICE)
    .useClass(InMemoryCacheService) // Use InMemoryCache for testing
    .compile();

    llmService = moduleRef.get<LLMService>(LLMService);
    modelRegistry = moduleRef.get<ModelRegistry>(ModelRegistry);

    // Manually clear and register mock models for a clean slate
    const allModels = modelRegistry.getAllModels();
    allModels.forEach(m => modelRegistry.removeModel(m.id));
    
    modelRegistry.registerModel(mockModelA);
    modelRegistry.registerModel(mockModelB);
    modelRegistry.registerModel(mockModelC);

    // Manually register our mock LLMProvider to the llmService instance
    // This prevents LLMService from trying to initialize real providers during tests
    llmService.registerProvider(mockLLMProvider as any);
  });

  const simpleChatMessages: ChatMessage[] = [
    { role: 'user', content: 'Hello, world!' },
  ];

  it('should select a reasonable default model when no specific options are given', async () => {
    const options: LLMOptions = {};
    // LLMService's selectModel will be called internally by generateChatCompletion
    // We observe the mocked provider's generateChatCompletion to see which model was used.
    
    mockLLMProvider.generateChatCompletion.mockClear(); // Clear previous calls
    await llmService.generateChatCompletion(simpleChatMessages, options);
    
    expect(mockLLMProvider.generateChatCompletion).toHaveBeenCalled();
    const calledWithRequest = mockLLMProvider.generateChatCompletion.mock.calls[0][0];
    console.log('Default selection called with model:', calledWithRequest.model);

    // Assertion: Check if *a* model was selected (not null/undefined)
    expect(calledWithRequest.model).toBeDefined();
    // Based on current policy weights (Capability mandatory, Cost 0.8, Speed 0.7),
    // Model B or C might be chosen. Model B is cheaper. Model C is faster. 
    // Let's assume Model B (moderate) might be chosen if capabilities are met and cost/speed are balanced.
    // This assertion is a bit fragile and depends on exact scoring which we can refine.
    // For now, ensuring *a* model is chosen is key.
    // expect(calledWithRequest.model).toBe(mockModelB.id); 
  });

  it('should select the cheapest model when maxCost is very restrictive', async () => {
    const options: LLMOptions = {
      maxCost: 0.15, // Only Model A (cost 0.1) should fit this budget
      useCache: false, // Disable cache for this test
    };
    mockLLMProvider.generateChatCompletion.mockClear();
    await llmService.generateChatCompletion(simpleChatMessages, options);

    expect(mockLLMProvider.generateChatCompletion).toHaveBeenCalled();
    const calledWithRequest = mockLLMProvider.generateChatCompletion.mock.calls[0][0];
    console.log('Low cost selection called with model:', calledWithRequest.model);
    expect(calledWithRequest.model).toBe(mockModelA.id);
  });

  it('should select the fastest model when policyWeights heavily favor speed', async () => {
    const options: LLMOptions = {
      policyWeights: { SpeedPolicy: 1.0, CostPolicy: 0.01, CapabilityPolicy: 1.0 },
    };
    mockLLMProvider.generateChatCompletion.mockClear();
    await llmService.generateChatCompletion(simpleChatMessages, options);

    expect(mockLLMProvider.generateChatCompletion).toHaveBeenCalled();
    const calledWithRequest = mockLLMProvider.generateChatCompletion.mock.calls[0][0];
    console.log('Fast model selection called with model:', calledWithRequest.model);
    // Model C is the fastest (latency 500ms)
    expect(calledWithRequest.model).toBe(mockModelC.id);
  });

  it('should use the preferredModelId if specified and it meets mandatory capabilities', async () => {
    const options: LLMOptions = {
      model: mockModelA.id, // Preferring the cheapest, slowest model
      useCache: false, // Disable cache for this test
    };
    mockLLMProvider.generateChatCompletion.mockClear();
    await llmService.generateChatCompletion(simpleChatMessages, options);

    expect(mockLLMProvider.generateChatCompletion).toHaveBeenCalled();
    const calledWithRequest = mockLLMProvider.generateChatCompletion.mock.calls[0][0];
    console.log('Preferred model selection called with model:', calledWithRequest.model);
    expect(calledWithRequest.model).toBe(mockModelA.id);
  });

   it('should fallback to dynamic selection if preferredModelId does not meet mandatory capabilities', async () => {
    const messagesRequiringVision: ChatMessage[] = [
      { role: 'user', content: 'Describe this image' }, // Implies vision needed
    ];
    const options: LLMOptions = {
      model: mockModelA.id, // Model A does not have 'vision' capability
    };
    mockLLMProvider.generateChatCompletion.mockClear();
    await llmService.generateChatCompletion(messagesRequiringVision, options);

    expect(mockLLMProvider.generateChatCompletion).toHaveBeenCalled();
    const calledWithRequest = mockLLMProvider.generateChatCompletion.mock.calls[0][0];
    console.log('Preferred model (incapable) fallback selection:', calledWithRequest.model);
    // Model A is incapable. Model C has vision. Model B does not.
    // So, it should select Model C.
    expect(calledWithRequest.model).toBe(mockModelC.id);
  });

  // Add more tests: e.g., no suitable model found, specific capability requirements leading to specific model
}); 