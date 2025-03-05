import { db } from '../infrastructure/database';
import { OpenAIService, openAIService } from './openai.service';
import { createLogger } from '../utils/logger';
import { encode } from 'gpt-tokenizer';

// Define the ChatMessage interface locally if not available in types
interface ChatMessage {
  role: string;
  content: string;
}

interface SummaryOptions {
  maxTokenCount?: number;
  minMessageCount?: number;
  summaryPrompt?: string;
  model?: string;
}

/**
 * Service responsible for summarizing conversations
 * This helps maintain context across long conversations by periodically
 * creating summaries that can replace older message history
 */
export class ConversationSummaryService {
  private logger = createLogger('ConversationSummaryService');
  private openAI: OpenAIService;
  private defaultOptions: SummaryOptions = {
    maxTokenCount: 4000,
    minMessageCount: 10,
    summaryPrompt: 'Summarize the key points of this conversation concisely. Include main questions, answers, and any important details or decisions.',
    model: 'gpt-4o-mini'
  };
  
  constructor(openAIService?: OpenAIService) {
    this.openAI = openAIService || openAIService;
  }
  
  /**
   * Periodically summarize active conversations that exceed a token threshold
   * This is designed to be called by a scheduled task
   */
  async summarizeActiveConversations(): Promise<{ processed: number; summarized: number; errors: number }> {
    this.logger.info('Starting scheduled conversation summarization task');
    
    try {
      // First check if the is_active column exists
      const hasIsActive = await this.columnExists('chat_sessions', 'is_active');
      
      // Get all active chat sessions with their messages
      let activeConversations;
      if (hasIsActive) {
        activeConversations = await db('chat_sessions')
          .where({ is_active: true })
          .select('id', 'title', 'metadata');
        
        // Try to get user_id if it exists
        const hasUserId = await this.columnExists('chat_sessions', 'user_id');
        if (hasUserId) {
          activeConversations = await db('chat_sessions')
            .where({ is_active: true })
            .select('id', 'user_id', 'title', 'metadata');
        }
      } else {
        // If is_active doesn't exist, get all conversations
        activeConversations = await db('chat_sessions')
          .select('id', 'title', 'metadata');
          
        // Try to get user_id if it exists
        const hasUserId = await this.columnExists('chat_sessions', 'user_id');
        if (hasUserId) {
          activeConversations = await db('chat_sessions')
            .select('id', 'user_id', 'title', 'metadata');
        }
      }
      
      this.logger.info(`Found ${activeConversations.length} active conversations`);
      
      let processed = 0;
      let summarized = 0;
      let errors = 0;
      
      // Process each conversation
      for (const conversation of activeConversations) {
        try {
          processed++;
          
          // Get all messages for this conversation
          const messages = await db('chat_messages')
            .where({ session_id: conversation.id })
            .orderBy('created_at', 'asc')
            .select('*');
          
          // Skip if not enough messages
          if (messages.length < (this.defaultOptions.minMessageCount || 10)) {
            this.logger.debug(`Conversation ${conversation.id} has only ${messages.length} messages, skipping summarization`);
            continue;
          }
          
          // Check if we need to summarize based on token count
          const needsSummarization = await this.shouldSummarizeConversation(messages);
          
          if (needsSummarization) {
            this.logger.info(`Summarizing conversation ${conversation.id} with ${messages.length} messages`);
            
            // Generate summary
            const summary = await this.summarizeMessages(messages);
            
            // Save the summary to the database
            if (summary) {
              await this.saveConversationSummary(conversation.id, summary, messages);
              summarized++;
              this.logger.info(`Successfully summarized conversation ${conversation.id}`);
            }
          } else {
            this.logger.debug(`Conversation ${conversation.id} does not need summarization yet`);
          }
        } catch (error) {
          errors++;
          this.logger.error(`Error processing conversation ${conversation.id}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      this.logger.info(`Conversation summarization task completed: ${processed} processed, ${summarized} summarized, ${errors} errors`);
      return { processed, summarized, errors };
    } catch (error) {
      this.logger.error('Error in summarizeActiveConversations', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Helper method to check if a column exists in a table
   */
  private async columnExists(table: string, column: string): Promise<boolean> {
    try {
      // Use a raw query to check if the column exists in the information schema
      const result = await db.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ? AND column_name = ?
      `, [table, column]);
      
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error(`Error checking if column ${column} exists in table ${table}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Determine if a conversation should be summarized based on token count
   */
  private async shouldSummarizeConversation(messages: any[]): Promise<boolean> {
    try {
      // Get system settings for summarization threshold
      const settingsRecord = await db('system_settings')
        .where({ key: 'chat_defaults' })
        .first();
      
      let summarizeThreshold = this.defaultOptions.maxTokenCount;
      
      if (settingsRecord) {
        const settings = typeof settingsRecord.value === 'string' 
          ? JSON.parse(settingsRecord.value) 
          : settingsRecord.value;
        
        if (settings.summarize_threshold) {
          // Convert from number of messages to approximate token count (250 tokens per message on average)
          summarizeThreshold = settings.summarize_threshold * 250;
        }
      }
      
      // Calculate token count
      const totalTokens = this.calculateTotalTokens(messages);
      
      return totalTokens > summarizeThreshold;
    } catch (error) {
      this.logger.error('Error determining if conversation should be summarized', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Calculate the approximate token count for a set of messages
   */
  private calculateTotalTokens(messages: any[]): number {
    try {
      let totalTokens = 0;
      
      for (const message of messages) {
        const content = message.content || '';
        const tokens = encode(content);
        totalTokens += tokens.length;
      }
      
      return totalTokens;
    } catch (error) {
      // Fallback to approximation if tokenizer fails
      this.logger.warn('Error calculating tokens, using approximation', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return messages.reduce((total, message) => {
        const content = message.content || '';
        // Approximate: 1 token per 4 characters
        return total + Math.ceil(content.length / 4);
      }, 0);
    }
  }
  
  /**
   * Summarize a set of messages
   */
  private async summarizeMessages(messages: any[]): Promise<string | null> {
    try {
      // Convert database messages to ChatMessage format
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add summary system prompt
      const systemPrompt = {
        role: 'system',
        content: this.defaultOptions.summaryPrompt
      };
      
      // Generate summary
      const response = await this.openAI.generateChatCompletion(
        [systemPrompt, ...formattedMessages],
        { model: this.defaultOptions.model as any }
      );
      
      if ('choices' in response && response.choices && response.choices.length > 0) {
        return response.choices[0].message.content || null;
      } else {
        throw new Error('No summary generated');
      }
    } catch (error) {
      this.logger.error('Error summarizing messages', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  /**
   * Save a conversation summary to the database
   */
  private async saveConversationSummary(
    sessionId: string, 
    summary: string, 
    messages: any[]
  ): Promise<void> {
    try {
      // Get the timestamp of the last message to be archived
      const messagesToArchive = messages.slice(0, -5); // Keep the last 5 messages active
      const lastMessageTimestamp = messagesToArchive.length > 0 
        ? messagesToArchive[messagesToArchive.length - 1].created_at 
        : null;
      
      // Begin transaction
      await db.transaction(async trx => {
        // Create a new system message with the summary
        await trx('chat_messages').insert({
          session_id: sessionId,
          role: 'system',
          content: summary,
          metadata: JSON.stringify({
            type: 'summary',
            messages_count: messagesToArchive.length,
            timestamp: new Date().toISOString()
          }),
          created_at: new Date(),
          updated_at: new Date()
        });
        
        // Mark summarized messages as archived in their metadata
        if (lastMessageTimestamp) {
          await trx('chat_messages')
            .where({ session_id: sessionId })
            .where('created_at', '<=', lastMessageTimestamp)
            .update({
              metadata: db.raw(`
                CASE 
                  WHEN metadata IS NULL THEN '{"archived": true}'::jsonb
                  ELSE metadata || '{"archived": true}'::jsonb
                END
              `),
              updated_at: new Date()
            });
        }
        
        this.logger.info(`Successfully saved summary for session ${sessionId}, archived ${messagesToArchive.length} messages`);
      });
    } catch (error) {
      this.logger.error(`Error saving conversation summary for session ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Manually summarize a specific conversation
   */
  async summarizeConversation(sessionId: string, options?: SummaryOptions): Promise<string | null> {
    try {
      this.logger.info(`Manually summarizing conversation ${sessionId}`);
      
      // Get all messages for this conversation
      const messages = await db('chat_messages')
        .where({ session_id: sessionId })
        .orderBy('created_at', 'asc')
        .select('*');
      
      if (messages.length === 0) {
        this.logger.warn(`No messages found for conversation ${sessionId}`);
        return null;
      }
      
      // Generate summary
      const summary = await this.summarizeMessages(messages);
      
      // Save the summary if requested
      if (summary && options?.maxTokenCount !== 0) {
        await this.saveConversationSummary(sessionId, summary, messages);
        this.logger.info(`Successfully summarized conversation ${sessionId}`);
      }
      
      return summary;
    } catch (error) {
      this.logger.error(`Error manually summarizing conversation ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get the latest summary for a conversation
   */
  async getConversationSummary(sessionId: string): Promise<{ summary: string; timestamp: Date } | null> {
    try {
      const summaryMessage = await db('chat_messages')
        .where({ 
          session_id: sessionId,
          role: 'system'
        })
        .whereRaw(`metadata->>'type' = 'summary'`)
        .orderBy('created_at', 'desc')
        .first();
      
      if (!summaryMessage) {
        return null;
      }
      
      const metadata = typeof summaryMessage.metadata === 'string'
        ? JSON.parse(summaryMessage.metadata)
        : summaryMessage.metadata;
      
      return {
        summary: summaryMessage.content,
        timestamp: new Date(metadata.timestamp || summaryMessage.created_at)
      };
    } catch (error) {
      this.logger.error(`Error getting conversation summary for session ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}

// Singleton instance
export const conversationSummaryService = new ConversationSummaryService(); 