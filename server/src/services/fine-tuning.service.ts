import { db } from '../config/database';
import { OpenAIService } from './openai.service';
import { createServiceLogger } from '../utils/logger-factory';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FilePurpose } from 'openai/resources/files';

interface FineTuningJob {
  id: string;
  status: 'created' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  model: string;
  created_at: string;
  finished_at?: string;
  trained_tokens?: number;
  organization_id?: string;
  result_files?: string[];
  error?: any;
}

/**
 * Service for fine-tuning OpenAI models
 * This service enables customizing LLMs for specific use cases
 * by training them on conversation history or other data
 */
export class FineTuningService {
  private openaiService: OpenAIService;
  private readonly logger = createServiceLogger('FineTuningService');
  private readonly trainingDataDir = 'training_data';

  constructor() {
    this.openaiService = OpenAIService.getInstance();
    this.logger.info('Initialized FineTuningService');

    // Ensure training data directory exists
    this.ensureDirectoryExists(this.trainingDataDir);
  }

  /**
   * Create a fine-tuning job from conversation data
   * @param sessionIds Array of session IDs to use for training data
   * @param options Options for the fine-tuning job
   * @param options.model The model to use for fine-tuning, defaults to gpt-4o-mini-2024-07-18
   * @param options.suffix A suffix to add to the fine-tuned model name
   * @param options.organizationId The OpenAI organization ID to use
   * @param options.hyperparameters Custom hyperparameters for the fine-tuning job
   * @param options.method The training method to use:
   *   - type: 'supervised' (default) or 'dpo' (Direct Preference Optimization)
   *   - dpo: Additional settings for DPO method including beta parameter
   * @returns Object containing job info or error details
   */
  async createFineTuningJobFromConversation(
    sessionIds: string[],
    options: {
      model?: string;
      suffix?: string;
      organizationId?: string;
      hyperparameters?: {
        batchSize?: number;
        learningRateMultiplier?: number;
        nEpochs?: number;
      };
      method?: {
        type: 'supervised' | 'dpo';
        dpo?: {
          beta?: number | 'auto';
        };
      };
    } = {}
  ): Promise<{
    jobId?: string;
    fileId?: string;
    status: string;
    message: string;
    error?: any;
  }> {
    try {
      // Set default options
      const {
        model = 'gpt-4o-mini-2024-07-18',
        suffix = `${Date.now()}`,
        organizationId,
        hyperparameters = {},
        method
      } = options;

      this.logger.info(`Creating fine-tuning job for ${sessionIds.length} conversation sessions`);

      // 1. Extract conversations from the database
      const conversations = await this.extractConversations(sessionIds);

      if (!conversations || conversations.length === 0) {
        return {
          status: 'error',
          message: 'No valid conversations found for fine-tuning'
        };
      }

      this.logger.info(`Extracted ${conversations.length} conversations with a total of ${
        conversations.reduce((sum, conv) => sum + conv.length, 0)
      } messages`);

      // 2. Format conversations for fine-tuning
      const trainingData = this.formatForFineTuning(conversations);

      if (trainingData.length === 0) {
        return {
          status: 'error',
          message: 'Unable to create valid training examples from conversations'
        };
      }

      // 3. Write training data to a file
      const filePath = await this.writeTrainingDataToFile(trainingData, suffix);

      // 4. Upload the file to OpenAI
      const uploadResponse = await this.openaiService.uploadFile(filePath, 'fine-tune' as FilePurpose);

      if (!uploadResponse || !uploadResponse.id) {
        return {
          status: 'error',
          message: 'Failed to upload training data to OpenAI',
          error: uploadResponse
        };
      }

      const fileId = uploadResponse.id;
      this.logger.info(`Successfully uploaded training file with ID: ${fileId}`);

      // 5. Create the fine-tuning job
      const hyperParams: any = {};
      if (hyperparameters.batchSize) hyperParams.batch_size = hyperparameters.batchSize;
      if (hyperparameters.learningRateMultiplier) hyperParams.learning_rate_multiplier = hyperparameters.learningRateMultiplier;
      if (hyperparameters.nEpochs) hyperParams.n_epochs = hyperparameters.nEpochs;

      // Prepare fine-tuning job params
      const jobParams: any = {
        training_file: fileId,
        model,
        suffix,
        hyperparameters: Object.keys(hyperParams).length > 0 ? hyperParams : undefined
      };

      // Add method if specified
      if (method) {
        // Format the method parameter
        const formattedMethod: any = {
          type: method.type
        };

        // Add DPO settings if available
        if (method.type === 'dpo' && method.dpo) {
          formattedMethod.dpo = {
            hyperparameters: {}
          };
          
          if (method.dpo.beta !== undefined) {
            formattedMethod.dpo.hyperparameters.beta = method.dpo.beta;
          }
        }
        
        jobParams.method = formattedMethod;
      }

      const jobResponse = await this.openaiService.createFineTuningJob(jobParams);

      if (!jobResponse || !jobResponse.id) {
        return {
          status: 'error',
          message: 'Failed to create fine-tuning job',
          error: jobResponse,
          fileId
        };
      }

      const jobId = jobResponse.id;

      // 6. Store the job information in the database
      await db('fine_tuning_jobs').insert({
        id: jobId,
        status: jobResponse.status || 'created',
        model: jobResponse.model || model,
        file_id: fileId,
        organization_id: organizationId,
        metadata: {
          sessions: sessionIds,
          suffix,
          hyperparameters: hyperparameters,
          created_at: new Date().toISOString(),
          examples_count: trainingData.length
        },
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        jobId,
        fileId,
        status: 'created',
        message: `Fine-tuning job created successfully with ID: ${jobId}`
      };

    } catch (error) {
      this.logger.error('Error creating fine-tuning job:', error);
      return {
        status: 'error',
        message: `Error creating fine-tuning job: ${error instanceof Error ? error.message : String(error)}`,
        error
      };
    }
  }

  /**
   * Check the status of a fine-tuning job
   */
  async getFineTuningJobStatus(jobId: string): Promise<{
    job?: FineTuningJob;
    status: string;
    message: string;
  }> {
    try {
      const response = await this.openaiService.getFineTuningJob(jobId);

      if (!response || !response.id) {
        return {
          status: 'error',
          message: `Failed to retrieve fine-tuning job with ID: ${jobId}`
        };
      }

      // Update the job status in the database
      await db('fine_tuning_jobs')
        .where({ id: jobId })
        .update({
          status: response.status,
          updated_at: new Date(),
          metadata: db.raw(`
            jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{api_response}',
              ?::jsonb
            )
          `, [JSON.stringify(response)])
        });

      return {
        job: {
          id: response.id,
          status: response.status,
          model: response.model,
          created_at: response.created_at,
          finished_at: response.finished_at,
          trained_tokens: response.trained_tokens,
          organization_id: response.organization_id,
          result_files: response.result_files,
          error: response.error
        },
        status: 'success',
        message: `Fine-tuning job status: ${response.status}`
      };
    } catch (error) {
      this.logger.error(`Error checking fine-tuning job status for ${jobId}:`, error);
      return {
        status: 'error',
        message: `Error checking job status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * List all fine-tuning jobs in the database
   */
  async listFineTuningJobs(options: {
    organizationId?: string;
    limit?: number;
    offset?: number;
    status?: string;
  } = {}): Promise<{
    jobs: any[];
    total: number;
  }> {
    try {
      const {
        organizationId,
        limit = 10,
        offset = 0,
        status
      } = options;

      // Build the query
      let query = db('fine_tuning_jobs')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      // Add filters if provided
      if (organizationId) {
        query = query.where({ organization_id: organizationId });
      }

      if (status) {
        query = query.where({ status });
      }

      // Execute the query
      const jobs = await query;

      // Get total count
      const [{ count }] = await db('fine_tuning_jobs')
        .count('id as count')
        .modify(builder => {
          if (organizationId) {
            builder.where({ organization_id: organizationId });
          }
          if (status) {
            builder.where({ status });
          }
        });

      return {
        jobs,
        total: Number(count)
      };
    } catch (error) {
      this.logger.error('Error listing fine-tuning jobs:', error);
      return {
        jobs: [],
        total: 0
      };
    }
  }

  /**
   * Cancel a fine-tuning job
   */
  async cancelFineTuningJob(jobId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await this.openaiService.cancelFineTuningJob(jobId);

      if (!response || !response.id) {
        return {
          success: false,
          message: `Failed to cancel fine-tuning job with ID: ${jobId}`
        };
      }

      // Update the job status in the database
      await db('fine_tuning_jobs')
        .where({ id: jobId })
        .update({
          status: 'cancelled',
          updated_at: new Date()
        });

      return {
        success: true,
        message: `Fine-tuning job ${jobId} cancelled successfully`
      };
    } catch (error) {
      this.logger.error(`Error cancelling fine-tuning job ${jobId}:`, error);
      return {
        success: false,
        message: `Error cancelling job: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract conversations from the database
   */
  private async extractConversations(sessionIds: string[]): Promise<any[][]> {
    const conversations: any[][] = [];

    for (const sessionId of sessionIds) {
      try {
        // Get all messages for the session
        const messages = await db('chat_messages')
          .where({ session_id: sessionId })
          .whereRaw("COALESCE(metadata->>'isSummary', 'false') = 'false'") // Exclude summary messages
          .orderBy('created_at', 'asc')
          .select('*');

        if (messages && messages.length > 1) { // Need at least 2 messages for a conversation
          conversations.push(messages);
        }
      } catch (error) {
        this.logger.error(`Error extracting conversation for session ${sessionId}:`, error);
      }
    }

    return conversations;
  }

  /**
   * Format conversations for fine-tuning
   */
  private formatForFineTuning(conversations: any[][]): any[] {
    const trainingExamples: any[] = [];

    for (const conversation of conversations) {
      try {
        // Group messages by turn
        for (let i = 0; i < conversation.length - 1; i++) {
          const currentMsg = conversation[i];
          const nextMsg = conversation[i + 1];

          // Only use user -> assistant pairs
          if (currentMsg.role === 'user' && nextMsg.role === 'assistant') {
            trainingExamples.push({
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful, accurate, and concise assistant.'
                },
                {
                  role: 'user',
                  content: currentMsg.content
                },
                {
                  role: 'assistant',
                  content: nextMsg.content
                }
              ]
            });
          }
        }
      } catch (error) {
        this.logger.error('Error formatting conversation for fine-tuning:', error);
      }
    }

    return trainingExamples;
  }

  /**
   * Write training data to a JSONL file
   */
  private async writeTrainingDataToFile(trainingData: any[], suffix: string): Promise<string> {
    const dirPath = path.resolve(this.trainingDataDir);
    const filename = `training_data_${suffix}_${uuidv4()}.jsonl`;
    const filePath = path.join(dirPath, filename);

    // Convert training data to JSONL format
    const jsonlContent = trainingData.map(example => JSON.stringify(example)).join('\n');

    // Write to file
    fs.writeFileSync(filePath, jsonlContent, 'utf8');

    this.logger.info(`Wrote ${trainingData.length} training examples to ${filePath}`);
    return filePath;
  }

  /**
   * Ensure a directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    const fullPath = path.resolve(dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      this.logger.info(`Created directory: ${fullPath}`);
    }
  }

  /**
   * Get information about available fine-tuning models
   * @returns Object containing available models and their capabilities
   */
  getAvailableFineTuningModels() {
    return {
      'gpt-4o-2024-08-06': {
        description: 'Most powerful model available for fine-tuning',
        capabilities: 'Best performance, high capability',
        costTier: 'High'
      },
      'gpt-4o-mini-2024-07-18': {
        description: 'Recommended for most fine-tuning use cases',
        capabilities: 'Good balance of performance, cost, and ease of use',
        costTier: 'Medium',
        isRecommended: true
      },
      'gpt-4-0613': {
        description: 'Previous generation GPT-4 model',
        capabilities: 'Strong performance for complex tasks',
        costTier: 'High'
      },
      'gpt-3.5-turbo-0125': {
        description: 'Latest GPT-3.5 Turbo model',
        capabilities: 'Good performance for standard tasks',
        costTier: 'Low'
      },
      'gpt-3.5-turbo-1106': {
        description: 'Previous GPT-3.5 Turbo model',
        capabilities: 'Standard performance',
        costTier: 'Low'
      },
      'gpt-3.5-turbo-0613': {
        description: 'Older GPT-3.5 Turbo model',
        capabilities: 'Basic performance',
        costTier: 'Low'
      }
    };
  }
} 