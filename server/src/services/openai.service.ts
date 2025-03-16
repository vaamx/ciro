import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { FilePurpose } from 'openai/resources/files';
import { config } from '../config/index';
import { createOpenAIClient } from '../infrastructure/ai/openai/config';
import * as winston from 'winston';
import pLimit from 'p-limit';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import LRUCache from 'lru-cache';
import { Knex } from 'knex';

// Define a more complete type for the OpenAI client
interface ExtendedOpenAI extends OpenAI {
  embeddings: {
    create: (params: any) => Promise<any>;
  };
  chat: {
    completions: {
      create: (params: any) => Promise<any>;
    };
  };
  files: {
    create: (params: any) => Promise<any>;
  };
  fineTuning: {
    jobs: {
      create: (params: any) => Promise<any>;
      retrieve: (jobId: string) => Promise<any>;
      cancel: (jobId: string) => Promise<any>;
      list: (params: any) => Promise<any>;
      listEvents: (jobId: string, params: any) => Promise<any>;
    };
  };
  models: {
    list: () => Promise<any>;
  };
}

// Ensure we have a valid API key
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY || config.openai?.apiKey || 'sk-mock-key-for-development',
  orgId: config.openai?.orgId,
  baseURL: process.env.OPENAI_API_BASE || config.openai?.baseURL || 'https://api.ciro.ai/v1'
};

// Initialize OpenAI client
const openai = createOpenAIClient(openaiConfig);

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  status: 'complete' | 'streaming' | 'error' | 'loading';
  metadata?: {
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    suggestions?: string[];
  };
}

type ModelName = 'gpt-4o-mini' | 'gpt-4o' | 'o3-mini' | 'o1-mini' | 'o1-preview' | 'gpt-4-turbo' | string;

interface ChatOptions {
  model?: ModelName;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  max_tokens?: number;
}

// Enhanced interfaces for fine-tuning
export interface FineTuningJobData {
  id: string;
  status: string;
  model: string;
  file_id?: string;
  organization_id?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface FineTuningJobCreateParams {
  training_file: string;
  validation_file?: string;
  model: string;
  suffix?: string;
  hyperparameters?: {
    batch_size?: number | 'auto';
    learning_rate_multiplier?: number | 'auto';
    n_epochs?: number | 'auto';
  };
  method?: {
    type: 'supervised' | 'dpo';
    supervised?: {
      hyperparameters?: {
        n_epochs?: number;
      };
    };
    dpo?: {
      hyperparameters?: {
        beta?: number | 'auto';
      };
    };
  };
}

export interface FineTuningJobEvent {
  id: string;
  object: string;
  created_at: number;
  level: string;
  message: string;
  data?: Record<string, any>;
}

export class OpenAIService {
  private openai: ExtendedOpenAI;
  private logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [OpenAIService]: ${message}`;
        return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf((info) => {
            const { timestamp, level, message, ...rest } = info;
            const formattedMessage = `${timestamp} [${level.toUpperCase()}] [OpenAIService]: ${message}`;
            return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
          })
        )
      })
    ]
  });
  private concurrencyLimiter = pLimit(20); // Limit concurrent API calls
  private db: Knex | null = null;
  private readonly defaultModel: ModelName = 'o3-mini';
  private readonly modelConfig = {
    'gpt-4o-mini': {
      model: 'gpt-4o-mini' as const,
      max_tokens: 4096,
      temperature: 0.7,
      description: 'Cost-effective model with good reasoning capabilities',
      costPer1kTokens: '$0.5 input / $1.5 output',
      preferredFor: ['general queries', 'simple reasoning', 'chat']
    },
    'gpt-4o': {
      model: 'gpt-4o' as const,
      max_tokens: 4096,
      temperature: 0.7,
      description: 'Powerful model with excellent reasoning and creativity',
      costPer1kTokens: '$5 input / $15 output',
      preferredFor: ['complex reasoning', 'creative tasks', 'precise instructions']
    },
    'o3-mini': {
      model: 'o3-mini' as const,
      max_tokens: 4096,
      temperature: 0.7,
      description: 'Optimized for structured reasoning and analytical tasks',
      costPer1kTokens: '$0.15 input / $0.6 output',
      preferredFor: ['analytical queries', 'structured reasoning', 'data analysis']
    },
    'o1-mini': {
      model: 'o1-mini' as const,
      max_tokens: 4096,
      temperature: 0.7,
      description: 'Highly optimized for code and logical reasoning',
      costPer1kTokens: '$0.25 input / $0.75 output', 
      preferredFor: ['code generation', 'logic problems', 'structured data']
    },
    'o1-preview': {
      model: 'o1-preview' as const,
      max_tokens: 8192,
      temperature: 0.7,
      description: 'Most powerful reasoning model for complex problems',
      costPer1kTokens: '$5 input / $15 output',
      preferredFor: ['complex analysis', 'advanced reasoning', 'expert knowledge']
    }
  } as const;
  
  // Enhanced rate limiting configuration
  private readonly rateLimiter = pLimit(20); // Increased from 5 to 20 concurrent requests
  private readonly maxRetries = 5; // Increased from 3 to 5
  private readonly retryDelay = 1000; // 1 second
  
  // Embedding cache
  private embeddingCache: any;
  private readonly CACHE_DIR = path.join(process.cwd(), '.cache', 'embeddings');
  private readonly CACHE_SIZE = 10000; // Cache up to 10,000 embeddings in memory
  private readonly EMBEDDING_MODEL = 'text-embedding-ada-002';
  private readonly DISABLE_CACHE = process.env.DISABLE_EMBEDDING_CACHE === 'true';

  // Add singleton implementation
  private static instance: OpenAIService | null = null;
  private static clientInitialized = false;
  private static constructorCallCount = 0;

  /**
   * Get the singleton instance of OpenAIService
   */
  public static getInstance(database?: Knex): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService(database);
    }
    return OpenAIService.instance;
  }
  
  /**
   * Get the count of constructor calls for diagnostics
   */
  public static getConstructorCallCount(): number {
    return OpenAIService.constructorCallCount;
  }

  constructor(database?: Knex) {
    OpenAIService.constructorCallCount++;
    
    // Check if caching is disabled
    if (this.DISABLE_CACHE) {
      this.logger.info('Embedding cache is DISABLED via DISABLE_EMBEDDING_CACHE environment variable');
    }
    
    // Warn if constructor is called multiple times
    if (OpenAIService.constructorCallCount > 1) {
      this.logger.warn(`⚠️ Warning: OpenAIService constructor called ${OpenAIService.constructorCallCount} times. Use OpenAIService.getInstance() instead.`);
      if (OpenAIService.instance) {
        return OpenAIService.instance;
      }
    }
    
    const apiKey = process.env.OPENAI_API_KEY || config?.openai?.apiKey;
    
    // Only log API key status once
    if (!OpenAIService.clientInitialized) {
      if (apiKey) {
        console.log(`OpenAI API key is available (${apiKey.substring(0, 8)}...)`);
        console.log(`Using OpenAI base URL: ${config?.openai?.baseURL || 'https://api.openai.com/v1'}`);
      } else {
        console.error('OpenAI API key not found!');
      }
    }
    
    const baseURL = config?.openai?.baseURL || 'https://api.openai.com/v1';
    
    // Only initialize the client once
    if (!OpenAIService.clientInitialized) {
      try {
        this.logger.info(`Creating OpenAI client with baseURL: ${baseURL}`);
        
        // Cast the OpenAI client to our ExtendedOpenAI type
        this.openai = openai as unknown as ExtendedOpenAI;
        
        this.logger.info('OpenAI client created successfully');
        console.log('OpenAI client created successfully');
        OpenAIService.clientInitialized = true;
      } catch (error) {
        this.logger.error('Failed to create OpenAI client', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        console.error('Failed to initialize OpenAI client:', error);
        
        // Create a mock client that will throw appropriate errors when used
        this.openai = {
          embeddings: {
            create: async () => {
              throw new Error('OpenAI client was not properly initialized');
            }
          },
          chat: {
            completions: {
              create: async () => {
                throw new Error('OpenAI client was not properly initialized');
              }
            }
          }
        } as unknown as ExtendedOpenAI;
      }
    } else {
      // We already initialized the client, use the one from the singleton instance
      if (OpenAIService.instance) {
        this.openai = OpenAIService.instance.openai;
      }
    }
    
    // Set database if provided
    if (database) {
      this.db = database;
    }
    
    // Initialize embedding cache
    const cacheOptions = {
      max: this.CACHE_SIZE,
      ttl: 1000 * 60 * 60 * 24 * 7, // Cache for 7 days
    };
    this.embeddingCache = new LRUCache(cacheOptions);
    
    // Create cache directory if it doesn't exist and caching is enabled
    if (!this.DISABLE_CACHE) {
      try {
        if (!fs.existsSync(this.CACHE_DIR)) {
          fs.mkdirSync(this.CACHE_DIR, { recursive: true });
          this.logger.info(`Created embedding cache directory: ${this.CACHE_DIR}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to create embedding cache directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Load cache stats
    this.loadCacheStats();
  }

  /**
   * Load cache statistics
   */
  private loadCacheStats(): void {
    try {
      if (fs.existsSync(this.CACHE_DIR)) {
        const files = fs.readdirSync(this.CACHE_DIR);
        this.logger.info(`Embedding cache contains ${files.length} files`);
      }
    } catch (error) {
      this.logger.warn(`Failed to load cache stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create embeddings for one or more texts
   * Optimized for large document sets with improved caching and batching
   * 
   * @param input Single string or array of strings to embed
   * @param options Optional parameters
   * @returns Array of embeddings as number arrays
   */
  async createEmbeddings(
    input: string | string[], 
    options: { 
      skipCache?: boolean; 
      model?: string;
      batchSize?: number;
    } = {}
  ): Promise<number[][]> {
    const texts = Array.isArray(input) ? input : [input];
    
    if (texts.length === 0) {
      return [];
    }
    
    try {
      // Default options
      const skipCache = options.skipCache || this.DISABLE_CACHE;
      const model = options.model || this.EMBEDDING_MODEL;
      
      // Process very long texts by truncating them
      const processedTexts = texts.map(text => this.truncateTextForEmbedding(text));
      
      // Calculate optimal batch size based on text length
      const totalChars = processedTexts.reduce((sum, text) => sum + text.length, 0);
      const avgTextLength = totalChars / processedTexts.length;
      
      // Use provided batch size or calculate optimal batch size
      const batchSize = options.batchSize || this.calculateOptimalBatchSize(avgTextLength);
      
      // Log embedding creation
      this.logger.info(`Creating embeddings for ${texts.length} texts (avgLength: ${Math.round(avgTextLength)} chars) using model: ${model}, batchSize: ${batchSize}`);
      
      // Create batches
      const batches: string[][] = [];
      for (let i = 0; i < processedTexts.length; i += batchSize) {
        batches.push(processedTexts.slice(i, i + batchSize));
      }
      
      // Process each batch with optional caching
      const allEmbeddings: number[][] = [];
      
      // Process batches in parallel with concurrency control
      const batchResults = await Promise.all(
        batches.map((batch, index) => 
          this.concurrencyLimiter(() => 
            this.processEmbeddingBatchWithCache(
              batch, 
              index, 
              batches.length,
              skipCache,
              model
            )
          )
        )
      );
      
      // Combine results from all batches
      for (const batchResult of batchResults) {
        allEmbeddings.push(...batchResult);
      }
      
      return allEmbeddings;
    } catch (error) {
      this.logger.error(`Error creating embeddings: ${error.message}`, {
        textsCount: texts.length,
        error
      });
      throw error;
    }
  }
  
  /**
   * Calculate the optimal batch size based on average text length
   * Adjusted to handle large document sets better
   */
  private calculateOptimalBatchSize(avgTextLength: number): number {
    // Higher limit for efficiency, helps process more documents
    if (avgTextLength > 10000) {
      return 1; // For very long texts, process one at a time
    } else if (avgTextLength > 5000) {
      return 2; 
    } else if (avgTextLength > 1000) {
      return 5;
    } else if (avgTextLength > 500) {
      return 10;
    } else if (avgTextLength > 250) {
      return 20;
    } else {
      return 50; // For very short texts, process in larger batches
    }
  }
  
  /**
   * Truncate text for embedding to ensure it fits within token limits
   * More aggressive truncation to ensure we can process large documents
   */
  private truncateTextForEmbedding(text: string): string {
    if (!text) return '';
    
    // Maximum number of tokens (~8k tokens * 4 chars per token = ~32K chars)
    const MAX_CHARS = 32000;
    
    if (text.length <= MAX_CHARS) {
      return text;
    }
    
    // For very long text, take beginning and end portions for more representative embedding
    const halfLength = Math.floor(MAX_CHARS / 2);
    const beginning = text.substring(0, halfLength);
    const end = text.substring(text.length - halfLength);
    
    // Combine with a marker in between
    return `${beginning}\n...[content truncated for embedding]...\n${end}`;
  }

  /**
   * Selects the appropriate model based on the query content
   * This helps optimize cost and performance
   * @param query The user query
   * @returns The recommended model name
   */
  public selectModelForQuery(query: string): ModelName {
    const queryLength = query.length;
    const complexityScore = this.analyzeQueryComplexity(query);
    
    this.logger.debug(`Query length: ${queryLength}, complexity score: ${complexityScore}`);
    
    // For extra long or complex queries, use GPT-4o
    if (queryLength > 1000 && complexityScore > 7) {
      return 'gpt-4o';
    }
    
    // For code-related tasks, use o1-mini
    if (this.isCodeRelatedQuery(query)) {
      return 'o1-mini';
    }
    
    // For anything else, use o3-mini
    return 'o3-mini'; // Good creativity at reasonable cost
  }

  async generateChatCompletion(messages: ChatCompletionMessageParam[], options: ChatOptions = {}) {
    try {
      const model = options.model || this.defaultModel;
      const modelConfig = this.modelConfig[model];
      
      // Add structured data handling system prompt if needed
      if (messages.length > 0 && messages[0].role === 'system') {
        const systemPrompt = messages[0].content as string;
        
        // Enhance system prompt with better structured data handling instructions
        if (systemPrompt.includes('analyze') || systemPrompt.includes('data') || systemPrompt.includes('table')) {
          const enhancedPrompt = `${systemPrompt}

When analyzing tabular data, please follow these strict guidelines:
1. Always present your analysis in clear, structured sections starting with a concise summary
2. When working with tables, ALWAYS process the data completely before responding
3. For each analytical step, show the actual data processing results, not just descriptions
4. Include properly formatted markdown tables in each step where relevant
5. Provide actionable insights based on the data, not generic observations
6. Always end with a "Next Steps" section suggesting follow-up analyses
7. Format your full response with proper headings and structure using markdown
8. If generating charts or visualizations, be specific about what they should show

Your response MUST have the following sections:
- Summary: A concise overview of the findings
- Steps: Detailed analytical steps WITH calculated results and data tables
- Insights: KEY findings from the data
- Visualization: A suggested visualization with specific data points
- Next Steps: Suggested follow-up analyses

Format structured responses as parseable JSON where appropriate.`;
          
          // Replace the system prompt with enhanced version
          messages[0].content = enhancedPrompt;
        }
      }
      
      // Check if this is a Claude model (o3-mini, o1-mini, etc.)
      const isClaudeModel = model.startsWith('o1-') || model.startsWith('o3-');
      
      // Create base request parameters (common for all models)
      const requestParameters: any = {
        model: modelConfig.model,
        messages: messages,
        stream: options.stream ?? false
      };
      
      // Add model-specific parameters
      if (isClaudeModel) {
        // Claude models use max_completion_tokens and don't support temperature
        requestParameters.max_completion_tokens = options.max_tokens ?? modelConfig.max_tokens;
      } else {
        // OpenAI models use max_tokens and temperature
        requestParameters.max_tokens = options.max_tokens ?? modelConfig.max_tokens;
        requestParameters.temperature = options.temperature ?? modelConfig.temperature;
      }
      
      // Log the model being used
      this.logger.info(`Creating chat completion with model ${model}`);
      
      // Send request to OpenAI
      const response = await this.openai.chat.completions.create(requestParameters);
      
      this.logger.info(`Chat completion created successfully with model: ${model}`);
      return response;
    } catch (error) {
      this.logger.error(`Error generating chat completion: ${error}`);
      throw error;
    }
  }

  /**
   * Upload a file to OpenAI for fine-tuning
   * @param filePath Path to the file to upload
   * @param purpose Purpose of the file, e.g., 'fine-tune'
   * @returns OpenAI file response
   */
  async uploadFile(filePath: string, purpose: FilePurpose): Promise<any> {
    try {
      this.logger.info(`Uploading file ${filePath} for ${purpose}`);
      
      const file = await this.openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: purpose
      });
      
      this.logger.info(`Successfully uploaded file with ID: ${file.id}`);
      return file;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a fine-tuning job with enhanced database storage
   * @param params Fine-tuning job parameters
   * @returns Fine-tuning job response and database record
   */
  async createFineTuningJob(params: FineTuningJobCreateParams): Promise<any> {
    try {
      this.logger.info(`Creating fine-tuning job for file ${params.training_file} with model ${params.model}`);
      
      const response = await this.openai.fineTuning.jobs.create({
        training_file: params.training_file,
        validation_file: params.validation_file,
        model: params.model,
        suffix: params.suffix,
        hyperparameters: params.hyperparameters,
        method: params.method
      });
      
      this.logger.info(`Successfully created fine-tuning job with ID: ${response.id}`);
      
      // Store the job in the database if available
      if (this.db) {
        await this.db('fine_tuning_jobs').insert({
          id: response.id,
          status: response.status,
          model: response.model,
          file_id: params.training_file,
          organization_id: response.organization_id,
          metadata: JSON.stringify({
            hyperparameters: params.hyperparameters,
            method: params.method,
            suffix: params.suffix,
            validation_file: params.validation_file
          }),
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      return response;
    } catch (error) {
      this.logger.error(`Error creating fine-tuning job: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get the status of a fine-tuning job
   * @param jobId The ID of the fine-tuning job
   * @returns Fine-tuning job details
   */
  async getFineTuningJob(jobId: string): Promise<any> {
    try {
      this.logger.info(`Retrieving fine-tuning job with ID: ${jobId}`);
      
      const response = await this.openai.fineTuning.jobs.retrieve(jobId);
      
      this.logger.info(`Successfully retrieved fine-tuning job: ${jobId} (Status: ${response.status})`);
      
      // Update the job status in the database if available
      if (this.db) {
        await this.db('fine_tuning_jobs')
          .where({ id: jobId })
          .update({
            status: response.status,
            updated_at: new Date()
          });
      }
      
      return response;
    } catch (error) {
      this.logger.error(`Error retrieving fine-tuning job: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Cancel a fine-tuning job
   * @param jobId The ID of the fine-tuning job to cancel
   * @returns Response from the cancelation request
   */
  async cancelFineTuningJob(jobId: string): Promise<any> {
    try {
      this.logger.info(`Cancelling fine-tuning job with ID: ${jobId}`);
      
      const response = await this.openai.fineTuning.jobs.cancel(jobId);
      
      this.logger.info(`Successfully cancelled fine-tuning job: ${jobId}`);
      
      // Update the job status in the database if available
      if (this.db) {
        await this.db('fine_tuning_jobs')
          .where({ id: jobId })
          .update({
            status: 'cancelled',
            updated_at: new Date()
          });
      }
      
      return response;
    } catch (error) {
      this.logger.error(`Error cancelling fine-tuning job: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List all fine-tuning jobs
   * @param params Optional parameters for filtering
   * @returns List of fine-tuning jobs
   */
  async listFineTuningJobs(params: { limit?: number; after?: string; status?: string } = {}): Promise<any> {
    try {
      this.logger.info('Listing fine-tuning jobs');
      
      // Create params object that fits OpenAI's API requirements
      const apiParams: Record<string, any> = {};
      if (params.limit) apiParams.limit = params.limit;
      if (params.after) apiParams.after = params.after;
      
      const response = await this.openai.fineTuning.jobs.list(apiParams);
      
      // If status filter was provided, filter the results in memory
      let filteredData = response.data;
      if (params.status) {
        filteredData = response.data.filter(job => job.status === params.status);
      }
      
      this.logger.info(`Retrieved ${filteredData.length} fine-tuning jobs`);
      
      // Sync with database if available
      if (this.db) {
        for (const job of filteredData) {
          const exists = await this.db('fine_tuning_jobs')
            .where({ id: job.id })
            .first();
          
          if (exists) {
            // Update existing record
            await this.db('fine_tuning_jobs')
              .where({ id: job.id })
              .update({
                status: job.status,
                updated_at: new Date()
              });
          } else {
            // Insert new record
            await this.db('fine_tuning_jobs').insert({
              id: job.id,
              status: job.status,
              model: job.model,
              organization_id: job.organization_id,
              created_at: new Date(job.created_at * 1000),
              updated_at: new Date()
            });
          }
        }
      }
      
      // Return with the same structure as the original response but with filtered data
      return {
        ...response,
        data: filteredData
      };
    } catch (error) {
      this.logger.error(`Error listing fine-tuning jobs: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get events for a fine-tuning job
   * @param jobId The ID of the fine-tuning job
   * @param params Optional parameters for filtering
   * @returns List of events for the job
   */
  async getFineTuningJobEvents(
    jobId: string, 
    params: { limit?: number; after?: string } = {}
  ): Promise<FineTuningJobEvent[]> {
    try {
      this.logger.info(`Retrieving events for fine-tuning job with ID: ${jobId}`);
      
      const response = await this.openai.fineTuning.jobs.listEvents(
        jobId,
        {
          limit: params.limit,
          after: params.after
        }
      );
      
      this.logger.info(`Retrieved ${response.data.length} events for fine-tuning job: ${jobId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error retrieving fine-tuning job events: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a dataset from chat conversations
   * @param sessionIds Array of chat session IDs to include
   * @param outputPath Path to save the generated dataset
   * @returns Path to the created dataset file
   */
  async createFineTuningDatasetFromConversations(
    sessionIds: string[],
    outputPath: string
  ): Promise<string> {
    try {
      this.logger.info(`Creating fine-tuning dataset from ${sessionIds.length} conversations`);
      
      if (!this.db) {
        throw new Error('Database connection is required for this operation');
      }
      
      // Get messages from the specified sessions
      const messages = await this.db('chat_messages')
        .whereIn('session_id', sessionIds)
        .orderBy(['session_id', 'created_at']);
      
      if (messages.length === 0) {
        throw new Error('No messages found for the specified sessions');
      }
      
      // Group messages by session
      const messagesBySession: Record<string, any[]> = {};
      for (const message of messages) {
        if (!messagesBySession[message.session_id]) {
          messagesBySession[message.session_id] = [];
        }
        messagesBySession[message.session_id].push(message);
      }
      
      // Convert to JSONL format for OpenAI fine-tuning
      const jsonlData: string[] = [];
      
      // Process each conversation
      for (const sessionId in messagesBySession) {
        const sessionMessages = messagesBySession[sessionId];
        
        // Create message pairs (user + assistant)
        for (let i = 0; i < sessionMessages.length - 1; i++) {
          const current = sessionMessages[i];
          const next = sessionMessages[i + 1];
          
          // Only include user-assistant pairs
          if (current.role === 'user' && next.role === 'assistant') {
            const example = {
              messages: [
                {
                  role: 'user',
                  content: current.content
                },
                {
                  role: 'assistant',
                  content: next.content
                }
              ]
            };
            
            jsonlData.push(JSON.stringify(example));
          }
        }
      }
      
      if (jsonlData.length === 0) {
        throw new Error('No valid message pairs found for fine-tuning');
      }
      
      // Write data to file
      const datasetContent = jsonlData.join('\n');
      fs.writeFileSync(outputPath, datasetContent);
      
      this.logger.info(`Created fine-tuning dataset with ${jsonlData.length} examples at ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error(`Error creating fine-tuning dataset: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get available models for fine-tuning
   * @returns List of models available for fine-tuning
   */
  async getAvailableFineTuningModels(): Promise<string[]> {
    try {
      this.logger.info('Retrieving available models for fine-tuning');
      
      const response = await this.openai.models.list();
      
      // Filter for models that are likely to support fine-tuning
      // Note: The API doesn't directly provide 'fine_tunable' so we'll filter by known patterns
      const fineTunableModels = response.data
        .filter(model => {
          // Models that typically support fine-tuning follow certain naming patterns
          const modelId = model.id.toLowerCase();
          return modelId.includes('gpt-3.5') || 
                 modelId.includes('gpt-4') || 
                 modelId.includes('davinci') ||
                 modelId.includes('babbage') ||
                 modelId.includes('curie') ||
                 modelId.includes('ada');
        })
        .map(model => model.id);
      
      this.logger.info(`Identified ${fineTunableModels.length} potential fine-tunable models`);
      return fineTunableModels;
    } catch (error) {
      this.logger.error(`Error retrieving fine-tunable models: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Analyzes a query and returns a complexity score from 0-10
   * Higher scores indicate more complex queries that might need more powerful models
   */
  private analyzeQueryComplexity(query: string): number {
    let score = 0;
    
    // Length-based complexity
    if (query.length > 200) score += 1;
    if (query.length > 500) score += 1;
    if (query.length > 1000) score += 1;
    
    // Check for complex reasoning indicators
    const reasoningPatterns = [
      /\bexplain\b/i,
      /\breason\b/i, 
      /\bwhy\b/i,
      /\bhow\b/i,
      /\bcause\b/i,
      /\beffect\b/i,
      /\brelationship\b/i,
      /\bcorrelation\b/i,
      /\banalyze\b/i,
      /\bsynthesis\b/i
    ];
    
    // Check for analytical indicators
    const analyticalPatterns = [
      /\bdata\b/i,
      /\banalysis\b/i,
      /\bcompare\b/i,
      /\btrend\b/i,
      /\bstatistics\b/i,
      /\bcount\b/i,
      /\bhow many\b/i,
      /\bpercentage\b/i,
      /\bcalculate\b/i,
      /\bmeasure\b/i
    ];
    
    // Add score for reasoning and analytical indicators
    for (const pattern of reasoningPatterns) {
      if (pattern.test(query)) score += 0.5;
    }
    
    for (const pattern of analyticalPatterns) {
      if (pattern.test(query)) score += 0.5;
    }
    
    // Cap the score at 10
    return Math.min(10, score);
  }
  
  /**
   * Detects if a query is related to code or programming
   */
  private isCodeRelatedQuery(query: string): boolean {
    const codePatterns = [
      /\bcode\b/i,
      /\bfunction\b/i,
      /\bclass\b/i,
      /\bprogramming\b/i,
      /\balgorithm\b/i,
      /\bjavascript\b/i,
      /\bpython\b/i,
      /\bjava\b/i,
      /\bc\+\+\b/i,
      /\bruby\b/i,
      /\bgolang\b/i,
      /\brust\b/i,
      /\bapi\b/i,
      /\bhttp\b/i,
      /\bhow to implement\b/i,
      /\bwrite a\b.*\bfunction\b/i,
      /\bcreate a\b.*\bprogram\b/i,
      /\bdebugging\b/i,
      /\berror\b/i,
      /\bcompile\b/i
    ];
    
    // Check if any code pattern matches
    return codePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Process a batch of embeddings with caching and retry logic
   */
  private async processEmbeddingBatchWithCache(
    batch: string[], 
    batchIndex: number, 
    totalBatches: number,
    skipCache: boolean,
    model: string
  ): Promise<number[][]> {
    // Skip cache if disabled
    const shouldSkipCache = skipCache || this.DISABLE_CACHE;
    
    // Check cache first if not skipping
    if (!shouldSkipCache) {
      const cachedResults = this.getCachedEmbeddings(batch);
      const uncachedTexts = batch.filter((_, i) => !cachedResults[i]);
      
      // If all embeddings were in cache, return them
      if (uncachedTexts.length === 0) {
        this.logger.info(`Batch ${batchIndex + 1}/${totalBatches}: All ${batch.length} embeddings found in cache`);
        return cachedResults.filter(Boolean) as number[][];
      }
      
      // If some embeddings were in cache, only process the uncached ones
      if (uncachedTexts.length < batch.length) {
        this.logger.info(`Batch ${batchIndex + 1}/${totalBatches}: Found ${batch.length - uncachedTexts.length}/${batch.length} embeddings in cache, generating ${uncachedTexts.length} new embeddings`);
        
        // Process uncached texts
        const newEmbeddings = await this.processEmbeddingBatchWithRetry(uncachedTexts, batchIndex, totalBatches, model);
        
        // Cache the new embeddings
        this.cacheEmbeddings(uncachedTexts, newEmbeddings);
        
        // Merge cached and new embeddings in the original order
        let uncachedIndex = 0;
        return batch.map((text, i) => {
          if (cachedResults[i]) return cachedResults[i]!;
          return newEmbeddings[uncachedIndex++];
        });
      }
    }
    
    // If skipping cache or no cached embeddings found, process the entire batch
    const embeddings = await this.processEmbeddingBatchWithRetry(batch, batchIndex, totalBatches, model);
    
    // Cache the embeddings for future use (if caching is enabled)
    if (!shouldSkipCache) {
      this.cacheEmbeddings(batch, embeddings);
    }
    
    return embeddings;
  }
  
  /**
   * Get cached embeddings for a batch of texts
   */
  private getCachedEmbeddings(texts: string[]): (number[] | null)[] {
    return texts.map(text => {
      const hash = this.hashText(text);
      
      // Check in-memory cache first
      const cachedEmbedding = this.embeddingCache.get(hash);
      if (cachedEmbedding) return cachedEmbedding;
      
      // Check disk cache
      try {
        const cachePath = path.join(this.CACHE_DIR, `${hash}.json`);
        if (fs.existsSync(cachePath)) {
          const embedding = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
          // Add to in-memory cache
          this.embeddingCache.set(hash, embedding);
          return embedding;
        }
      } catch (error) {
        this.logger.debug(`Cache miss for text hash ${hash.substring(0, 8)}...`);
      }
      
      return null;
    });
  }
  
  /**
   * Cache embeddings for a batch of texts
   */
  private cacheEmbeddings(texts: string[], embeddings: number[][]): void {
    // Skip caching if disabled
    if (this.DISABLE_CACHE) return;
    
    try {
      texts.forEach((text, i) => {
        const hash = this.hashText(text);
        
        // Add to in-memory cache
        this.embeddingCache.set(hash, embeddings[i]);
        
        // Write to disk cache
        const cachePath = path.join(this.CACHE_DIR, `${hash}.json`);
        fs.writeFileSync(cachePath, JSON.stringify(embeddings[i]));
      });
    } catch (error) {
      this.logger.warn(`Failed to cache embeddings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create a hash of text for caching
   */
  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
  
  /**
   * Process a batch of embeddings with retry logic
   */
  private async processEmbeddingBatchWithRetry(
    batch: string[], 
    batchIndex: number, 
    totalBatches: number,
    model: string
  ): Promise<number[][]> {
    let retries = 0;
    let lastError: any = null;
    
    // Apply safety truncation to avoid token limit errors
    const safeBatch = batch.map(text => this.truncateTextForEmbedding(text));
    
    while (retries <= this.maxRetries) {
      try {
        this.logger.info(`Processing embedding batch ${batchIndex + 1}/${totalBatches} (attempt ${retries + 1}/${this.maxRetries + 1})`);
        
        // Use the properly typed client
        const result = await this.openai.embeddings.create({
          model: model,
          input: safeBatch
        });
        
        const embeddings = result.data.map(item => item.embedding);
        this.logger.info(`Successfully generated ${embeddings.length} embeddings in batch ${batchIndex + 1}/${totalBatches}`);
        
        return embeddings;
      } catch (error: any) {
        lastError = error;
        
        // Enhanced error classification
        const isRateLimit = error.status === 429 || 
                           (error.message && error.message.includes('rate limit'));
        const isServerError = error.status >= 500 || 
                             (error.message && error.message.includes('server error'));
        const isTokenLimitError = error.message && (
                                 error.message.includes('token limit') || 
                                 error.message.includes('maximum context length'));
        
        this.logger.error(`Error in batch ${batchIndex + 1}/${totalBatches} (attempt ${retries + 1}/${this.maxRetries + 1}): ${error.message}`);
        
        // If we've reached max retries, throw the error
        if (retries >= this.maxRetries) {
          this.logger.error(`Max retries (${this.maxRetries}) reached for batch ${batchIndex + 1}. Giving up.`);
          throw error;
        }
        
        // If it's a token limit error, we need to reduce batch size and retry
        if (isTokenLimitError && batch.length > 1) {
          this.logger.warn(`Token limit exceeded. Splitting batch ${batchIndex + 1} into smaller chunks and retrying.`);
          
          // Split the batch in half and process each half separately
          const midpoint = Math.ceil(batch.length / 2);
          const firstHalf = batch.slice(0, midpoint);
          const secondHalf = batch.slice(midpoint);
          
          // Process each half with retries
          const firstHalfEmbeddings = await this.processEmbeddingBatchWithRetry(
            firstHalf, 
            batchIndex, 
            totalBatches,
            model
          );
          
          const secondHalfEmbeddings = await this.processEmbeddingBatchWithRetry(
            secondHalf, 
            batchIndex, 
            totalBatches,
            model
          );
          
          // Combine the results
          return [...firstHalfEmbeddings, ...secondHalfEmbeddings];
        }
        
        // Calculate backoff time - longer for rate limit errors
        const backoffTime = isRateLimit 
          ? this.retryDelay * Math.pow(2, retries) // Exponential backoff for rate limits
          : isServerError
            ? this.retryDelay * (retries + 1) // Linear backoff for server errors
            : this.retryDelay; // Constant delay for other errors
        
        this.logger.info(`Waiting ${backoffTime / 1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        retries++;
      }
    }
    
    // This should never be reached due to the throw in the loop, but TypeScript needs it
    throw lastError;
  }
}

export const openAIService = OpenAIService.getInstance();

export { openai };