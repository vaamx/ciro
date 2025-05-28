import { Test, TestingModule } from '@nestjs/testing';
import { ConversationStateService } from './conversation-state.service';
import { ConversationState, ConversationTurn } from '@app/models/state.types';
import { IConversationStateService } from './i-conversation-state.service';
import { createServiceLogger } from '@common/utils/logger-factory';

// Mock the logger factory
jest.mock('@common/utils/logger-factory', () => {
  const innerMockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createServiceLogger: jest.fn().mockReturnValue(innerMockLogger),
    getMockLoggerInstance: () => innerMockLogger, // Helper to access the mock instance
    __esModule: true,
  };
});

describe('ConversationStateService', () => {
  let service: IConversationStateService;
  let mockLogger: any;

  beforeEach(async () => {
    // Clear all mocks before each test to ensure a clean state
    jest.clearAllMocks();

    // Retrieve the mock logger instance for assertions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loggerFactory = require('@common/utils/logger-factory');
    mockLogger = loggerFactory.getMockLoggerInstance();
    (createServiceLogger as jest.Mock).mockReturnValue(mockLogger);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: IConversationStateService,
          useClass: ConversationStateService,
        },
      ],
    }).compile();

    service = module.get<IConversationStateService>(IConversationStateService);
    // Clear any states that might persist if the service instance isn't recreated fresh (though it should be by Test.createTestingModule)
    service.clearAllStates?.(); 
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    // expect(mockLogger.info).toHaveBeenCalledWith('ConversationStateService initialized'); // Service doesn't log this with createServiceLogger directly
  });

  describe('getState', () => {
    it('should return null for a non-existent conversation ID', async () => {
      const state = await service.getState('non-existent-id');
      expect(state).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('No state found for conversation ID: non-existent-id');
    });

    it('should return the state for an existing conversation ID', async () => {
      const conversationId = 'test-id-1';
      const turn: ConversationTurn = {
        userQuery: 'Hello',
        orchestratedResponse: { finalAnswer: 'Hi there!', sourceDocuments: [], queryMetadata: {originalQuery: 'Hello', intent: 'greeting'}, strategyTrace: [] },
        timestamp: new Date(),
      };
      await service.updateState(conversationId, turn, 'user-123');
      const state = await service.getState(conversationId);
      expect(state).toBeDefined();
      expect(state?.conversationId).toBe(conversationId);
      expect(state?.history).toHaveLength(1);
      expect(state?.history[0].userQuery).toBe('Hello');
      expect(mockLogger.debug).toHaveBeenCalledWith(`State found for conversation ID: ${conversationId}`);
    });
  });

  describe('updateState', () => {
    it('should create a new state if one does not exist', async () => {
      const conversationId = 'test-id-2';
      const userId = 'user-abc';
      const turn: ConversationTurn = {
        userQuery: 'First query',
        orchestratedResponse: { finalAnswer: 'Answer 1', sourceDocuments: [], queryMetadata: {originalQuery: 'First query', intent: 'question'}, strategyTrace: [] },
        timestamp: new Date(),
      };
      const state = await service.updateState(conversationId, turn, userId);
      expect(state).toBeDefined();
      expect(state.conversationId).toBe(conversationId);
      expect(state.userId).toBe(userId);
      expect(state.history).toHaveLength(1);
      expect(state.history[0].userQuery).toBe('First query');

      const retrievedState = await service.getState(conversationId);
      expect(retrievedState).toEqual(state);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Created new state for conversationId: ${conversationId}. History length: 1, UserId: ${userId}`);
      expect(mockLogger.debug).toHaveBeenCalledWith(`State updated for conversation ID: ${conversationId}. History length: 1`);
    });

    it('should append to an existing state and update lastModified', async () => {
      const conversationId = 'test-id-3';
      const firstTurn: ConversationTurn = {
        userQuery: 'Query 1',
        orchestratedResponse: { finalAnswer: 'Ans 1', sourceDocuments: [], queryMetadata: {originalQuery: 'Query 1', intent: 'question'}, strategyTrace: [] },
        timestamp: new Date(Date.now() - 10000), // 10 seconds ago
      };
      // Initial update
      await service.updateState(conversationId, firstTurn);
      const initialState = await service.getState(conversationId);
      expect(initialState).toBeDefined();
      const initialLastModified = initialState!.lastModified;

      // Ensure a slight delay for timestamp comparison
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondTurn: ConversationTurn = {
        userQuery: 'Query 2',
        orchestratedResponse: { finalAnswer: 'Ans 2', sourceDocuments: [], queryMetadata: {originalQuery: 'Query 2', intent: 'question'}, strategyTrace: [] },
        timestamp: new Date(),
      };
      // Second update
      const updatedState = await service.updateState(conversationId, secondTurn);

      expect(updatedState.history).toHaveLength(2);
      expect(updatedState.history[1].userQuery).toBe('Query 2');
      expect(updatedState.lastModified.getTime()).toBeGreaterThan(initialLastModified.getTime());
      // Check for the log from the second updateState call
      expect(mockLogger.debug).toHaveBeenCalledWith(`State updated for conversation ID: ${conversationId}. History length: 2`);
    });

    it('should assign userId if not already set in an existing state', async () => {
      const conversationId = 'test-id-user-assign';
      const firstTurn: ConversationTurn = {
        userQuery: 'Initial',
        orchestratedResponse: { finalAnswer: 'Init Ans', sourceDocuments: [], queryMetadata: {originalQuery: 'Initial', intent: 'greeting'}, strategyTrace: [] },
        timestamp: new Date(),
      };
      await service.updateState(conversationId, firstTurn); // No userId initially

      const secondTurn: ConversationTurn = {
        userQuery: 'Follow-up',
        orchestratedResponse: { finalAnswer: 'Follow Ans', sourceDocuments: [], queryMetadata: {originalQuery: 'Follow-up', intent: 'question'}, strategyTrace: [] },
        timestamp: new Date(),
      };
      const userIdToAssign = 'user-xyz';
      const updatedState = await service.updateState(conversationId, secondTurn, userIdToAssign);

      expect(updatedState.userId).toBe(userIdToAssign);
      expect(updatedState.history).toHaveLength(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(`User ID ${userIdToAssign} assigned to existing conversation ${conversationId}.`);
    });
  });

  describe('clearState', () => {
    it('should return false if no state exists for the ID', async () => {
      const result = await service.clearState('non-existent-clear-id');
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Attempted to clear state for non-existent conversation ID: non-existent-clear-id');
    });

    it('should return true and remove the state if it exists', async () => {
      const conversationId = 'test-id-4';
      const turn: ConversationTurn = {
        userQuery: 'To be cleared',
        orchestratedResponse: { finalAnswer: 'Clear me', sourceDocuments: [], queryMetadata: {originalQuery: 'To be cleared', intent: 'command'}, strategyTrace: [] },
        timestamp: new Date(),
      };
      await service.updateState(conversationId, turn);
      
      const clearResult = await service.clearState(conversationId);
      expect(clearResult).toBe(true);

      const retrievedState = await service.getState(conversationId);
      expect(retrievedState).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(`State cleared for conversation ID: ${conversationId}`);
    });
  });

  describe('clearAllStates', () => {
    it('should remove all states', async () => {
      const turn: ConversationTurn = {
        userQuery: 'Test',
        orchestratedResponse: { finalAnswer: 'Test Ans', sourceDocuments: [], queryMetadata: {originalQuery: 'Test', intent: 'question'}, strategyTrace: [] },
        timestamp: new Date(),
      };
      await service.updateState('id1', turn);
      await service.updateState('id2', turn);

      const clearAllResult = await service.clearAllStates?.();
      expect(clearAllResult).toBe(true);

      expect(await service.getState('id1')).toBeNull();
      expect(await service.getState('id2')).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Clearing all conversation states from memory.');
      expect(mockLogger.info).toHaveBeenCalledWith('All conversation states cleared.');
    });

    it('should return true even if there are no states to clear', async () => {
      const clearAllResult = await service.clearAllStates?.();
      expect(clearAllResult).toBe(true);
    });
  });
}); 