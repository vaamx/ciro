import { Injectable, Logger } from '@nestjs/common';
import { ConversationState, ConversationTurn } from '@app/models/state.types';
import { IConversationStateService } from './i-conversation-state.service';
import { createServiceLogger } from '@common/utils/logger-factory';

@Injectable()
export class ConversationStateService implements IConversationStateService {
  private readonly logger = createServiceLogger(ConversationStateService.name);
  private readonly conversationStates: Map<string, ConversationState> = new Map();

  async getState(conversationId: string): Promise<ConversationState | null> {
    this.logger.debug(`Attempting to retrieve state for conversation ID: ${conversationId}`);
    const state = this.conversationStates.get(conversationId);
    if (state) {
      this.logger.debug(`State found for conversation ID: ${conversationId}`);
      return state;
    }
    this.logger.debug(`No state found for conversation ID: ${conversationId}`);
    return null;
  }

  async updateState(
    conversationId: string,
    turn: ConversationTurn,
    userId?: string,
  ): Promise<ConversationState> {
    this.logger.debug(
      `Updating state for conversation ID: ${conversationId}, User ID: ${userId || 'N/A'}`,
    );
    let state = this.conversationStates.get(conversationId);
    if (state) {
      state.history.push(turn);
      state.lastModified = new Date();
      if (userId && !state.userId) {
        state.userId = userId; // Assign userId if not already set
        this.logger.debug(`User ID ${userId} assigned to existing conversation ${conversationId}.`);
      }
    } else {
      state = {
        conversationId,
        userId,
        history: [turn],
        lastModified: new Date(),
      };
      this.logger.debug(`Created new state for conversationId: ${conversationId}. History length: 1, UserId: ${userId || 'N/A'}`);
    }
    this.conversationStates.set(conversationId, state);
    this.logger.debug(
      `State updated for conversation ID: ${conversationId}. History length: ${state.history.length}`,
    );
    return state;
  }

  async clearState(conversationId: string): Promise<void> {
    this.logger.debug(`Clearing state for conversation ID: ${conversationId}`);
    const result = this.conversationStates.delete(conversationId);
    if (result) {
      this.logger.debug(`State cleared for conversation ID: ${conversationId}`);
    } else {
      this.logger.warn(
        `Attempted to clear state for non-existent conversation ID: ${conversationId}`,
      );
    }
  }

  async clearAllStates(): Promise<void> {
    this.logger.warn('Clearing all conversation states from memory.');
    this.conversationStates.clear();
    this.logger.info('All conversation states cleared.');
  }
} 