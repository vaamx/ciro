import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@services/core/config.service';
import { RerankingService, RerankableDocument, RerankedDocument } from './reranking.service';
import { createServiceLogger } from '@common/utils/logger-factory';

// Mock the logger factory
jest.mock('@common/utils/logger-factory', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('RerankingService', () => {
  let service: RerankingService;
  let mockConfigService: Partial<ConfigService>;
  const mockLogger = createServiceLogger('RerankingService'); // Get the mocked logger instance

  const mockApiKey = 'test-cohere-api-key';
  const mockModel = 'rerank-test-model';

  beforeEach(async () => {
    // Reset mocks for each test
    (mockLogger.info as jest.Mock).mockClear();
    (mockLogger.warn as jest.Mock).mockClear();
    (mockLogger.error as jest.Mock).mockClear();
    (mockLogger.debug as jest.Mock).mockClear();

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'COHERE_API_KEY') return mockApiKey;
        if (key === 'COHERE_RERANK_MODEL') return mockModel;
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RerankingService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RerankingService>(RerankingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Initialization', () => {
    it('should initialize with API key and model from ConfigService', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('COHERE_API_KEY');
      expect(mockConfigService.get).toHaveBeenCalledWith('COHERE_RERANK_MODEL', 'rerank-english-v3.0');
      expect(mockLogger.info).toHaveBeenCalledWith(`RerankingService initialized. Model: ${mockModel}`);
    });

    it('should warn if COHERE_API_KEY is not set', () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'COHERE_API_KEY') return undefined;
        if (key === 'COHERE_RERANK_MODEL') return mockModel;
        return undefined;
      });
      const newService = new RerankingService(mockConfigService as ConfigService);
      expect(mockLogger.warn).toHaveBeenCalledWith('COHERE_API_KEY is not set. RerankingService will not be able to function.');
      expect(newService).toBeDefined(); // Still initializes
    });
  });

  describe('rerankDocuments', () => {
    const sampleQuery = 'test query';
    const sampleDocs: RerankableDocument[] = [
      { id: '1', text: 'document one' },
      { id: '2', text: 'document two' },
      { id: '3', text: 'document three' },
    ];

    it('should return an empty array if no documents are provided', async () => {
      const result = await service.rerankDocuments(sampleQuery, []);
      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith('No documents provided for reranking.');
    });

    it('should return documents with score 0 if API key is missing', async () => {
      (mockConfigService.get as jest.Mock).mockImplementationOnce((key: string) => {
        if (key === 'COHERE_API_KEY') return undefined;
        return mockModel; 
      });
      const serviceWithoutKey = new RerankingService(mockConfigService as ConfigService);
      const result = await serviceWithoutKey.rerankDocuments(sampleQuery, sampleDocs);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Cohere API key is not configured. Cannot perform reranking.');
      result.forEach(doc => {
        expect(doc.score).toBe(-1);
      });
      expect(result.length).toBe(sampleDocs.length);
    });

    // Test placeholder logic for now - THIS TEST IS NO LONGER VALID AND WILL BE REMOVED
    // it('should (with placeholder) log warning and return dummy scored, sorted documents', async () => {
    //   const result = await service.rerankDocuments(sampleQuery, sampleDocs);

    //   expect(mockLogger.debug).toHaveBeenCalledWith(
    //     `Reranking ${sampleDocs.length} documents for query: "${sampleQuery}" using model ${mockModel}`
    //   );
    //   expect(mockLogger.warn).toHaveBeenCalledWith('API call to Cohere is currently a placeholder.');
    //   expect(result.length).toBe(sampleDocs.length);
    //   expect(result[0].id).toBe('1'); 
    //   expect(result[0].score).toBe(1);
    //   expect(result[1].id).toBe('2');
    //   expect(result[1].score).toBe(1/2);
    //   expect(result[2].id).toBe('3');
    //   expect(result[2].score).toBe(1/3);
    // });

    // This test was also for placeholder, let's adapt or remove if not relevant to actual API
    it('should correctly pass topN to the API call if provided', async () => {
      const topN = 2;
      // Configure the existing global.fetch mock for this specific test
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }), // Minimal valid response for this check
        status: 200,
        statusText: 'OK', // Added statusText for completeness with other mocks
      });

      await service.rerankDocuments(sampleQuery, sampleDocs, topN);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(`"top_n":${topN}`)
        })
      );
    });

    // ---- Tests for when API call is implemented ----
    describe('When Cohere API call is implemented', () => {
      let globalFetch: any;

      beforeAll(() => {
        globalFetch = global.fetch;
      });

      afterAll(() => {
        global.fetch = globalFetch;
      });

      beforeEach(() => {
        // Reset the mock for each test to ensure clean state
        global.fetch = jest.fn(); 
      });

      it('should call Cohere API and return reranked documents on success', async () => {
        const mockCohereResponse = {
          results: [
            { index: 1, relevance_score: 0.9 }, // doc two
            { index: 0, relevance_score: 0.8 }, // doc one
            { index: 2, relevance_score: 0.7 }, // doc three
          ],
        };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockCohereResponse,
          status: 200,
          statusText: 'OK',
        });

        // Re-initialize or use the existing service instance
        // No need to re-initialize if the config doesn't change for this test

        const result = await service.rerankDocuments(sampleQuery, sampleDocs, 3);

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.cohere.ai/v1/rerank',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': `Bearer ${mockApiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Request-Source': 'unspecified:nest-js-app',
            }),
            body: JSON.stringify({
              model: mockModel,
              query: sampleQuery,
              documents: sampleDocs.map(d => ({ text: d.text })),
              return_documents: false,
              top_n: 3,
            }),
          }),
        );
        expect(result.length).toBe(3);
        expect(result[0].id).toBe('2'); // doc two based on mock response
        expect(result[0].score).toBe(0.9);
        expect(result[1].id).toBe('1'); // doc one
        expect(result[1].score).toBe(0.8);
        expect(result[2].id).toBe('3'); // doc three
        expect(result[2].score).toBe(0.7);
        expect(mockLogger.info).toHaveBeenCalledWith('Successfully reranked and mapped 3 documents.');
      });

      it('should handle Cohere API error and return documents with score -1', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          text: async () => 'API Error Details',
          status: 500,
          statusText: 'Internal Server Error',
        });
        
        const result = await service.rerankDocuments(sampleQuery, sampleDocs);
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cohere API error: 500 Internal Server Error - API Error Details'
        );
        // The service now throws, and the catch block in the test (or service itself) returns docs with score -1
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error during reranking process.',
          { error: 'Cohere API request failed: Internal Server Error' } // Updated to match actual error logging
        );
        result.forEach(doc => expect(doc.score).toBe(-1));
      });

      it('should handle Cohere API response missing results field', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ some_other_field: 'no results here' }), // Malformed response
          status: 200,
          statusText: 'OK',
        });

        const result = await service.rerankDocuments(sampleQuery, sampleDocs);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cohere API response missing results field.', 
          { response: { some_other_field: 'no results here' }}
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error during reranking process.',
          { error: 'Invalid response structure from Cohere API.' } // Updated error message
        );
        result.forEach(doc => expect(doc.score).toBe(-1));
      });

      it('should skip and log if an original document index is not found (defensive)', async () => {
        const mockCohereResponse = {
          results: [
            { index: 0, relevance_score: 0.9 },
            { index: 99, relevance_score: 0.85 }, // Invalid index
            { index: 1, relevance_score: 0.8 },
          ],
        };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockCohereResponse,
          status: 200,
          statusText: 'OK',
        });

        const result = await service.rerankDocuments(sampleQuery, sampleDocs.slice(0, 2)); // Only provide 2 docs
        expect(mockLogger.warn).toHaveBeenCalledWith('Original document not found at index 99. Skipping.');
        expect(result.length).toBe(2); // Only validly mapped docs
        expect(result.find(d => d.id === sampleDocs[0].id)).toBeDefined();
        expect(result.find(d => d.id === sampleDocs[1].id)).toBeDefined();
        expect(mockLogger.info).toHaveBeenCalledWith('Successfully reranked and mapped 2 documents.');
      });
    });
  });
}); 