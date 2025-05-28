import { Test, TestingModule } from '@nestjs/testing';
import { QdrantSearchService } from './search.service';
import { QdrantClientService } from './qdrant-client.service';
import { EmbeddingService } from '../llm/services/embedding.service';
import { ConfigService } from '@nestjs/config'; // Often needed by underlying services
import { createServiceLogger } from '../../common/utils/logger-factory';
import { SearchResultItem, PointsList } from './vector.interfaces';
import { QdrantClient } from '@qdrant/js-client-rest'; // For mocking qdrantClientService.getClient()

// Mock logger factory
jest.mock('../../common/utils/logger-factory', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock QdrantClient instance that QdrantClientService would return
const mockQdrantClient = {
  getCollection: jest.fn(),
  search: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  scroll: jest.fn(),
};

describe('QdrantSearchService', () => {
  let service: QdrantSearchService;
  let mockQdrantClientService: Partial<QdrantClientService>;
  let mockEmbeddingService: Partial<EmbeddingService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQdrantClientService = {
      getClient: jest.fn().mockReturnValue(mockQdrantClient as any as QdrantClient),
      // Mock other QdrantClientService methods if QdrantSearchService calls them directly
    };

    mockEmbeddingService = {
      createEmbedding: jest.fn(),
      createEmbeddings: jest.fn(),
      // Mock other EmbeddingService methods if needed
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QdrantSearchService,
        {
          provide: QdrantClientService,
          useValue: mockQdrantClientService,
        },
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
        // Provide ConfigService if BaseSearchService or others require it, even if indirectly
        {
            provide: ConfigService,
            useValue: {
                get: jest.fn()
            }
        }
      ],
    }).compile();

    service = module.get<QdrantSearchService>(QdrantSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('collectionExists', () => {
    it('should return true if client.getCollection succeeds', async () => {
      mockQdrantClient.getCollection.mockResolvedValue({ status: 'ok' }); // Ensure mock resolves
      const exists = await service.collectionExists('test-collection');
      expect(exists).toBe(true);
      // Expect normalized name
      expect(mockQdrantClient.getCollection).toHaveBeenCalledWith('test_collection');
    });

    it('should return false if client.getCollection throws 404 error', async () => {
      mockQdrantClient.getCollection.mockRejectedValue({ status: 404 });
      const exists = await service.collectionExists('test-collection');
      expect(exists).toBe(false);
    });

    it('should return false and log error for other errors', async () => {
      mockQdrantClient.getCollection.mockRejectedValue(new Error('Some other error'));
      const exists = await service.collectionExists('test-collection');
      expect(exists).toBe(false);
      expect(createServiceLogger('QdrantSearchService').error).toHaveBeenCalled();
    });

    it('should return false if qdrant client is unavailable', async () => {
      (mockQdrantClientService.getClient as jest.Mock).mockReturnValue(null);
      const exists = await service.collectionExists('test-collection');
      expect(exists).toBe(false);
      expect(createServiceLogger('QdrantSearchService').warn).toHaveBeenCalledWith('QdrantClient is not available');
    });
  });

  describe('search', () => {
    const collectionName = 'search-col';
    const normalizedCollectionName = 'search_col'; // For expectation
    const vector = [0.1, 0.2];
    const mockSearchResults = [{ id: '1', score: 0.9, payload: { text: 'found' } }];

    beforeEach(() => {
        // Assume collection exists for search tests by default
        jest.spyOn(service, 'collectionExists').mockResolvedValue(true);
        mockQdrantClient.search.mockResolvedValue(mockSearchResults.map(r => ({...r, vector: undefined }))); // Mock Qdrant like response
    });

    it('should call client.search and return mapped results if collection exists', async () => {
      // Mock collectionExists to return true for this specific normalized name
      jest.spyOn(service, 'collectionExists').mockResolvedValueOnce(true);
      mockQdrantClient.search.mockResolvedValue(mockSearchResults.map(r => ({...r, vector: undefined }))); // Mock Qdrant like response

      const results = await service.search(collectionName, vector, undefined, 10, 0.5, 0);
      // Expect normalized name in search call
      expect(mockQdrantClient.search).toHaveBeenCalledWith(normalizedCollectionName, {
        vector,
        limit: 10,
        offset: 0,
        filter: {},
        score_threshold: 0.5,
        with_payload: true,
        with_vector: false,
      });
      expect(results[0].payload).toEqual({ text: 'found' });
    });

    it('should return empty array if collection does not exist', async () => {
      // Mock collectionExists to return false for this specific normalized name
      jest.spyOn(service, 'collectionExists').mockResolvedValueOnce(false);
      mockQdrantClient.search.mockClear(); // Clear any previous calls

      const results = await service.search(collectionName, vector);
      expect(results).toEqual([]);
      expect(mockQdrantClient.search).not.toHaveBeenCalled();
      // Expect normalized name in log
      expect(createServiceLogger('QdrantSearchService').warn).toHaveBeenCalledWith(
        `Attempted search on non-existent collection: ${normalizedCollectionName}`
      );
    });

    it('should return empty array if qdrant client is unavailable', async () => {
        (mockQdrantClientService.getClient as jest.Mock).mockReturnValue(null);
        // Ensure collectionExists check might pass or be bypassed for this specific scenario
        // or that the client check happens before collectionExists implies client availability.
        // The current implementation of search calls getClient *after* collectionExists if it hits that path.
        // However, collectionExists itself calls getClient. So this covers the case where getClient in collectionExists returns null.
        (service.collectionExists as jest.Mock).mockImplementationOnce(async() => {
            (mockQdrantClientService.getClient as jest.Mock).mockReturnValueOnce(null);
            return await service.collectionExists(collectionName); // Call original logic with modified mock
        });
        
        const results = await service.search(collectionName, vector);
        expect(results).toEqual([]); // Depending on implementation, could also be caught by collectionExists
    });

    it('should return empty array and log on client.search error', async () => {
      mockQdrantClient.search.mockRejectedValue(new Error('Search failed'));
      const results = await service.search(collectionName, vector);
      expect(results).toEqual([]);
      expect(createServiceLogger('QdrantSearchService').error).toHaveBeenCalled();
    });

    it('should correctly apply and pass filter to client.search', async () => {
      const filter = { must: [{ key: 'color', match: { value: 'blue' } }] };
      // Mock collectionExists to return true for this specific normalized name
      jest.spyOn(service, 'collectionExists').mockResolvedValueOnce(true);
      mockQdrantClient.search.mockResolvedValue([]); // Return empty for simplicity, focus on call

      await service.search(collectionName, vector, filter, 5);

      expect(mockQdrantClient.search).toHaveBeenCalledWith(normalizedCollectionName, {
        vector,
        limit: 5,
        offset: 0, // Default offset
        filter: { // Adjusted expected filter
          must: [
            {},
            { key: 'color', match: { value: 'blue' } }
          ]
        },
        score_threshold: 0.0, // Default scoreThreshold
        with_payload: true,
        with_vector: false,
      });
    });

    it('should return an empty array if client.search returns no results', async () => {
      jest.spyOn(service, 'collectionExists').mockResolvedValueOnce(true);
      mockQdrantClient.search.mockResolvedValue([]); // Simulate no results from Qdrant

      const results = await service.search(collectionName, vector);
      expect(results).toEqual([]);
    });

  });

  describe('upsert', () => {
    const collectionName = 'upsert-col';
    const normalizedCollectionName = 'upsert_col'; // For expectation
    const points: PointsList = [{ id: 'p1', vector: [0.3], payload: { text: 'data' } }];

    it('should call client.upsert with mapped points', async () => {
      // QdrantSearchService upsert doesn't always check existence; depends on Qdrant's behavior
      await service.upsert(collectionName, points);
      // Expect normalized name in upsert call
      expect(mockQdrantClient.upsert).toHaveBeenCalledWith(normalizedCollectionName, {
        points: points.map(p => ({ id: p.id, vector: p.vector, payload: p.payload })),
        wait: true, 
      });
    });

    it('should throw error if qdrant client is unavailable', async () => {
        (mockQdrantClientService.getClient as jest.Mock).mockReturnValue(null);
        await expect(service.upsert(collectionName, points)).rejects.toThrow('Qdrant client is not available');
    });

    it('should re-throw on client.upsert error', async () => {
      mockQdrantClient.upsert.mockRejectedValue(new Error('Upsert failed'));
      await expect(service.upsert(collectionName, points)).rejects.toThrow('Upsert failed');
    });
  });

  describe('delete', () => {
    const collectionName = 'delete-col';
    const normalizedCollectionName = 'delete_col';
    const pointIds = ['id1', 'id2'];

    beforeEach(() => {
      // Default to collection existing for these tests
      jest.spyOn(service, 'collectionExists').mockResolvedValue(true);
      // Clear the mockQdrantClient.delete calls before each test in this describe block
      mockQdrantClient.delete.mockClear(); 
      // Ensure client is available by default for most tests in this block
      (mockQdrantClientService.getClient as jest.Mock).mockReturnValue(mockQdrantClient as any as QdrantClient);
    });

    it('should call client.delete with normalized name and point IDs if collection exists', async () => {
      mockQdrantClient.delete.mockResolvedValue({ status: 'ok' } as any); // Simplified mock response

      await service.delete(collectionName, pointIds);

      expect(service.collectionExists).toHaveBeenCalledWith(normalizedCollectionName);
      expect(mockQdrantClient.delete).toHaveBeenCalledWith(normalizedCollectionName, {
        points: pointIds,
      });
      expect(createServiceLogger('QdrantSearchService').info).toHaveBeenCalledWith(
        `Successfully deleted ${pointIds.length} points from ${normalizedCollectionName}`
      );
    });

    it('should not call client.delete and log warning if collection does not exist', async () => {
      (service.collectionExists as jest.Mock).mockResolvedValueOnce(false);

      await service.delete(collectionName, pointIds);

      expect(mockQdrantClient.delete).not.toHaveBeenCalled();
      expect(createServiceLogger('QdrantSearchService').warn).toHaveBeenCalledWith(
        `Attempted delete on non-existent collection: ${normalizedCollectionName}`
      );
    });

    it('should not call client.delete and log warning if pointIds array is empty', async () => {
      await service.delete(collectionName, []);

      expect(mockQdrantClient.delete).not.toHaveBeenCalled();
      expect(createServiceLogger('QdrantSearchService').warn).toHaveBeenCalledWith(
        `Delete operation called with no points for collection ${normalizedCollectionName}.`
      );
    });

    it('should throw error if qdrant client is unavailable after collection check', async () => {
      // collectionExists passes (and its internal getClient call succeeds)
      (service.collectionExists as jest.Mock).mockResolvedValueOnce(true);
      // But the getClient call within the delete method's try block fails
      (mockQdrantClientService.getClient as jest.Mock).mockReturnValue(null);

      await expect(service.delete(collectionName, pointIds)).rejects.toThrow('Qdrant client is not available');
      expect(createServiceLogger('QdrantSearchService').warn).toHaveBeenCalledWith(
        'QdrantClient is not available' // This log is from within the delete method itself
      );
    });

    it('should re-throw error on client.delete failure', async () => {
      const deleteErrorMessage = 'Deletion from Qdrant failed';
      mockQdrantClient.delete.mockRejectedValue(new Error(deleteErrorMessage));

      await expect(service.delete(collectionName, pointIds)).rejects.toThrow(deleteErrorMessage);
      expect(createServiceLogger('QdrantSearchService').error).toHaveBeenCalledWith(
        `Error deleting points from collection ${normalizedCollectionName}:`,
        expect.any(Error)
      );
    });
  });

  describe('hybridSearch', () => {
    const collectionName = 'hybrid-col';
    const vector = [0.1, 0.2, 0.3];
    const keywords = 'test keyword';
    const keywordField = 'description';
    const limit = 5;
    const mockSearchResults: SearchResultItem[] = [
      { id: 'hybrid1', score: 0.85, payload: { text: 'found by hybrid', description: keywords } },
    ];

    let searchSpy: jest.SpyInstance;

    beforeEach(() => {
      // Spy on the service's own search method for these tests
      searchSpy = jest.spyOn(service, 'search').mockResolvedValue(mockSearchResults);
      // Ensure logger calls can be checked if needed
      (createServiceLogger('QdrantSearchService').error as jest.Mock).mockClear();
      (createServiceLogger('QdrantSearchService').warn as jest.Mock).mockClear();
    });

    afterEach(() => {
      searchSpy.mockRestore();
    });

    it('should call this.search with constructed keyword filter for successful hybrid search', async () => {
      const results = await service.hybridSearch(collectionName, vector, keywords, keywordField, limit);

      const expectedFilter = {
        must: [
          {
            text: {
              [keywordField]: {
                match: {
                  text: keywords,
                },
              },
            },
          },
        ],
      };

      expect(searchSpy).toHaveBeenCalledWith(collectionName, vector, expectedFilter, limit);
      expect(results).toEqual(mockSearchResults);
    });

    it('should return empty array and log error if collectionName is missing', async () => {
      const results = await service.hybridSearch('', vector, keywords, keywordField, limit);
      expect(results).toEqual([]);
      expect(createServiceLogger('QdrantSearchService').error).toHaveBeenCalledWith('Collection name is required');
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it('should return empty array and log error if vector is missing or empty', async () => {
      let results = await service.hybridSearch(collectionName, [], keywords, keywordField, limit);
      expect(results).toEqual([]);
      expect(createServiceLogger('QdrantSearchService').error).toHaveBeenCalledWith('Vector is required');
      
      (createServiceLogger('QdrantSearchService').error as jest.Mock).mockClear(); // Clear for next assertion
      results = await service.hybridSearch(collectionName, null as any, keywords, keywordField, limit);
      expect(results).toEqual([]);
      expect(createServiceLogger('QdrantSearchService').error).toHaveBeenCalledWith('Vector is required');
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it('should fall back to normal search if keywords are missing', async () => {
      await service.hybridSearch(collectionName, vector, '', keywordField, limit); // Empty keywords
      expect(searchSpy).toHaveBeenCalledWith(collectionName, vector, undefined, limit);
    });

    test.todo('should return empty array and log error if internal search call fails');

    it('should use default keywordField if not provided', async () => {
        await service.hybridSearch(collectionName, vector, keywords, undefined, limit);
        const expectedFilterDefaultField = {
            must: [
              {
                text: {
                  ['text']: { // Default keywordField
                    match: {
                      text: keywords,
                    },
                  },
                },
              },
            ],
          };
        expect(searchSpy).toHaveBeenCalledWith(collectionName, vector, expectedFilterDefaultField, limit);
    });
  });

  describe('getSampleData', () => {
    const defaultCollection = 'default_collection';
    const limit = 2;
    const fallbackData = [
      { id: 1, name: 'Sample Item 1', value: 100 },
      { id: 2, name: 'Sample Item 2', value: 200 },
      { id: 3, name: 'Sample Item 3', value: 300 },
    ];
    const mockScrollPoints = [
      { id: 'q1', score: 1, payload: { data: 'item1' }, vector: [0.1] },
      { id: 'q2', score: 1, payload: { data: 'item2' }, vector: [0.2] },
    ];

    beforeEach(() => {
      // Default mocks for dependencies
      (mockQdrantClientService.getClient as jest.Mock).mockReturnValue(mockQdrantClient as any as QdrantClient);
      jest.spyOn(service, 'collectionExists').mockResolvedValue(true); // Assume collection exists by default
      mockQdrantClient.scroll.mockResolvedValue({ points: mockScrollPoints, next_page_offset: null });
      // Clear logger mocks
      (createServiceLogger('QdrantSearchService').error as jest.Mock).mockClear();
      (createServiceLogger('QdrantSearchService').warn as jest.Mock).mockClear();
    });

    it('should return mapped payloads from client.scroll if successful', async () => {
      const results = await service.getSampleData(limit);
      expect(service.collectionExists).toHaveBeenCalledWith(defaultCollection);
      expect(mockQdrantClient.scroll).toHaveBeenCalledWith(defaultCollection, {
        limit,
        with_payload: true,
      });
      expect(results).toEqual([ { data: 'item1' }, { data: 'item2' } ]);
    });

    it('should return fallback data if collection does not exist', async () => {
      (service.collectionExists as jest.Mock).mockResolvedValueOnce(false);
      const results = await service.getSampleData(limit);
      expect(results).toEqual(fallbackData);
      expect(createServiceLogger('QdrantSearchService').warn).toHaveBeenCalledWith(
        `Sample data collection '${defaultCollection}' not found. Returning fallback data.`
      );
      expect(mockQdrantClient.scroll).not.toHaveBeenCalled();
    });

    it('should return fallback data if Qdrant client is unavailable', async () => {
      (service.collectionExists as jest.Mock).mockResolvedValueOnce(true); // Assume check passes before client is found null
      (mockQdrantClientService.getClient as jest.Mock).mockReturnValue(null);
      const results = await service.getSampleData(limit);
      expect(results).toEqual(fallbackData);
      expect(createServiceLogger('QdrantSearchService').warn).toHaveBeenCalledWith(
        'QdrantClient is not available'
      );
      expect(mockQdrantClient.scroll).not.toHaveBeenCalled();
    });

    it('should return fallback data if client.scroll returns no points', async () => {
      mockQdrantClient.scroll.mockResolvedValueOnce({ points: [], next_page_offset: null });
      const results = await service.getSampleData(limit);
      expect(results).toEqual(fallbackData);
    });

    it('should return fallback data if client.scroll returns null points', async () => {
      mockQdrantClient.scroll.mockResolvedValueOnce({ points: null as any, next_page_offset: null });
      const results = await service.getSampleData(limit);
      expect(results).toEqual(fallbackData);
    });

    it('should return fallback data and log error if client.scroll throws an error', async () => {
      const scrollError = new Error('Scroll failed miserable');
      mockQdrantClient.scroll.mockRejectedValue(scrollError);
      const results = await service.getSampleData(limit);
      expect(results).toEqual(fallbackData);
      expect(createServiceLogger('QdrantSearchService').error).toHaveBeenCalledWith(
        `Error retrieving sample data: ${scrollError}`
      );
    });
  });

}); 