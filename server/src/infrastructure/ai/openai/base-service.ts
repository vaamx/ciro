import OpenAI from 'openai';
import { OpenAIError, APIError, RateLimitError } from './errors';
import { createOpenAIClient, OpenAIConfig, RATE_LIMITS } from './config';
import { backOff } from 'exponential-backoff';

export abstract class BaseOpenAIService {
  protected client: OpenAI;
  protected rateLimiters: Map<string, { lastReset: number; tokens: number; requests: number }>;

  constructor(config: OpenAIConfig) {
    this.client = createOpenAIClient(config);
    this.rateLimiters = new Map();
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    endpoint: 'completions' | 'embeddings',
    tokens: number = 0
  ): Promise<T> {
    // Check rate limits
    this.checkRateLimit(endpoint, tokens);

    try {
      const result = await backOff(() => operation(), {
        numOfAttempts: 3,
        startingDelay: 1000,
        timeMultiple: 2,
        retry: (error: any) => {
          // Retry on rate limits or temporary errors
          if (error instanceof RateLimitError) {
            return true;
          }
          if (error instanceof APIError && error.statusCode >= 500) {
            return true;
          }
          return false;
        },
      });

      // Update rate limit counters on success
      this.updateRateLimit(endpoint, tokens);

      return result;
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new RateLimitError(
          'Rate limit exceeded',
          Number(error.response.headers['retry-after']) || undefined
        );
      }
      if (error.response?.status) {
        throw new APIError(
          error.message || 'API request failed',
          error.response.status,
          { cause: error }
        );
      }
      throw new OpenAIError('Request failed', { cause: error });
    }
  }

  private checkRateLimit(endpoint: 'completions' | 'embeddings', tokens: number): void {
    const now = Date.now();
    const limits = RATE_LIMITS[endpoint];
    let limiter = this.rateLimiters.get(endpoint);

    // Initialize or reset if minute has passed
    if (!limiter || now - limiter.lastReset >= 60000) {
      limiter = { lastReset: now, tokens: 0, requests: 0 };
      this.rateLimiters.set(endpoint, limiter);
    }

    // Check limits
    if (limiter.tokens + tokens > limits.tokensPerMinute) {
      throw new RateLimitError('Token rate limit exceeded');
    }
    if (limiter.requests + 1 > limits.requestsPerMinute) {
      throw new RateLimitError('Request rate limit exceeded');
    }
  }

  private updateRateLimit(endpoint: 'completions' | 'embeddings', tokens: number): void {
    const limiter = this.rateLimiters.get(endpoint);
    if (limiter) {
      limiter.tokens += tokens;
      limiter.requests += 1;
    }
  }
} 