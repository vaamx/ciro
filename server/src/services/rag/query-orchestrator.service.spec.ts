import { Test, TestingModule } from '@nestjs/testing';
import { QueryOrchestratorService, OrchestrationOptions, OrchestratedRAGResponse, AggregationQueryResponse } from './query-orchestrator.service';
import { ConfigService } from '@services/core/config.service';
import { ConversationStateService } from '@services/state/conversation-state.service';
import { QueryAnalyzerService } from './query-analyzer.service';
import { IntentAnalysisService, QueryIntent, CountType, IntentAnalysisResult } from './intent-analyzer.service';
import { EntityExtractionService } from './entity-extraction.service';
import { DirectRAGService, DirectRAGQueryResponse } from './direct-rag.service';
import { RagAggregationService, QueryOptions as RagQueryOptions } from './rag-aggregation.service';
import { GenerationService } from './generation.service';
import { RetrievalService } from './retrieval.service';
import { ConversationTurn as StateConversationTurn, ConversationState as GlobalConversationState } from '@app/models/state.types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RerankableDocument } from './reranking.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createServiceLogger } from '@common/utils/logger-factory';
import { Document, GenerationOptions, ContextBuilderOptions, RetrievalOptions } from '@app/services/vector/vector.interfaces';
import { QueryAnalysis } from './interfaces';

// Mock the logger factory
jest.mock('@common/utils/logger-factory', () => {
  const innerMockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  };
  return {
    createServiceLogger: jest.fn().mockReturnValue(innerMockLogger),
    getMockLoggerInstance: () => innerMockLogger,
    __esModule: true,
  };
});

describe('QueryOrchestratorService', () => {
  let service: QueryOrchestratorService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockConversationStateService: jest.Mocked<ConversationStateService>;
  let mockQueryAnalyzerService: jest.Mocked<QueryAnalyzerService>;
  let mockIntentAnalysisService: jest.Mocked<IntentAnalysisService>;
  let mockEntityExtractionService: jest.Mocked<EntityExtractionService>;
  let mockDirectRAGService: jest.Mocked<DirectRAGService>;
  let mockRagAggregationService: jest.Mocked<RagAggregationService>;
  let mockGenerationService: jest.Mocked<GenerationService>;
  let mockRetrievalService: jest.Mocked<RetrievalService>;
  let mockLogger: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loggerFactory = require('@common/utils/logger-factory');
    mockLogger = loggerFactory.getMockLoggerInstance();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryOrchestratorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
            getNumber: jest.fn(),
            getBoolean: jest.fn(),
          } as Partial<jest.Mocked<ConfigService>>,
        },
        {
          provide: ConversationStateService,
          useValue: {
            getState: jest.fn(),
            updateState: jest.fn(),
            clearState: jest.fn(),
            clearAllStates: jest.fn(),
          } as Partial<jest.Mocked<ConversationStateService>>,
        },
        {
          provide: QueryAnalyzerService,
          useValue: {
            analyze: jest.fn(), 
            analyzeQuery: jest.fn(),
            analyzeQueryIntent: jest.fn(),
          } as Partial<jest.Mocked<QueryAnalyzerService>>,
        },
        {
          provide: IntentAnalysisService,
          useValue: {
            analyzeIntent: jest.fn(),
            determineIntent: jest.fn(),
            determineCountType: jest.fn(),
          } as Partial<jest.Mocked<IntentAnalysisService>>,
        },
        {
          provide: EntityExtractionService,
          useValue: {
            extractEntities: jest.fn(),
            extractEntityType: jest.fn(),
            extractEntityTypes: jest.fn(),
          } as Partial<jest.Mocked<EntityExtractionService>>,
        },
        {
          provide: DirectRAGService,
          useValue: {
            answerQuery: jest.fn(),
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
            generationModel: 'mock-model' as string,
            maxContextTokens: 1000 as number,
            defaultCollectionName: 'mock-collection' as string,
            buildContextString: jest.fn(),
            constructPrompt: jest.fn(),
            rerankingService: { rerank: jest.fn() }, 
            embeddingService: { generateEmbedding: jest.fn() },
            searchService: { search: jest.fn() },
            generationService: { generateResponse: jest.fn() },
          } as Partial<jest.Mocked<DirectRAGService>>,
        },
        {
          provide: RagAggregationService,
          useValue: {
            processAggregationQuery: jest.fn(),
          } as Partial<jest.Mocked<RagAggregationService>>,
        },
        {
          provide: GenerationService,
          useValue: {
            generateResponse: jest.fn(),
            constructPromptWithHistory: jest.fn(),
            generate: jest.fn(),
          } as Partial<jest.Mocked<GenerationService>>,
        },
        {
          provide: RetrievalService,
          useValue: {
            retrieveDocuments: jest.fn(),
            retrieve: jest.fn(),
            retrieveDocumentsFromAllSources: jest.fn(),
          } as Partial<jest.Mocked<RetrievalService>>,
        },
      ],
    }).compile();

    service = module.get<QueryOrchestratorService>(QueryOrchestratorService);
    mockConfigService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    mockConversationStateService = module.get(ConversationStateService) as jest.Mocked<ConversationStateService>;
    mockQueryAnalyzerService = module.get(QueryAnalyzerService) as jest.Mocked<QueryAnalyzerService>;
    mockIntentAnalysisService = module.get(IntentAnalysisService) as jest.Mocked<IntentAnalysisService>;
    mockEntityExtractionService = module.get(EntityExtractionService) as jest.Mocked<EntityExtractionService>;
    mockDirectRAGService = module.get(DirectRAGService) as jest.Mocked<DirectRAGService>;
    mockRagAggregationService = module.get(RagAggregationService) as jest.Mocked<RagAggregationService>;
    mockGenerationService = module.get(GenerationService) as jest.Mocked<GenerationService>;
    mockRetrievalService = module.get(RetrievalService) as jest.Mocked<RetrievalService>;

    mockConfigService.get.mockImplementation((key: string): string | undefined => {
      const configValues: Record<string, string | undefined> = {
        'llm.defaultModel': 'test-model',
        'llm.maxTokens.input': '4000',
        'llm.maxTokens.output': '1000',
        'vectorDb.defaultCollection': 'test-collection',
        'conversation.maxHistoryTurns': '3',
        'conversation.maxHistoryTokens': '1000',
        'conversation.summarization.maxTokensForPrompt': '2000',
        'conversation.summarization.model': 'test-summary-model',
        'conversation.historyRelevance.model': 'test-relevance-model',
        'conversation.historyRelevance.maxTokensForPrompt': '500',
        'conversation.queryRewriting.model': 'test-rewrite-model',
        'conversation.queryRewriting.maxTokensForPrompt': '1500',
        'NODE_ENV': 'test',
      };
      return configValues[key];
    });
    
    mockQueryAnalyzerService.analyzeQuery.mockResolvedValue({
        intent: 'general',
        complexity: 'low',
        dataVisualization: false,
        entities: [],
        searchLimit: 10,
        similarityThreshold: 0.7,
        isAnalytical: false,
        timeFrame: undefined,
        countType: undefined,
        entityType: undefined,
        entityTypes: [],
        requiresFullDataset: false,
    } as QueryAnalysis);

    mockIntentAnalysisService.analyzeIntent.mockResolvedValue({
      intent: 'SimpleQuestion' as any as QueryIntent,
      countType: undefined,
      entityTypes: [],
      isSensitive: false,
      specificFilters: {},
      userExpectations: '',
      temporalInfo: {},
      geospatialInfo: {},
      complexityScore: 1,
      confidenceScore: 1,
    } as IntentAnalysisResult);

    mockDirectRAGService.answerQuery.mockResolvedValue({
      answer: 'Direct RAG answer from mock',
      sourceDocuments: [],
      strategyTrace: ['DirectRAG internal trace'],
    } as DirectRAGQueryResponse);

    mockRagAggregationService.processAggregationQuery.mockResolvedValue({
        results: { summary: 'Aggregated results summary' },
        explanation: 'Aggregated explanation from mock'
    });
    
    mockGenerationService.generateResponse.mockResolvedValue({ content: 'Generated LLM response', model: 'test-model' });
    mockGenerationService.generate.mockResolvedValue('Generated string from generate method');
    mockConversationStateService.getState.mockResolvedValue(null);

  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith('QueryOrchestratorService initialized');
  });

  describe('processUserQuery', () => {
    it('should handle a simple query via Direct RAG path', async () => {
      const query = 'What is NestJS?';
      const conversationId = 'test-convo-123';
      const expectedIntent: QueryIntent = 'general';

      const mockDirectRAGResponse: DirectRAGQueryResponse = {
        answer: 'NestJS is a progressive Node.js framework.',
        sourceDocuments: [{ id: 'doc1', text: 'NestJS details...', score: 0.9, collectionName: 'test-collection', rerankScore: 0.95 } as RerankableDocument],
        strategyTrace: ['DirectRAG internal trace'],
      };
      const mockUpdatedConversationState: GlobalConversationState = {
        conversationId: conversationId,
        userId: 'test-user',
        history: [
          {
            userQuery: query,
            orchestratedResponse: {
              finalAnswer: mockDirectRAGResponse.answer,
              sourceDocuments: mockDirectRAGResponse.sourceDocuments as RerankableDocument[],
              queryMetadata: { originalQuery: query, intent: expectedIntent, queryComplexity: 'low', isAnalytical: false, dataVisualization: false, entities: [] },
              strategyTrace: mockDirectRAGResponse.strategyTrace || [],
              conversationId: conversationId,
            },
            timestamp: expect.any(Date),
          }
        ],
        lastModified: expect.any(Date),
      };

      mockQueryAnalyzerService.analyzeQuery.mockResolvedValueOnce({
        intent: 'general',
        complexity: 'low',
        dataVisualization: false,
        entities: [],
        searchLimit: 5,
        similarityThreshold: 0.7,
        isAnalytical: false,
      } as QueryAnalysis);

      mockIntentAnalysisService.determineIntent.mockReturnValueOnce(expectedIntent);

      mockDirectRAGService.answerQuery.mockResolvedValueOnce(mockDirectRAGResponse);
      mockConversationStateService.getState.mockResolvedValueOnce(null); 
      mockConversationStateService.updateState.mockResolvedValueOnce(mockUpdatedConversationState);

      const options: OrchestrationOptions = { conversationId, userId: 'test-user', useHistory: true };
      const result = await service.processUserQuery(query, options);

      expect(mockQueryAnalyzerService.analyzeQuery).toHaveBeenCalledWith(query);
      expect(mockIntentAnalysisService.determineIntent).toHaveBeenCalledWith(query.toLowerCase());
      
      expect(mockDirectRAGService.answerQuery).toHaveBeenCalledWith(query, undefined, expect.any(Number));
      expect(mockConversationStateService.getState).toHaveBeenCalledWith(conversationId);
      expect(mockConversationStateService.updateState).toHaveBeenCalledWith(conversationId, expect.any(Object), options.userId);

      expect(result).toBeDefined();
      expect(result.finalAnswer).toBe(mockDirectRAGResponse.answer);
      expect(result.sourceDocuments).toEqual(mockDirectRAGResponse.sourceDocuments);
      expect(result.queryMetadata.originalQuery).toBe(query);
      expect(result.queryMetadata.intent).toBe(expectedIntent);
      expect(result.conversationId).toBe(conversationId);
      expect(result.strategyTrace.some(trace => trace.includes('Processing \'general\' intent for query: What is NestJS?'))).toBe(true);
      expect(result.error).toBeUndefined();
    });

    // More tests will be added here for other scenarios
  });

}); 