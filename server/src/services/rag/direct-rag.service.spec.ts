import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@services/core/config.service';
import { QdrantSearchService } from '@services/vector/search.service';
import { RerankingService, RerankableDocument } from './reranking.service';
import { EmbeddingService } from '@services/ai/embedding.service'; // Added
// import { LLMService } from './llm.service'; // To be mocked
import { DirectRAGService, DirectRAGQueryResponse } from './direct-rag.service';
import { createServiceLogger } from '@common/utils/logger-factory';
import { SearchResultItem } from '@services/vector/vector.interfaces'; // Added
import { GenerationService } from './generation.service';

// Remove top-level mockLogger constant, it will be created inside jest.mock's factory
// const mockLogger = { ... }; 

jest.mock('@common/utils/logger-factory', () => {
  // Define the mock logger object *inside* the factory to avoid hoisting issues
  const innerMockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createServiceLogger: jest.fn().mockReturnValue(innerMockLogger),
    // Expose the inner mock if tests need to directly access it, e.g. for clearAllMocks
    // though usually accessing via service.logger (if public) or through its effects is better
    __esModule: true, // if it's an ES module
    getMockLoggerInstance: () => innerMockLogger, // Helper to get the instance if needed
  };
});

const sampleQuery = 'What is Direct RAG?';
const sampleCollectionName = 'test_collection';
const sampleEmbedding = [0.1, 0.2, 0.3];

// These will be returned by mockSearchService.search
const sampleSearchResults: SearchResultItem[] = [
  { id: 'search-doc1', score: 0.9, payload: { text: 'Initial document 1 from search' } },
  { id: 'search-doc2', score: 0.85, payload: { content: 'Initial document 2 content' } }, // Test content fallback
  { id: 'search-doc3', score: 0.8, content: 'Initial document 3 direct content' }, // Test direct content fallback
  { id: 'search-doc4-no-text', score: 0.7, payload: { metadata: { some: 'data' } } }, // No text
];

// These are what initialDocs should look like after mapping SearchResultItem[]
const mappedInitialDocs: RerankableDocument[] = [
  { id: 'search-doc1', text: 'Initial document 1 from search', score: 0.9, originalPayload: { text: 'Initial document 1 from search' } },
  { id: 'search-doc2', text: 'Initial document 2 content', score: 0.85, originalPayload: { content: 'Initial document 2 content' } },
  { id: 'search-doc3', text: 'Initial document 3 direct content', score: 0.8, originalPayload: undefined }, // originalPayload would be undefined if item.content was used and payload was empty
];

// These will be returned by mockRerankingService.rerankDocuments
const sampleRerankedDocs: RerankableDocument[] = [
  { id: 'reranked-doc1', text: 'Reranked document 1', score: 0.95, originalPayload: { text: 'Initial document 1 from search' } }, // Assuming it carries over originalPayload
  { id: 'reranked-doc2', text: 'Reranked document 2', score: 0.90, originalPayload: { content: 'Initial document 2 content' } },
];


describe('DirectRAGService', () => {
  let service: DirectRAGService;
  let mockConfigService: Partial<ConfigService>;
  let mockSearchService: Partial<QdrantSearchService>;
  let mockRerankingService: Partial<RerankingService>;
  let mockEmbeddingService: Partial<EmbeddingService>; // Added
  let mockGenerationService: Partial<GenerationService>;
  // let mockLlmService: Partial<LLMService>;

  const generationModel = 'o4-mini-2025-04-16';
  const maxContextTokens = 1000;
  const defaultCollection = 'my_default_collection';

  // This beforeEach will run before EACH test, including those in nested describes
  beforeEach(async () => {
    // Clear all mocks BEFORE each test setup to ensure a clean state for that test
    jest.clearAllMocks();

    // Re-initialize the mock that createServiceLogger returns for each test
    // This ensures that if a new service is instantiated, it gets a fresh mock logger
    const loggerFactory = require('@common/utils/logger-factory');
    const freshMockLoggerInstance = loggerFactory.getMockLoggerInstance(); 
    (createServiceLogger as jest.Mock).mockReturnValue(freshMockLoggerInstance);

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'GENERATION_LLM_MODEL') return generationModel;
        if (key === 'DEFAULT_QDRANT_COLLECTION_NAME') return defaultCollection;
        return defaultValue;
      }),
      getNumber: jest.fn((key: string, defaultValue?: number) => {
        if (key === 'MAX_CONTEXT_TOKENS') return maxContextTokens;
        return defaultValue;
      }),
    };

    mockSearchService = {
      search: jest.fn().mockResolvedValue(sampleSearchResults),
    };

    mockRerankingService = {
      rerankDocuments: jest.fn().mockImplementation(async (query: string, docs: RerankableDocument[], topK: number) => 
        // Simulate reranking: take topK from input, modify score, and return as RerankableDocument
        docs.slice(0, topK).map((doc, i) => ({ ...doc, score: (doc.score || 0) + 0.05 * (docs.length - i) })).sort((a, b) => (b.score || 0) - (a.score || 0))
      ),
    };
    
    mockEmbeddingService = { // Added
      createEmbeddings: jest.fn().mockResolvedValue([{ embedding: sampleEmbedding, index: 0 }]),
    };

    mockGenerationService = {
      generateFromPreformattedPrompt: jest.fn().mockResolvedValue('Generated LLM Answer'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectRAGService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: QdrantSearchService, useValue: mockSearchService },
        { provide: RerankingService, useValue: mockRerankingService },
        { provide: EmbeddingService, useValue: mockEmbeddingService }, // Added
        { provide: GenerationService, useValue: mockGenerationService },
        // { provide: LLMService, useValue: mockLlmService },
      ],
    }).compile();

    service = module.get<DirectRAGService>(DirectRAGService);
    // DO NOT call jest.clearAllMocks() here if we want to test constructor effects in a subsequent test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Initialization', () => {
    it('should initialize with model, token limits, and default collection from ConfigService', () => {
      // At this point, 'service' has been instantiated by the main beforeEach.
      // Its constructor should have called logger.info.
      // We retrieve the specific mock logger instance that was used by the service's constructor.
      const loggerFactory = require('@common/utils/logger-factory');
      const loggerInstanceUsedByService = loggerFactory.getMockLoggerInstance();
      
      // Check that the service's logger (which is loggerInstanceUsedByService) was called correctly.
      expect(loggerInstanceUsedByService.info).toHaveBeenCalledTimes(1); // Ensure it was called
      expect(loggerInstanceUsedByService.info).toHaveBeenCalledWith(
        `DirectRAGService initialized. Generation Model: ${generationModel}, Max Context Tokens: ${maxContextTokens}, Default Collection: ${defaultCollection}`,
      );
    });
  });

  describe('answerQuery', () => {
    let currentTestLogger: any;
    beforeEach(() => {
      // Before each test in this block, get the logger instance
      // This instance would have been "cleared" by the main beforeEach's jest.clearAllMocks()
      // and then re-assigned to the service when createServiceLogger was called during service instantiation.
      const loggerFactory = require('@common/utils/logger-factory');
      currentTestLogger = loggerFactory.getMockLoggerInstance();
    });

    it('should call EmbeddingService to generate query embedding', async () => {
      await service.answerQuery(sampleQuery, sampleCollectionName, 2, false);
      expect(mockEmbeddingService.createEmbeddings).toHaveBeenCalledWith(sampleQuery);
    });

    it('should call SearchService with collection, embedding, and limit', async () => {
      await service.answerQuery(sampleQuery, sampleCollectionName, 2, false);
      expect(mockSearchService.search).toHaveBeenCalledWith(sampleCollectionName, sampleEmbedding, undefined, 2);
    });

    it('should map SearchResultItem[] to RerankableDocument[] correctly', async () => {
        // Call answerQuery, it will internally call search and map
        await service.answerQuery(sampleQuery, sampleCollectionName, 3, false); 
        // Check if reranking (if used) or LLM prompt construction gets the correctly mapped docs
        // We expect initialDocs within answerQuery to be `mappedInitialDocs`
        // If useReranker is false, finalDocs should be mappedInitialDocs
        // We can inspect the call to buildContextString or the final sourceDocuments
        const response = await service.answerQuery(sampleQuery, sampleCollectionName, 3, false);
        expect(response.sourceDocuments).toEqual(mappedInitialDocs); 
    });

    it('should log a warning and skip documents with no text content during mapping', async () => {
      (mockSearchService.search as jest.Mock).mockResolvedValueOnce(sampleSearchResults); 
      await service.answerQuery(sampleQuery, sampleCollectionName, 4, false);
      expect(currentTestLogger.warn).toHaveBeenCalledWith('Search result item with id search-doc4-no-text has no text content. Skipping.');
    });

    it('should use default collection if override is not provided', async () => {
      await service.answerQuery(sampleQuery, undefined, 2, false);
      expect(mockSearchService.search).toHaveBeenCalledWith(defaultCollection, sampleEmbedding, undefined, 2);
    });

    it('should call RerankingService if useReranker is true and docs exist', async () => {
      (mockSearchService.search as jest.Mock).mockResolvedValue(sampleSearchResults);
      const topKForRerank = 2;
      await service.answerQuery(sampleQuery, sampleCollectionName, topKForRerank, true);
      // Reranking is called with the *mapped* initial docs
      expect(mockRerankingService.rerankDocuments).toHaveBeenCalledWith(sampleQuery, mappedInitialDocs, topKForRerank);
    });

    it('should not call RerankingService if useReranker is false', async () => {
      await service.answerQuery(sampleQuery, sampleCollectionName, 2, false);
      expect(mockRerankingService.rerankDocuments).not.toHaveBeenCalled();
      expect(currentTestLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Skipping reranking'));
    });

    it('should not call RerankingService if no initial documents are found after mapping', async () => {
      (mockSearchService.search as jest.Mock).mockResolvedValue([]); 
      await service.answerQuery(sampleQuery, sampleCollectionName, 2, true);
      expect(mockRerankingService.rerankDocuments).not.toHaveBeenCalled();
      expect(currentTestLogger.info).toHaveBeenCalledWith('No documents found after initial search or mapping.');
      expect(currentTestLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Skipping reranking'));
    });

    it('should construct a prompt with the query and context (using reranked docs)', async () => {
      (mockRerankingService.rerankDocuments as jest.Mock).mockResolvedValue(sampleRerankedDocs);
      
      const actualContext = service['buildContextString'](sampleRerankedDocs);
      const expectedPrompt = service['constructPrompt'](sampleQuery, actualContext);
      
      await service.answerQuery(sampleQuery, sampleCollectionName, 2, true);
      expect(currentTestLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Constructed prompt for LLM (collection ${sampleCollectionName}): ${expectedPrompt.substring(0,500)}`));
    });

    it('should return placeholder answer and FINAL source documents (reranked if applicable)', async () => {
      (mockRerankingService.rerankDocuments as jest.Mock).mockResolvedValue(sampleRerankedDocs);
      const response = await service.answerQuery(sampleQuery, sampleCollectionName, 2, true);
      expect(response.answer).toBe('Generated LLM Answer');
      expect(response.sourceDocuments).toEqual(sampleRerankedDocs); 
    });
    
    it('should return placeholder answer and MAPPED source documents if reranker is NOT used', async () => {
        (mockSearchService.search as jest.Mock).mockResolvedValue(sampleSearchResults);
        const response = await service.answerQuery(sampleQuery, sampleCollectionName, 3, false); // useReranker = false
        expect(response.answer).toBe('Generated LLM Answer');
        expect(response.sourceDocuments).toEqual(mappedInitialDocs);
      });

    it('should return error response if embedding generation fails', async () => {
        (mockEmbeddingService.createEmbeddings as jest.Mock).mockRejectedValue(new Error('Embedding failed'));
        const response = await service.answerQuery(sampleQuery, sampleCollectionName, 2, false);
        expect(response.answer).toBe('Error: Could not process query due to embedding failure.');
        expect(response.sourceDocuments).toEqual([]);
        expect(currentTestLogger.error).toHaveBeenCalledWith('Error generating query embedding:', expect.any(Error));
    });

    it('should return error response if searchService.search fails', async () => {
        (mockSearchService.search as jest.Mock).mockRejectedValue(new Error('Search failed'));
        const response = await service.answerQuery(sampleQuery, sampleCollectionName, 2, false);
        expect(response.answer).toBe('Error: Could not retrieve documents from knowledge base.');
        expect(response.sourceDocuments).toEqual([]);
        expect(currentTestLogger.error).toHaveBeenCalledWith(`Error searching collection ${sampleCollectionName}:`, expect.any(Error));
    });

    it('should continue with initial docs if reranking fails', async () => {
        (mockSearchService.search as jest.Mock).mockResolvedValue(sampleSearchResults);
        (mockRerankingService.rerankDocuments as jest.Mock).mockRejectedValue(new Error('Reranking failed badly'));
        
        const response = await service.answerQuery(sampleQuery, sampleCollectionName, 3, true);
        
        expect(currentTestLogger.error).toHaveBeenCalledWith('Error during reranking:', expect.any(Error));
        expect(response.sourceDocuments).toEqual(mappedInitialDocs); 
        expect(response.answer).toBe('Generated LLM Answer');
    });

  });

  describe('buildContextString', () => {
    it('should format documents correctly into a context string', () => {
      const context = service['buildContextString'](mappedInitialDocs.slice(0, 2)); // Use first two mapped docs
      expect(context).toContain(`Document 1 (ID: ${mappedInitialDocs[0].id}):\n${mappedInitialDocs[0].text}`);
      expect(context).toContain(`Document 2 (ID: ${mappedInitialDocs[1].id}):\n${mappedInitialDocs[1].text}`);
      expect(context).toContain('\n\n---\n\n'); // Expect actual newlines for the separator as well
    });

    it('should return empty string if no documents are provided', () => {
      const context = service['buildContextString']([]);
      expect(context).toBe('');
    });
  });

  describe('constructPrompt', () => {
    it('should create the correct prompt structure', () => {
      const context = 'Sample context from documents.';
      const prompt = service['constructPrompt'](sampleQuery, context);
      expect(prompt).toContain('Answer the following query based *only* on the provided documents.');
      expect(prompt).toContain(`Query: ${sampleQuery}`);
      expect(prompt).toContain(`Documents:\n${context}`);
      expect(prompt).toContain('Answer:');
    });
  });
});
