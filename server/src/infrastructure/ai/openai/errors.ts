interface ErrorOptions {
  cause?: unknown;
}

// Base error class for OpenAI related errors
export class OpenAIError extends Error {
  cause?: unknown;
  
  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = 'OpenAIError';
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

// API specific error class
export class APIError extends OpenAIError {
  statusCode: number;
  
  constructor(message: string, statusCode: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

// Rate limit error
export class RateLimitError extends APIError {
  retryAfter?: number;
  
  constructor(message: string, retryAfter?: number, options?: ErrorOptions) {
    super(message, 429, options);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Token limit error
export class TokenLimitError extends OpenAIError {
  tokenCount: number;
  maxTokens: number;
  
  constructor(message: string, tokenCount: number, maxTokens: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TokenLimitError';
    this.tokenCount = tokenCount;
    this.maxTokens = maxTokens;
  }
}

// Invalid response error
export class InvalidResponseError extends OpenAIError {
  response: any;
  
  constructor(message: string, response: any, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidResponseError';
    this.response = response;
  }
} 