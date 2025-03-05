import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { FilePurpose } from 'openai/resources/files';
import { config } from '../config/index';
import { createOpenAIClient } from '../infrastructure/ai/openai/config';
import { createLogger } from '../utils/logger';
import pLimit from 'p-limit';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { Knex } from 'knex';

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

type ModelName = 'gpt-4o-mini' | 'gpt-4o' | 'o3-mini' | 'o1-mini' | 'o1-preview';

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
  private openai: OpenAI;
  private logger = createLogger('OpenAIService');
  private db: Knex | null = null;
  private readonly defaultModel: ModelName = 'gpt-4o-mini';
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
  private readonly rateLimiter = pLimit(5); // Limit concurrent requests to 5
  private readonly maxRetries = 5; // Increased from 3 to 5
  private readonly retryDelay = 1000; // 1 second
  
  // Embedding cache
  private embeddingCache: LRUCache<string, number[]>;
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
        
        this.openai = new OpenAI({
          apiKey: apiKey || 'placeholder-for-missing-key',
          baseURL: baseURL
        });
        
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
        } as unknown as OpenAI;
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
    this.embeddingCache = new LRUCache<string, number[]>({
      max: this.CACHE_SIZE,
      ttl: 1000 * 60 * 60 * 24 * 7, // Cache for 7 days
    });
    
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
      
      // Load cache stats
      this.loadCacheStats();
    }
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
   * Create embeddings with optimized handling, caching, and rate limiting protection
   * @param input Text or array of texts to embed
   * @param options Optional configuration for embedding generation
   * @returns Array of embedding vectors
   */
  async createEmbeddings(
    input: string | string[], 
    options: { 
      skipCache?: boolean; 
      model?: string;
      batchSize?: number;
    } = {}
  ): Promise<number[][]> {
    const startTime = Date.now();
    try {
      // Convert single string to array for consistent handling
      const inputArray = Array.isArray(input) ? input : [input];
      
      // Log the input size
      this.logger.info(`Generating embeddings for ${inputArray.length} items`);
      
      // If the input is empty, return an empty array
      if (inputArray.length === 0) {
        return [];
      }
      
      // Determine optimal batch size based on input length
      // Smaller batches for longer texts to avoid token limits
      const avgLength = inputArray.reduce((sum, text) => sum + text.length, 0) / inputArray.length;
      const dynamicBatchSize = options.batchSize || this.calculateOptimalBatchSize(avgLength);
      
      this.logger.info(`Using dynamic batch size of ${dynamicBatchSize} for average text length of ${Math.round(avgLength)} chars`);
      
      // Process in batches to avoid rate limits
      const batches: string[][] = [];
      
      // Split input into batches
      for (let i = 0; i < inputArray.length; i += dynamicBatchSize) {
        batches.push(inputArray.slice(i, i + dynamicBatchSize));
      }
      
      this.logger.info(`Split ${inputArray.length} inputs into ${batches.length} batches of max size ${dynamicBatchSize}`);
      
      // Process each batch with rate limiting and caching
      const batchResults = await Promise.all(
        batches.map((batch, index) => 
          this.rateLimiter(() => this.processEmbeddingBatchWithCache(
            batch, 
            index, 
            batches.length, 
            options.skipCache || false,
            options.model || this.EMBEDDING_MODEL
          ))
        )
      );
      
      // Flatten the results
      const embeddings = batchResults.flat();
      
      const duration = (Date.now() - startTime) / 1000;
      this.logger.info(`Generated ${embeddings.length} embeddings in ${duration.toFixed(2)}s (${(embeddings.length / duration).toFixed(2)} embeddings/sec)`);
      
      return embeddings;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.logger.error(`Error generating embeddings after ${duration.toFixed(2)}s`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
  
  /**
   * Calculate optimal batch size based on text length
   */
  private calculateOptimalBatchSize(avgTextLength: number): number {
    // For very short texts, use larger batches
    if (avgTextLength < 100) return 50;
    // For short texts, use medium batches
    if (avgTextLength < 500) return 30;
    // For medium texts, use standard batches
    if (avgTextLength < 1000) return 20;
    // For long texts, use smaller batches
    if (avgTextLength < 2000) return 10;
    // For very long texts, use very small batches
    return 5;
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
    // Skip cache if disabled via environment variable
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
          if (cachedResults[i]) return cachedResults[i];
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
   * Process a batch of embeddings with enhanced retry logic
   */
  private async processEmbeddingBatchWithRetry(
    batch: string[], 
    batchIndex: number, 
    totalBatches: number,
    model: string
  ): Promise<number[][]> {
    let retries = 0;
    let lastError: any = null;
    
    while (retries <= this.maxRetries) {
      try {
        this.logger.info(`Processing embedding batch ${batchIndex + 1}/${totalBatches} (attempt ${retries + 1}/${this.maxRetries + 1})`);
        
        const result = await this.openai.embeddings.create({
          model: model,
          input: batch
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

  /**
   * Selects the appropriate model based on the query content
   * This helps optimize cost and performance
   * @param query The user query
   * @returns The recommended model name
   */
  public selectModelForQuery(query: string): ModelName {
    // Check for code-related content
    const isCodeRelated = /\bcode\b|\bfunction\b|\bclass\b|\bprogramming\b|\balgorithm\b/i.test(query);
    
    // Check for analytical content
    const isAnalytical = /\banalyze\b|\banalysis\b|\bcompare\b|\btrend\b|\bstatistics\b|\bdata\b|\bcount\b|\bhow many\b/i.test(query);
    
    // Check for complex reasoning needs
    const isComplexReasoning = query.length > 200 && /\bexplain\b|\breason\b|\bwhy\b|\bhow\b|\bcause\b|\beffect\b/i.test(query);
    
    // Check for creative content needs
    const isCreative = /\bcreative\b|\bimagine\b|\bstory\b|\bwrite\b|\bgenerate\b|\bcreate\b/i.test(query);
    
    this.logger.debug(`Query characteristics: codeRelated=${isCodeRelated}, analytical=${isAnalytical}, complexReasoning=${isComplexReasoning}, creative=${isCreative}`);
    
    // Select model based on characteristics
    if (isCodeRelated) {
      return 'o1-mini'; // Best for code generation at reasonable cost
    } else if (isAnalytical) {
      return 'o3-mini'; // Best for analytical tasks at reasonable cost
    } else if (isComplexReasoning && query.length > 500) {
      return 'o1-mini'; // For very complex reasoning needs
    } else if (isCreative) {
      return 'gpt-4o-mini'; // Good creativity at reasonable cost
    }
    
    // Default to most cost-effective option
    return this.defaultModel;
  }

  async generateChatCompletion(messages: ChatCompletionMessageParam[], options: ChatOptions = {}) {
    // If no model specified and this is a user query, try to select the appropriate model
    if (!options.model && messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const userQuery = messages[messages.length - 1].content as string;
      const suggestedModel = this.selectModelForQuery(userQuery);
      this.logger.debug(`Auto-selected model ${suggestedModel} for query`);
      options.model = suggestedModel;
    }
    
    const modelName = options.model || this.defaultModel;
    const modelSettings = this.modelConfig[modelName];
    
    // Allow overriding max_tokens if specified
    const max_tokens = options.max_tokens || modelSettings.max_tokens;
    
    this.logger.info(`Generating completion with model: ${modelName}, max_tokens: ${max_tokens}`);
    
    return await this.openai.chat.completions.create({
      model: modelSettings.model,
      temperature: options.temperature ?? modelSettings.temperature,
      max_tokens,
      messages,
      stream: options.stream || false,
    });
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
}

export const openAIService = OpenAIService.getInstance();

export { openai };