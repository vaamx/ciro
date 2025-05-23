import { ConversationState, ConversationTurn } from '@app/models/state.types';

export const IConversationStateService = Symbol('IConversationStateService');

export interface IConversationStateService {
  getState(conversationId: string): Promise<ConversationState | null>;
  updateState(conversationId: string, turn: ConversationTurn, userId?: string): Promise<ConversationState>;
  clearState(conversationId: string): Promise<void>;
  clearAllStates?(): Promise<void>; // Optional: if you want a way to clear all states, e.g., for testing
  // Optional: For more advanced querying or management
  // findStatesByUser?(userId: string): Promise<ConversationState[]>;
  // deleteOldStates?(olderThan: Date): Promise<number>;
} 