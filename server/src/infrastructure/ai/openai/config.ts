import OpenAI from 'openai';
import { APIError, OpenAIError } from './errors';
import { Config } from '../../../types/config';
import * as winston from 'winston';
import { ExtendedOpenAI } from './types';

// Create a direct logger for this module to avoid circular dependencies
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [OpenAIConfig]: ${message}`;
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
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [OpenAIConfig]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

// Configuration types
export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  maxRetries?: number;
  timeout?: number;
}

// Default configuration values
const DEFAULT_CONFIG: Partial<OpenAIConfig> = {
  maxRetries: 3,
  timeout: 60000, // 60 seconds
  baseURL: 'https://api.ciro.ai/v1'
};

// Create a properly typed config object from the app config
export function createOpenAIConfigFromAppConfig(appConfig: any): OpenAIConfig {
  logger.info(`Creating OpenAI config from app config, baseURL: ${appConfig.baseURL || 'default'}`);
  
  if (!appConfig.apiKey) {
    throw new Error('OpenAI API key is required');
  }

  return {
    apiKey: appConfig.apiKey,
    baseURL: appConfig.baseURL,
    organization: appConfig.organization,
    maxRetries: appConfig.maxRetries || 3,
    timeout: appConfig.timeout || 60000,
  };
}

// Initialize OpenAI client with configuration
export function createOpenAIClient(config: OpenAIConfig): OpenAI {
  logger.info(`Creating OpenAI client with baseURL: ${config.baseURL || 'default OpenAI API'}`);
  
  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
      dangerouslyAllowBrowser: true,
    });
    
    logger.info('OpenAI client created successfully');
    return client;
  } catch (error) {
    logger.error(`Failed to create OpenAI client: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Token calculation utilities
export function calculateTokenCost(tokens: number, model: string): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.01, output: 0.03 },
    'gpt-4o-mini': { input: 0.001, output: 0.002 },
    'text-embedding-3-small': { input: 0.00002, output: 0.00002 },
    'text-embedding-3-large': { input: 0.00013, output: 0.00013 },
  };

  return tokens * (pricing[model]?.input || 0);
}

// Rate limiting configuration
export const RATE_LIMITS = {
  completions: {
    tokensPerMinute: 60000,
    requestsPerMinute: 500,
  },
  embeddings: {
    tokensPerMinute: 1000000,
    requestsPerMinute: 1000,
  },
}; 