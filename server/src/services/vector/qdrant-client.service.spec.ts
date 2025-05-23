import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantClientService } from './qdrant-client.service';
import { createServiceLogger } from '../../common/utils/logger-factory'; // Adjust path if needed

// Mock the actual QdrantClient
const mockQdrantClientInstance = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  deleteCollection: jest.fn(),
  upsert: jest.fn(),
  search: jest.fn(),
  getPoints: jest.fn(), // For retrievePoints
  retrieve: jest.fn(), // Fallback for retrievePoints
  // Add other methods that QdrantClientService might call
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => mockQdrantClientInstance),
}));

// Mock logger
jest.mock('../../common/utils/logger-factory', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('QdrantClientService', () => {
  let service: QdrantClientService;
  let configService: ConfigService;

  const mockApiUrl = 'http://mock-qdrant:6333';
  const mockApiKey = 'mock-api-key';

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    (createServiceLogger as jest.Mock).mockClear();


    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QdrantClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'QDRANT_API_URL') return mockApiUrl;
              if (key === 'QDRANT_API_KEY') return mockApiKey;
              if (key === 'QDRANT_CONNECTION_TIMEOUT') return 100; // Short timeout for tests
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<QdrantClientService>(QdrantClientService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock successful connection for onModuleInit by default for most tests
    mockQdrantClientInstance.getCollections.mockResolvedValue({ collections: [] }); 
  });

  describe('Initialization (onModuleInit)', () => {
    it('should initialize the Qdrant client with URL and API key from ConfigService', async () => {
      await service.onModuleInit();
      expect(QdrantClient).toHaveBeenCalledWith({
        url: mockApiUrl,
        apiKey: mockApiKey,
      });
      expect(service.getClient()).toBe(mockQdrantClientInstance);
      expect(createServiceLogger('QdrantClientService').info).toHaveBeenCalledWith(
        `QdrantClientService initialized successfully.`,
      );
    });

    it('should handle Qdrant client initialization failure gracefully', async () => {
      mockQdrantClientInstance.getCollections.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      
      expect(createServiceLogger('QdrantClientService').warn).toHaveBeenCalledWith(
        expect.stringContaining('Qdrant initialization failed, but continuing: Connection failed'),
      );
      expect(service.getClient()).toBeNull();
    });

    it('should handle Qdrant client initialization timeout', async () => {
        mockQdrantClientInstance.getCollections.mockImplementationOnce(() => new Promise(() => {})); 
        
        await expect(service.onModuleInit()).resolves.toBeUndefined();

        expect(createServiceLogger('QdrantClientService').warn).toHaveBeenCalledWith(
            expect.stringContaining('Qdrant client initialization process failed or timed out: Qdrant connection timeout')
        );
        expect(service.getClient()).toBeNull(); 
    });
  });

  describe('getClient', () => {
    it('should return the initialized client', async () => {
      await service.onModuleInit();
      expect(service.getClient()).toBe(mockQdrantClientInstance);
    });

    it('should return null if client is not initialized', () => {
      // Don't call onModuleInit or simulate failed init
      expect(service.getClient()).toBeNull();
      expect(createServiceLogger('QdrantClientService').warn).toHaveBeenCalledWith(
        'Qdrant client accessed before initialization completed',
      );
    });
  });
  
  describe('API URL and Key', () => {
    it('getApiUrl should return the configured API URL', () => {
      expect(service.getApiUrl()).toBe(mockApiUrl);
    });

    it('hasApiKey should return true if API key is configured', () => {
      expect(service.hasApiKey()).toBe(true);
    });

    it('hasApiKey should return false if API key is not configured', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'QDRANT_API_URL') return mockApiUrl;
        if (key === 'QDRANT_API_KEY') return undefined; // Simulate no API key
        return undefined;
      });
      const newService = new QdrantClientService(configService);
      expect(newService.hasApiKey()).toBe(false);
    });
  });

  describe('Collection Operations', () => {
    beforeEach(async () => {
      await service.onModuleInit(); // Ensure client is 'initialized'
    });

    it('createCollection should call client.createCollection', async () => {
      const collectionName = 'test-collection';
      const dimension = 128;
      await service.createCollection(collectionName, dimension);
      expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(collectionName, {
        vectors: { size: dimension, distance: 'Cosine' },
      });
    });
    
    it('deleteCollection should call client.deleteCollection', async () => {
      const collectionName = 'test-collection-to-delete';
      await service.deleteCollection(collectionName);
      expect(mockQdrantClientInstance.deleteCollection).toHaveBeenCalledWith(collectionName);
    });

    it('listCollections should call client.getCollections and map results', async () => {
      const mockCollections = [{ name: 'col1' }, { name: 'col2' }];
      mockQdrantClientInstance.getCollections.mockResolvedValueOnce({ collections: mockCollections });
      const result = await service.listCollections();
      expect(mockQdrantClientInstance.getCollections).toHaveBeenCalled();
      expect(result).toEqual(['col1', 'col2']);
    });
  });

  describe('Point Operations', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('upsertPoints should call client.upsert', async () => {
      const collectionName = 'upsert-collection';
      const points = [{ id: 1, vector: [0.1], payload: { data: 'test' } }];
      await service.upsertPoints(collectionName, points);
      expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(collectionName, { points });
    });

    it('search should call client.search', async () => {
      const collectionName = 'search-collection';
      const vector = [0.5, 0.5];
      const limit = 5;
      const filter = { foo: 'bar' };
      mockQdrantClientInstance.search.mockResolvedValueOnce([{ id: 1, score: 0.9 }]);
      await service.search(collectionName, vector, limit, filter);
      expect(mockQdrantClientInstance.search).toHaveBeenCalledWith(collectionName, {
        vector,
        limit,
        filter,
        with_payload: true,
      });
    });

    describe('retrievePoints', () => {
      const collectionName = 'retrieve-collection';
      const ids = [1, 'id2'];
      const mockPoints = [{ id: 1, payload: {} }, { id: 'id2', payload: {} }];

      it('should call client.getPoints if available', async () => {
        (mockQdrantClientInstance as any).getPoints = jest.fn().mockResolvedValue(mockPoints);
        (mockQdrantClientInstance as any).retrieve = jest.fn();

        const result = await service.retrievePoints(collectionName, ids, true);
        
        expect((mockQdrantClientInstance as any).getPoints).toHaveBeenCalledWith(collectionName, {
          ids: ids as any,
          with_payload: true,
          with_vector: true,
        });
        expect((mockQdrantClientInstance as any).retrieve).not.toHaveBeenCalled();
        expect(result).toEqual(mockPoints);
      });

      it('should call client.retrieve if getPoints is not available', async () => {
        const originalGetPoints = (mockQdrantClientInstance as any).getPoints;
        (mockQdrantClientInstance as any).getPoints = undefined; 
        (mockQdrantClientInstance as any).retrieve = jest.fn().mockResolvedValue(mockPoints);

        const result = await service.retrievePoints(collectionName, ids, false);

        expect((mockQdrantClientInstance as any).retrieve).toHaveBeenCalledWith(collectionName, {
          ids: ids as any,
          with_payload: true,
          with_vector: false,
        });
        expect(result).toEqual(mockPoints);
        (mockQdrantClientInstance as any).getPoints = originalGetPoints;
      });
      
      it('should throw error if neither getPoints nor retrieve is available', async () => {
        const originalGetPoints = (mockQdrantClientInstance as any).getPoints;
        const originalRetrieve = (mockQdrantClientInstance as any).retrieve;

        (mockQdrantClientInstance as any).getPoints = undefined;
        (mockQdrantClientInstance as any).retrieve = undefined;

        await expect(service.retrievePoints(collectionName, ids)).rejects.toThrow(
          'Point retrieval method not found on Qdrant client.',
        );
        expect(createServiceLogger('QdrantClientService').error).toHaveBeenCalledWith(
          'Neither getPoints nor retrieve method is available on Qdrant client.'
        );

        (mockQdrantClientInstance as any).getPoints = originalGetPoints;
        (mockQdrantClientInstance as any).retrieve = originalRetrieve;
      });

      it('should return empty array if client is unavailable', async () => {
        // To reliably test this, ensure onModuleInit makes client null, or set it directly
        // Forcing client to null for this specific test case:
        (service as any).client = null; 
        (service as any).isInitialized = false; // Also mark as not initialized
        
        const result = await service.retrievePoints(collectionName, ids);
        expect(result).toEqual([]);
        expect(createServiceLogger('QdrantClientService').warn).toHaveBeenCalledWith(
          `Cannot retrieve points from ${collectionName}: Client unavailable`,
        );
      });

      it('should throw error on retrieval failure', async () => {
        const retrievalError = new Error('Retrieval failed');
        // Ensure client is available for this test path
        await service.onModuleInit(); 
        if (!service.getClient()) { // Guard if onModuleInit failed due to timeout in test runner
            (service as any).client = mockQdrantClientInstance;
            (service as any).isInitialized = true;
        }

        (mockQdrantClientInstance as any).getPoints = jest.fn().mockRejectedValue(retrievalError);
        
        await expect(service.retrievePoints(collectionName, ids)).rejects.toThrow(retrievalError);
        expect(createServiceLogger('QdrantClientService').error).toHaveBeenCalledWith(
          `Failed to retrieve points from ${collectionName}: Retrieval failed`,
        );
      });
    });
  });
  
  describe('checkConnection', () => {
    beforeEach(async () => {
      // Reset relevant mocks or service state if needed for checkConnection tests
      // By default, onModuleInit in the global beforeEach mocks successful connection
      // So, we need to re-mock getCollections for failure cases here if onModuleInit has run
      mockQdrantClientInstance.getCollections.mockReset();
    });

    it('should return true if client.getCollections succeeds', async () => {
      await service.onModuleInit(); // Ensures client is set up (or attempted)
      // If onModuleInit resulted in a null client (e.g. due to prior test interference or timeout mock), set it up
      if (!service.getClient()) {
        (service as any).client = mockQdrantClientInstance;
        (service as any).isInitialized = true; 
      }
      mockQdrantClientInstance.getCollections.mockResolvedValueOnce({ collections: [] });
      const result = await service.checkConnection();
      expect(result).toBe(true);
      expect(createServiceLogger('QdrantClientService').info).toHaveBeenCalledWith('Qdrant connection successful.');
    });

    it('should throw error if client.getCollections fails', async () => {
      await service.onModuleInit(); 
      // Ensure client is not null for this test path after onModuleInit attempt
      if (!service.getClient()) {
        (service as any).client = mockQdrantClientInstance;
        (service as any).isInitialized = true;
      }
      const connectionError = new Error('Connection error');
      mockQdrantClientInstance.getCollections.mockRejectedValueOnce(connectionError);
      
      await expect(service.checkConnection()).rejects.toThrow(connectionError);
      expect(createServiceLogger('QdrantClientService').warn).toHaveBeenCalledWith(
        'Qdrant connection check failed: Connection error',
      );
    });
    
    it('should throw error if client is not instantiated', async () => {
        // Ensure client is null before calling checkConnection
        (service as any).client = null; 
        (service as any).isInitialized = false; // Reflect that it's not initialized
        
        await expect(service.checkConnection()).rejects.toThrow('Qdrant client not instantiated before connection check.');
        expect(createServiceLogger('QdrantClientService').error).toHaveBeenCalledWith(
            'Cannot check Qdrant connection: client not instantiated.'
        );
    });
  });
}); 